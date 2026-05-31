import type { LogEntry } from "../types/deployment";

export function parseLogOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = output.split("\n");
  let current: Partial<LogEntry> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const changeMatch = trimmed.match(/^Change:\s+(.+)$/);
    if (changeMatch) {
      if (current?.change) {
        entries.push(current as LogEntry);
      }
      current = {
        change: changeMatch[1],
        tags: [],
        requires: [],
        conflicts: [],
      };
      continue;
    }

    if (!current) continue;

    const idMatch = trimmed.match(/^ID:\s+(.+)$/);
    if (idMatch) {
      current.changeId = idMatch[1];
      continue;
    }

    const actionMatch = trimmed.match(/^Action:\s+(deploy|revert)$/);
    if (actionMatch) {
      current.action = actionMatch[1] as "deploy" | "revert";
      continue;
    }

    const committerMatch = trimmed.match(/^Committed by\s+(.+?)\s+<(.+)>$/);
    if (committerMatch) {
      current.committer = { name: committerMatch[1], email: committerMatch[2] };
      continue;
    }

    const dateMatch = trimmed.match(/^Date:\s+(.+)$/);
    if (dateMatch) {
      current.timestamp = dateMatch[1];
      continue;
    }

    const noteMatch = trimmed.match(/^Note:\s+(.*)$/);
    if (noteMatch) {
      current.note = noteMatch[1];
      continue;
    }

    const tagsMatch = trimmed.match(/^Tags:\s*(.*)$/);
    if (tagsMatch) {
      const raw = tagsMatch[1].trim();
      current.tags = raw ? raw.split(/\s+/).map((t) => t.replace(/^@/, "")) : [];
      continue;
    }

    const requiresMatch = trimmed.match(/^Requires:\s*(.*)$/);
    if (requiresMatch) {
      const raw = requiresMatch[1].trim();
      current.requires = raw ? raw.split(/\s+/) : [];
      continue;
    }

    const conflictsMatch = trimmed.match(/^Conflicts:\s*(.*)$/);
    if (conflictsMatch) {
      const raw = conflictsMatch[1].trim();
      current.conflicts = raw ? raw.split(/\s+/) : [];
    }
  }

  if (current?.change) {
    entries.push(current as LogEntry);
  }

  return entries;
}
