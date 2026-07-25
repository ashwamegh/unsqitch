import fs from "node:fs";
import path from "node:path";

export interface ProjectLayout {
  /** Directory holding deploy/revert/verify script dirs (sqitch core.top_dir, default "."). */
  topDir: string;
  /** Absolute path to the plan file (core.plan_file, default <top_dir>/sqitch.plan). */
  planFile: string;
  /** Absolute script directories. */
  deployDir: string;
  revertDir: string;
  verifyDir: string;
}

/**
 * Read a single `key = value` from the [core] section of sqitch.conf.
 * Commented-out lines (`# plan_file = ...`) are ignored, as sqitch ignores them.
 */
function readCoreKey(conf: string, key: string): string | undefined {
  const lines = conf.split("\n");
  let inCore = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#") || line.startsWith(";") || line === "") continue;
    const section = line.match(/^\[([^\]"\s]+)(?:\s+"([^"]+)")?\]$/);
    if (section) {
      inCore = section[1] === "core" && !section[2];
      continue;
    }
    if (!inCore) continue;
    const match = line.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

/**
 * Resolve where a project's plan and scripts actually live.
 *
 * Sqitch supports `core.top_dir` (default ".") and `core.plan_file`
 * (default `<top_dir>/sqitch.plan`), so a project may keep everything under a
 * subdirectory (e.g. top_dir = sql). Paths are resolved against projectPath.
 */
export function resolveProjectLayout(projectPath: string): ProjectLayout {
  let topDir = ".";
  let planFileSetting: string | undefined;

  try {
    const conf = fs.readFileSync(path.join(projectPath, "sqitch.conf"), "utf-8");
    topDir = readCoreKey(conf, "top_dir") || ".";
    planFileSetting = readCoreKey(conf, "plan_file");
  } catch {
    // No readable sqitch.conf — fall back to sqitch's defaults.
  }

  const absTopDir = path.resolve(projectPath, topDir);
  const planFile = planFileSetting
    ? path.resolve(projectPath, planFileSetting)
    : path.join(absTopDir, "sqitch.plan");

  return {
    topDir: absTopDir,
    planFile,
    deployDir: path.join(absTopDir, "deploy"),
    revertDir: path.join(absTopDir, "revert"),
    verifyDir: path.join(absTopDir, "verify"),
  };
}

/** Absolute path to a change's deploy/revert/verify script. */
export function scriptPathFor(
  projectPath: string,
  changeName: string,
  kind: "deploy" | "revert" | "verify",
): string {
  const layout = resolveProjectLayout(projectPath);
  const dir =
    kind === "revert" ? layout.revertDir : kind === "verify" ? layout.verifyDir : layout.deployDir;
  return path.join(dir, `${changeName}.sql`);
}
