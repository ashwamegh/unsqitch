import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { redactCommand } from "../../electron/services/project.service";

/**
 * Guards the security properties SECURITY.md promises.
 *
 * These are deliberately source-level assertions: the values live in Electron
 * bootstrap code that cannot be imported under Vitest, and the point is to fail
 * loudly if someone weakens a setting rather than to test Electron itself.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const main = read("electron/main.ts");
const preload = read("electron/preload.ts");
const sqitchService = read("electron/services/sqitch.service.ts");

/**
 * Strips comments so these assertions judge code, not prose. Without this, a comment
 * explaining a rule is enough to trip the rule it explains.
 */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Every main-process source, so a new file cannot quietly opt out of these rules. */
function collectSources(dir: string): Array<[string, string]> {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return collectSources(rel);
    return entry.name.endsWith(".ts") ? [[rel, codeOnly(read(rel))] as [string, string]] : [];
  });
}

const mainProcessSources = collectSources("electron");

describe("Electron window hardening", () => {
  it("isolates the renderer context", () => {
    expect(main).toMatch(/contextIsolation:\s*true/);
  });

  it("does not give the renderer Node integration", () => {
    expect(main).toMatch(/nodeIntegration:\s*false/);
  });

  it("never disables web security or allows insecure content", () => {
    expect(main).not.toMatch(/webSecurity:\s*false/);
    expect(main).not.toMatch(/allowRunningInsecureContent:\s*true/);
    expect(main).not.toMatch(/experimentalFeatures:\s*true/);
  });

  it("does not enable the remote module or sandbox escapes", () => {
    expect(main).not.toMatch(/enableRemoteModule:\s*true/);
    expect(main).not.toMatch(/nodeIntegrationInSubFrames:\s*true/);
    expect(main).not.toMatch(/nodeIntegrationInWorker:\s*true/);
  });
});

describe("Preload bridge", () => {
  it("exposes the API through contextBridge rather than assigning to window", () => {
    expect(preload).toMatch(/contextBridge\.exposeInMainWorld/);
    expect(preload).not.toMatch(/window\.(unsqitch|require)\s*=/);
  });

  it("does not hand the renderer raw ipcRenderer or Node primitives", () => {
    // Exposing ipcRenderer itself would let the renderer talk on any channel.
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer\s*\)/);
    expect(preload).not.toMatch(/exposeInMainWorld\(\s*["'][^"']+["']\s*,\s*require\b/);
  });
});

describe("Command execution", () => {
  it("spawns sqitch with an argument array, never a shell string", () => {
    // A shell string would let a project path or URI be word-split or expanded.
    expect(sqitchService).toMatch(/_spawn\(\s*this\._binaryPath,\s*fullArgs/);
    expect(sqitchService).not.toMatch(/shell:\s*true/);
    expect(sqitchService).not.toMatch(/\bexec\(|\bexecSync\(/);
  });

  // Scoping this to sqitch.service.ts is what previously let binary-detector.ts run
  // execSync(`"${customPath}" --version`) with a path taken from the Settings dialog.
  // SECURITY.md's promise is about the whole main process, so assert it there.
  it("never uses a shell anywhere in the main process", () => {
    // Matches child_process shell APIs only. `db.exec(...)` is SQLite DDL, not a shell,
    // so the check keys off execSync and off importing exec from node:child_process.
    const usesShell = (source: string) =>
      /\bexecSync\s*\(/.test(source) ||
      /shell:\s*true/.test(source) ||
      /import\s*\{[^}]*\bexec\b[^}]*\}\s*from\s*["']node:child_process["']/.test(source);

    const offenders = mainProcessSources.filter(([, source]) => usesShell(source));
    expect(offenders.map(([file]) => file)).toEqual([]);
  });
});

describe("Credential handling", () => {
  it("redacts user:password from a URI before storing a command", () => {
    expect(redactCommand("sqitch deploy db:pg://joe:s3cret@host/db --verify")).toBe(
      "sqitch deploy db:pg://***:***@host/db --verify",
    );
  });

  it("redacts a lone user as well", () => {
    expect(redactCommand("sqitch status db:pg://joe@host/db")).toBe(
      "sqitch status db:pg://***@host/db",
    );
  });

  // The first implementation excluded "/" from the userinfo character class, so a
  // password containing a slash never matched and reached the database in cleartext.
  it.each([
    ["a slash", "db:pg://joe:pa/ss@host/db", "pa/ss"],
    ["several slashes", "db:mysql://root:my/sql/pw@db.internal/app", "my/sql/pw"],
    ["a question mark", "db:pg://joe:pa?ss@host/db", "pa?ss"],
    ["a colon", "db:pg://joe:pa:ss@host/db", "pa:ss"],
    ["an encoded at sign", "db:pg://joe:pa%40ss@host/db", "pa%40ss"],
  ])("redacts a password containing %s", (_label, command, secret) => {
    const redacted = redactCommand(`sqitch deploy ${command}`);
    expect(redacted).not.toContain(secret);
    expect(redacted).toContain("***");
  });

  it("leaves commands without credentials untouched", () => {
    expect(redactCommand("sqitch deploy db:pg://host:5432/db")).toBe(
      "sqitch deploy db:pg://host:5432/db",
    );
    expect(redactCommand("sqitch deploy mydb --verify")).toBe("sqitch deploy mydb --verify");
    expect(redactCommand("sqitch revert --to @HEAD^")).toBe("sqitch revert --to @HEAD^");
  });

  it("records commands only through the redacting helper", () => {
    const service = read("electron/services/project.service.ts");
    // The INSERT must pass the redacted value, not the raw command.
    expect(service).toMatch(/INSERT INTO recent_commands[\s\S]*?redactCommand\(command\)/);
  });

  it("never persists a password column to the app database", () => {
    // Comments stripped, so documenting the guarantee does not violate it.
    const service = codeOnly(read("electron/services/project.service.ts"));
    expect(service).not.toMatch(/password/i);
  });
});
