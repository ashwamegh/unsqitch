#!/usr/bin/env bun
/**
 * Audits only the dependencies that ship inside the packaged app.
 *
 * Why this exists: `bun audit` has no `--omit=dev` / `--production` flag (bun 1.3.x
 * offers only --json, --audit-level and --ignore), and its JSON output carries no
 * prod/dev distinction. Auditing the whole tree would fail the build on advisories in
 * the build toolchain (electron-builder and friends), which never reach a user's
 * machine — so a whole-tree gate would either be permanently red or have to be turned
 * off entirely. Neither is acceptable for a gate that is supposed to mean something.
 *
 * Instead we resolve a throwaway tree containing *only* the `dependencies` block and
 * audit that. `--lockfile-only` means no node_modules is installed, so this costs a few
 * seconds and touches nothing in the real project.
 *
 * Dev-dependency advisories are still reported, informationally, by `bun run audit:all`.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LEVEL = process.env.AUDIT_LEVEL ?? "high";

const pkg = JSON.parse(await Bun.file(new URL("../package.json", import.meta.url)).text());
const dependencies = pkg.dependencies ?? {};
const count = Object.keys(dependencies).length;

if (count === 0) {
  console.log("No production dependencies to audit.");
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "unsqitch-audit-"));

try {
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "unsqitch-audit-prod", version: "0.0.0", private: true, dependencies }, null, 2)}\n`,
  );

  console.log(`Auditing ${count} production dependencies (level: ${LEVEL})…`);

  const resolve = spawnSync("bun", ["install", "--lockfile-only"], { cwd: dir, stdio: "inherit" });
  if (resolve.status !== 0) {
    console.error("Could not resolve the production dependency tree.");
    process.exit(resolve.status ?? 1);
  }

  const audit = spawnSync("bun", ["audit", `--audit-level=${LEVEL}`], {
    cwd: dir,
    stdio: "inherit",
  });
  if (audit.status !== 0) {
    console.error(
      `\nAdvisories at or above "${LEVEL}" in dependencies that ship to users. ` +
        'Fix forward if a patched version exists; if the only "fix" downgrades a major ' +
        "version, discuss it rather than taking the downgrade.",
    );
  }
  process.exit(audit.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
