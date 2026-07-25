#!/usr/bin/env node
/**
 * Fails the install if it was started by npm, yarn or pnpm instead of bun.
 *
 * This matters beyond consistency: installing with another package manager writes a
 * second lockfile, and electron-builder picks its package manager by *scanning for
 * lockfiles*. With two present it stops detecting deterministically and can rebuild the
 * native module (better-sqlite3) against the wrong tree — so the wrong installer produces
 * a subtly broken build, not merely a different one.
 *
 * Detection deliberately does NOT rely on npm_config_user_agent alone. bun only sets that
 * variable when it is unset, so a genuine `bun install` launched from an environment that
 * already has it (inside an `npm run` wrapper, or some CI images) still reports
 * "npm/11.6.0 ...". Keying off it would reject the very command this project requires.
 *
 * So: prove bun first via BUN_WHICH_IGNORE_CWD, which bun sets for lifecycle scripts and
 * npm does not; only then look for a positive npm/yarn/pnpm marker. Anything unrecognised
 * is allowed through — an unknown environment should not be able to block installs, and
 * the CI check that rejects stray lockfiles is the real enforcement.
 *
 * Set UNSQITCH_ALLOW_ANY_PM=1 to bypass entirely.
 */

const env = process.env;
const agent = env.npm_config_user_agent ?? "";

const startedByBun = "BUN_WHICH_IGNORE_CWD" in env || agent.startsWith("bun/");

// Variables npm sets and bun does not, so an inherited user agent cannot cause a false hit.
const npmMarkers = ["npm_config_npm_version", "npm_command", "npm_config_node_gyp"];
const startedByNpm = npmMarkers.some((key) => key in env);
const otherManager = /^(npm|yarn|pnpm)\//.exec(agent)?.[1];

if (env.UNSQITCH_ALLOW_ANY_PM === "1" || startedByBun || !(startedByNpm || otherManager)) {
  process.exit(0);
}

process.stderr.write(
  `\nThis project uses bun, but the install was started by ${otherManager ?? "npm"}.\n\n` +
    "  curl -fsSL https://bun.sh/install | bash   # if you do not have bun\n" +
    "  bun install\n\n" +
    "Another package manager leaves a second lockfile behind, which makes\n" +
    "electron-builder rebuild the native module against the wrong tree.\n" +
    "Set UNSQITCH_ALLOW_ANY_PM=1 to override.\n\n",
);
process.exit(1);
