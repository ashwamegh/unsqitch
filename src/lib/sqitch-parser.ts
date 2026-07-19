import type { SqitchEvent, SqitchEventStatus, SqitchParsedOutput } from "../types/sqitch-event";

const DEPLOY_LINE_RE = /^\s*\+\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;
const REVERT_LINE_RE = /^\s*-\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;
const VERIFY_LINE_RE = /^\s*\*\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;

const DEPLOY_HEADER_RE = /^Deploying change (\S+) to (\S+)/;
const REVERT_HEADER_RE = /^Reverting change (\S+) from (\S+)/;
const VERIFY_HEADER_RE = /^Verifying change (\S+)/;

const DEPLOY_TARGET_RE = /^Deploying changes to (\S+)/;
const REVERT_TARGET_RE = /^Reverting changes from (\S+)/;
const VERIFY_TARGET_RE = /^Verifying changes to (\S+)/;

function mapStatus(raw: string): SqitchEventStatus {
  if (raw === "ok") return "ok";
  if (raw === "not ok") return "not_ok";
  if (raw === "FAILED") return "failed";
  return "failed";
}

export function parseSqitchOutput(output: string): SqitchParsedOutput {
  const lines = output.split("\n");
  const events: SqitchEvent[] = [];
  let currentTarget: string | undefined;

  for (const line of lines) {
    const deployTarget = line.match(DEPLOY_TARGET_RE);
    if (deployTarget) {
      currentTarget = deployTarget[1];
      continue;
    }
    const revertTarget = line.match(REVERT_TARGET_RE);
    if (revertTarget) {
      currentTarget = revertTarget[1];
      continue;
    }
    const verifyTarget = line.match(VERIFY_TARGET_RE);
    if (verifyTarget) {
      currentTarget = verifyTarget[1];
      continue;
    }

    const deployHeader = line.match(DEPLOY_HEADER_RE);
    if (deployHeader) {
      events.push({
        type: "deploy",
        change: deployHeader[1],
        target: deployHeader[2],
        status: "running",
        rawLine: line,
      });
      continue;
    }
    const revertHeader = line.match(REVERT_HEADER_RE);
    if (revertHeader) {
      events.push({
        type: "revert",
        change: revertHeader[1],
        target: revertHeader[2],
        status: "running",
        rawLine: line,
      });
      continue;
    }
    const verifyHeader = line.match(VERIFY_HEADER_RE);
    if (verifyHeader) {
      events.push({
        type: "verify",
        change: verifyHeader[1],
        status: "running",
        rawLine: line,
      });
      continue;
    }

    const deployLine = line.match(DEPLOY_LINE_RE);
    if (deployLine) {
      events.push({
        type: "deploy",
        change: deployLine[1],
        target: currentTarget,
        status: mapStatus(deployLine[2]),
        rawLine: line,
      });
      continue;
    }
    const revertLine = line.match(REVERT_LINE_RE);
    if (revertLine) {
      events.push({
        type: "revert",
        change: revertLine[1],
        target: currentTarget,
        status: mapStatus(revertLine[2]),
        rawLine: line,
      });
      continue;
    }
    const verifyLine = line.match(VERIFY_LINE_RE);
    if (verifyLine) {
      events.push({
        type: "verify",
        change: verifyLine[1],
        target: currentTarget,
        status: mapStatus(verifyLine[2]),
        rawLine: line,
      });
    }
  }

  return { events, rawOutput: output, exitCode: null };
}

/**
 * Collapse the raw event stream into one entry per change, keyed by type+change.
 * A later result line (ok/not_ok/failed) supersedes the earlier "running" header
 * for the same change, so the progress list shows a single, up-to-date row per
 * change instead of a running row followed by a duplicate completed row.
 */
export function coalesceEvents(events: SqitchEvent[]): SqitchEvent[] {
  const order: string[] = [];
  const byKey = new Map<string, SqitchEvent>();

  for (const event of events) {
    const key = `${event.type}:${event.change}`;
    const prev = byKey.get(key);

    if (!prev) {
      order.push(key);
      byKey.set(key, event);
      continue;
    }

    // Never downgrade a finished change back to "running".
    if (event.status === "running" && prev.status !== "running") continue;

    const merged: SqitchEvent = { ...prev, ...event };
    // Keep a target discovered earlier if the superseding line omits it.
    if (!event.target && prev.target) merged.target = prev.target;
    byKey.set(key, merged);
  }

  return order.map((key) => byKey.get(key) as SqitchEvent);
}
