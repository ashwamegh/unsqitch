import type { LogEntry } from "../types/deployment";

/**
 * Parse `sqitch log <target>` output.
 *
 * Real sqitch emits one block per event, newest first:
 *
 *   On database db:pg://sqitch@localhost:54231/sqitch_test
 *   Deploy ed042459e67b75f039d9d33e1297e44a2bf462d2
 *   Name:      orders
 *   Committer: System Administrator <root@host>
 *   Date:      2026-07-25T15:06:29Z
 *
 *       Creates orders table.
 *
 * The event kind and change id are on the block's first line; the note is the
 * indented paragraph that follows. Requires/conflicts are not reported by
 * `sqitch log` — the plan is the source of truth for those.
 */

const EVENT_RE = /^(Deploy|Revert|Fail)\s+([0-9a-f]{6,40})$/;

function blankEntry(action: LogEntry["action"], changeId: string): LogEntry {
  return {
    change: "",
    changeId,
    action,
    timestamp: "",
    committer: { name: "", email: "" },
    note: "",
    tags: [],
    requires: [],
    conflicts: [],
  };
}

export function parseLogOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;
  const noteLines: string[] = [];

  const flush = () => {
    if (!current) return;
    current.note = noteLines.join("\n").trim();
    entries.push(current);
    current = null;
    noteLines.length = 0;
  };

  for (const raw of output.split("\n")) {
    const trimmed = raw.trim();

    const event = trimmed.match(EVENT_RE);
    if (event) {
      flush();
      // "Fail" events are recorded by sqitch for failed deploys.
      const action = event[1].toLowerCase() === "revert" ? "revert" : "deploy";
      current = blankEntry(action, event[2]);
      continue;
    }

    if (!current) continue;

    const name = trimmed.match(/^Name:\s+(.+)$/);
    if (name) {
      current.change = name[1].trim();
      continue;
    }

    const committer = trimmed.match(/^Committer:\s+(.+?)\s*<(.*)>$/);
    if (committer) {
      current.committer = { name: committer[1].trim(), email: committer[2].trim() };
      continue;
    }

    const date = trimmed.match(/^Date:\s+(.+)$/);
    if (date) {
      current.timestamp = date[1].trim();
      continue;
    }

    const tags = trimmed.match(/^Tags?:\s*(.*)$/);
    if (tags) {
      const value = tags[1].trim();
      current.tags = value ? value.split(/[,\s]+/).map((t) => t.replace(/^@/, "")) : [];
      continue;
    }

    // Anything else that is indented belongs to the note paragraph.
    if (raw.startsWith("    ") && trimmed !== "") {
      noteLines.push(trimmed);
    }
  }

  flush();
  return entries;
}
