#!/usr/bin/env bun
/**
 * Fails when a dependency that ships inside the packaged app has an advisory at or above
 * AUDIT_LEVEL (default: high). Dev-toolchain advisories are reported by `bun run
 * audit:all` instead, because they never reach a user's machine.
 *
 * Why this is not just `bun audit`: it has no --omit=dev equivalent (bun 1.3.x offers
 * only --json, --audit-level and --ignore) and its output carries no prod/dev
 * distinction, so a whole-tree gate would fail on the build toolchain and get turned off.
 *
 * Why it is not "resolve a prod-only tree and audit that" either — the obvious approach,
 * and what this script did first: resolving a fresh tree from the semver *ranges* in
 * package.json audits versions nobody ships. bun.lock could pin a vulnerable version
 * while the range re-resolves to a patched one, and the gate would pass while the
 * committed lockfile is exposed.
 *
 * So: walk bun.lock from the shipped roots to build the production closure at the exact
 * versions the lockfile pins, then match those against the advisories bun reports for the
 * whole tree. The logic lives in scripts/lib/audit-core.mjs and is unit-tested.
 *
 * AUDIT_DEBUG=1 prints the closure instead of auditing, which is how you check that a
 * package you expected to be covered actually is.
 */

import { spawnSync } from "node:child_process";
import {
  findExposures,
  parseLockfile,
  productionClosure,
  SEVERITY_RANK,
} from "./lib/audit-core.mjs";

const LEVEL = process.env.AUDIT_LEVEL ?? "high";
const threshold = SEVERITY_RANK[LEVEL] ?? SEVERITY_RANK.high;

const root = new URL("..", import.meta.url).pathname;

/**
 * Electron is declared as a devDependency, but electron-builder bundles its binary into
 * the shipped app — it is the most security-relevant thing users actually run, so it
 * belongs in this gate even though dependency scoping calls it a build dependency.
 */
const SHIPPED_DEV_PACKAGES = ["electron"];

const lock = parseLockfile(await Bun.file(`${root}bun.lock`).text());
const roots = [...Object.keys(lock.workspaces?.[""]?.dependencies ?? {}), ...SHIPPED_DEV_PACKAGES];

const shipped = productionClosure(lock, roots);

if (process.env.AUDIT_DEBUG === "1") {
  for (const [name, versions] of [...shipped].sort()) {
    console.log(`${name}@${[...versions].join(",")}`);
  }
  process.exit(0);
}

const audit = spawnSync("bun", ["audit", "--json"], { cwd: root, encoding: "utf-8" });
if (!audit.stdout?.trim()) {
  console.error("Could not read advisories from bun audit.");
  if (audit.stderr) console.error(audit.stderr);
  process.exit(audit.status === 0 ? 0 : 1);
}

const exposures = findExposures(JSON.parse(audit.stdout), shipped, threshold);

console.log(
  `Audited ${shipped.size} packages that ship inside the app (from bun.lock), level: ${LEVEL}.`,
);

if (exposures.length === 0) {
  console.log("No advisories at or above this level in shipped dependencies.");
  process.exit(0);
}

for (const item of exposures) {
  console.error(
    `\n${item.severity.toUpperCase()}  ${item.name} ${item.versions.join(", ")}` +
      `\n  ${item.title}` +
      `\n  affected: ${item.vulnerable_versions}` +
      `\n  ${item.url}`,
  );
}
console.error(
  `\n${exposures.length} advisor${exposures.length === 1 ? "y" : "ies"} in dependencies that ` +
    "ship to users. Fix forward if a patched version exists; if the only available fix " +
    "downgrades a major version, discuss it rather than taking the downgrade.",
);
process.exit(1);
