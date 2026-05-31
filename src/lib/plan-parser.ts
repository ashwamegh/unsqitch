import type { PlanChange, PlanEntry, PlanFile, PlanTag } from "../types/plan";

const PRAGMA_RE = /^%([\w-]+)=(.+)$/;
const TAG_RE = /^@([\w.-]+)\s+(\S+)\s+(.+?)\s*<([^>]+)>\s*(?:#\s*(.+))?$/;
const CHANGE_RE = /^([\w-]+)\s*(?:\[([^\]]+)\])?\s+(\S+)\s+(.+?)\s*<([^>]+)>\s*(?:#\s*(.+))?$/;

function parseDeps(bracketContent: string | undefined): {
  requires: string[];
  conflicts: string[];
} {
  if (!bracketContent) return { requires: [], conflicts: [] };
  const parts = bracketContent.trim().split(/\s+/);
  const requires: string[] = [];
  const conflicts: string[] = [];
  for (const part of parts) {
    if (part.startsWith("!")) {
      conflicts.push(part.slice(1));
    } else {
      requires.push(part);
    }
  }
  return { requires, conflicts };
}

export function parsePlanFile(content: string): PlanFile {
  const lines = content.split("\n");
  const entries: PlanEntry[] = [];
  const pragmas: Record<string, string> = {};
  const changes: PlanChange[] = [];
  const tags: PlanTag[] = [];
  const unparseableLines: { line: string; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const pragmaMatch = line.match(PRAGMA_RE);
    if (pragmaMatch) {
      const [, key, value] = pragmaMatch;
      const entry: PlanEntry = {
        type: "pragma",
        index: i,
        pragma: { key, value },
      };
      entries.push(entry);
      pragmas[key] = value;
      continue;
    }

    const tagMatch = line.match(TAG_RE);
    if (tagMatch) {
      const [, name, timestamp, plannerName, plannerEmail, note] = tagMatch;
      const tag: PlanTag = {
        name,
        timestamp,
        planner: { name: plannerName.trim(), email: plannerEmail },
        note: note ?? "",
      };
      tags.push(tag);
      entries.push({ type: "tag", index: i, tag });
      continue;
    }

    const changeMatch = line.match(CHANGE_RE);
    if (changeMatch) {
      const [, name, deps, timestamp, plannerName, plannerEmail, note] = changeMatch;
      const { requires, conflicts } = parseDeps(deps);
      const change: PlanChange = {
        name,
        requires,
        conflicts,
        timestamp,
        planner: { name: plannerName.trim(), email: plannerEmail },
        note: note ?? "",
      };
      changes.push(change);
      entries.push({ type: "change", index: i, change });
      continue;
    }

    unparseableLines.push({ line, index: i });
    entries.push({ type: "unparseable", index: i, unparseable: { line } });
  }

  return { entries, pragmas, changes, tags, unparseableLines };
}
