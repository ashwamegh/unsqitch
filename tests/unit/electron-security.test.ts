import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("records commands only through the redacting helper", () => {
    const service = read("electron/services/project.service.ts");
    // The INSERT must pass the redacted value, not the raw command.
    expect(service).toMatch(/INSERT INTO recent_commands[\s\S]*?redactCommand\(command\)/);
  });

  it("never persists a password column to the app database", () => {
    const service = read("electron/services/project.service.ts");
    expect(service).not.toMatch(/password/i);
  });
});
