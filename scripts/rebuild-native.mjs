#!/usr/bin/env node
/**
 * Rebuilds better-sqlite3 for one runtime's ABI, then proves it worked.
 *
 * Usage: node scripts/rebuild-native.mjs <node|electron>
 *
 * Two things make this harder than "run the rebuild command":
 *
 * 1. It must run under real Node, not bun. bun ships its own Node version
 *    (NODE_MODULE_VERSION 137 at the time of writing) while this project targets the
 *    Node in .nvmrc (127). prebuild-install derives the ABI from the runtime executing
 *    it, so running it under bun downloads a binary that nothing here can load. The
 *    script therefore spawns children with process.execPath — whichever Node ran this.
 *
 * 2. @electron/rebuild caches its result in build/Release/.forge-meta as
 *    "<arch>--<abi>", and skips the rebuild when that matches the requested ABI. A
 *    Node-ABI rebuild overwrites the binary WITHOUT updating that marker, so the next
 *    `electron-rebuild` reads a stale "arm64--140", prints "Rebuild Complete", and does
 *    nothing. The app then dies at startup with a NODE_MODULE_VERSION error. Deleting
 *    the build directory first removes the stale marker along with the old binary.
 *
 * Because a silent no-op looks identical to success, this verifies the result by
 * loading the addon in a child Node process: after a node rebuild it must load, and
 * after an electron rebuild it must NOT (an Electron-ABI binary is unloadable in Node).
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_DIR = join(ROOT, "node_modules", "better-sqlite3");
const BUILD_DIR = join(MODULE_DIR, "build");

const target = process.argv[2];
if (target !== "node" && target !== "electron") {
  console.error("Usage: node scripts/rebuild-native.mjs <node|electron>");
  process.exit(1);
}

if (!existsSync(MODULE_DIR)) {
  console.error(`better-sqlite3 is not installed at ${MODULE_DIR}. Run "bun install" first.`);
  process.exit(1);
}

const run = (args, cwd) => spawnSync(process.execPath, args, { cwd, stdio: "inherit" }).status ?? 1;

/** Loads the addon in a child Node process. Returns true when it loads. */
function loadsUnderNode() {
  const probe = 'const D = require("better-sqlite3"); new D(":memory:").close()';
  return spawnSync(process.execPath, ["-e", probe], { cwd: ROOT, stdio: "ignore" }).status === 0;
}

// Removes both the old binary and @electron/rebuild's .forge-meta marker.
rmSync(BUILD_DIR, { recursive: true, force: true });

if (target === "node") {
  console.log(
    `Rebuilding better-sqlite3 for Node ${process.versions.node} (ABI ${process.versions.modules})…`,
  );

  // prebuild-install requires the module directory as its cwd, and reads the target
  // ABI from the Node running it — hence process.execPath rather than a bare "node".
  let status = run(
    [
      join(ROOT, "node_modules", "prebuild-install", "bin.js"),
      "--runtime=node",
      `--target=${process.versions.node}`,
      `--arch=${process.arch}`,
    ],
    MODULE_DIR,
  );

  if (status !== 0) {
    console.log("No prebuilt binary for this Node; compiling from source…");
    status = run(
      [join(ROOT, "node_modules", "node-gyp", "bin", "node-gyp.js"), "rebuild", "--release"],
      MODULE_DIR,
    );
  }

  if (status !== 0) {
    console.error("better-sqlite3 could not be built for Node.");
    process.exit(status);
  }

  if (!loadsUnderNode()) {
    console.error("\nThe rebuild reported success but the addon does not load under Node.");
    console.error(`Delete ${BUILD_DIR} and try again; do not interrupt the rebuild.`);
    process.exit(1);
  }

  console.log("better-sqlite3 is built for Node — unit tests can load it.");
} else {
  console.log("Rebuilding better-sqlite3 for the Electron ABI…");

  const status = run(
    [
      join(ROOT, "node_modules", "@electron", "rebuild", "lib", "cli.js"),
      "--which-module",
      "better-sqlite3",
      "--force",
    ],
    ROOT,
  );

  if (status !== 0) {
    console.error("better-sqlite3 could not be built for Electron.");
    process.exit(status);
  }

  // An Electron-ABI binary is deliberately unloadable in Node. If Node *can* load it,
  // the rebuild silently did nothing and the app would crash on launch instead.
  if (loadsUnderNode()) {
    console.error(
      "\nThe rebuild reported success but produced a Node-ABI binary, not an Electron one.",
    );
    console.error(`Delete ${BUILD_DIR} and run this again.`);
    process.exit(1);
  }

  console.log("better-sqlite3 is built for Electron — the app and the E2E suite can load it.");
}
