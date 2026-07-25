#!/usr/bin/env node
/**
 * Fails the install if it was not started by bun.
 *
 * This project uses bun as its only package manager. That is not just a preference:
 * installing with npm or yarn writes a second lockfile, and electron-builder picks its
 * package manager by *scanning for lockfiles* — two present at once makes native-module
 * rebuilds (better-sqlite3) resolve against the wrong tree. So the wrong installer does
 * not merely diverge, it produces a subtly broken build.
 *
 * Detection uses npm_config_user_agent, which every installer sets:
 *   bun  -> "bun/1.3.9 npm/? node/v24.3.0 darwin arm64"
 *   npm  -> "npm/11.6.0 node/v22.15.0 darwin arm64 workspaces/false"
 *
 * Set UNSQITCH_ALLOW_ANY_PM=1 to bypass (e.g. when vendoring in a foreign build system).
 */

const agent = process.env.npm_config_user_agent ?? "";

if (process.env.UNSQITCH_ALLOW_ANY_PM === "1" || agent.startsWith("bun/")) {
  process.exit(0);
}

const installer = agent.split("/")[0] || "an unknown package manager";

process.stderr.write(
  `\nThis project uses bun, but the install was started by ${installer}.\n\n` +
    "  curl -fsSL https://bun.sh/install | bash   # if you do not have bun\n" +
    "  bun install\n\n" +
    "Using another package manager leaves a second lockfile behind, which makes\n" +
    "electron-builder rebuild the native module against the wrong tree.\n" +
    "Set UNSQITCH_ALLOW_ANY_PM=1 to override.\n\n",
);
process.exit(1);
