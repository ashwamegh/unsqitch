import fs from "node:fs";
import path from "node:path";
import type { ConfigEntry } from "../../src/types/config";

/**
 * Parse a sqitch.conf (git-config format) into flat ConfigEntry records.
 *
 * The Config view reads settings through `sqitch config --list` per spec; this
 * parser exists so the app can still discover a project's targets when the
 * Sqitch CLI is unavailable (first run, not installed yet).
 */
export function parseSqitchConf(contents: string): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  let section = "";
  let subsection: string | undefined;

  for (const raw of contents.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;

    const header = line.match(/^\[([^\]"\s]+)(?:\s+"([^"]+)")?\]$/);
    if (header) {
      section = header[1];
      subsection = header[2];
      continue;
    }

    const kv = line.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (kv && section) {
      entries.push({
        section,
        subsection,
        key: kv[1],
        value: kv[2].trim().replace(/^["']|["']$/g, ""),
      });
    }
  }

  return entries;
}

export interface ResolvedTargets {
  /** Target sqitch would use with no explicit argument, if determinable. */
  defaultTarget?: string;
  /** Named targets (target.<name>.uri) plus the engine default. */
  targets: Array<{ name: string; uri?: string }>;
  engine?: string;
}

/**
 * Work out which target(s) a project is configured for.
 *
 * Precedence for the default matches sqitch: `core.target`, then the target of
 * the configured engine (`engine.<core.engine>.target`).
 */
export function resolveTargets(entries: ConfigEntry[]): ResolvedTargets {
  const get = (section: string, key: string, sub?: string) =>
    entries.find((e) => e.section === section && e.key === key && e.subsection === sub)?.value;

  const engine = get("core", "engine");
  const coreTarget = get("core", "target");
  const engineTarget = engine ? get("engine", "target", engine) : undefined;

  const named = entries
    .filter((e) => e.section === "target" && e.key === "uri" && e.subsection)
    .map((e) => ({ name: e.subsection as string, uri: e.value }));

  const defaultTarget = coreTarget || engineTarget;
  const targets = [...named];

  // Surface the engine/core default even when it is a URI rather than an alias,
  // so the UI can offer it as a choice.
  if (defaultTarget && !targets.some((t) => t.name === defaultTarget)) {
    targets.unshift({ name: defaultTarget, uri: defaultTarget });
  }

  return { defaultTarget, targets, engine };
}

/** Read a project's sqitch.conf, if present, and resolve its targets. */
export function resolveTargetsFromDisk(projectPath: string): ResolvedTargets {
  try {
    const conf = fs.readFileSync(path.join(projectPath, "sqitch.conf"), "utf-8");
    return resolveTargets(parseSqitchConf(conf));
  } catch {
    return { targets: [] };
  }
}
