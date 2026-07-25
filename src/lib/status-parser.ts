import type { DeployedChange, DeploymentStatus } from "../types/deployment";

/**
 * Parse `sqitch status <target> --show-changes --show-tags` output.
 *
 * Real sqitch prefixes every informational line with "# ", e.g.
 *
 *   # On database db:pg://sqitch@localhost:54231/sqitch_test
 *   # Project:  test-project
 *   # Change:   ed042459e67b75f039d9d33e1297e44a2bf462d2
 *   # Name:     orders
 *   # Tag:      @v1.0.0
 *   # Deployed: 2026-07-25T15:06:29Z
 *   # By:       System Administrator <root@host>
 *   #
 *   # Changes:
 *   #   orders    - 2026-07-25T15:06:29Z - System Administrator <root@host>
 *   #   users     - ...
 *   #
 *   # Tag:
 *   #   @v1.0.0 - 2026-07-25T15:06:29Z - System Administrator <root@host>
 *   #
 *   Undeployed change:
 *     * orders
 *
 * Changes are listed newest-first; deployed[] is returned oldest-first so it
 * reads in deployment order. Sqitch does not report the engine here, so the
 * engine is inferred from the target URI when possible.
 */

type Section = "none" | "changes" | "tags" | "undeployed";

function engineFromTarget(target: string): string {
  const match = target.match(/^db:([^:]+):/);
  if (!match) return "";
  return match[1];
}

export function parseStatusOutput(output: string): DeploymentStatus {
  let target = "";
  let project = "";
  let lastChange = "";
  let lastDeployTime = "";
  const tags: string[] = [];
  const deployed: DeployedChange[] = [];
  const pending: string[] = [];

  let section: Section = "none";

  for (const raw of output.split("\n")) {
    // Informational lines are "# "-prefixed; strip it before matching.
    const isComment = /^\s*#/.test(raw);
    const line = raw.replace(/^\s*#\s?/, "").trim();

    if (line === "") continue;

    if (isComment) {
      const onDb = line.match(/^On database\s+(.+)$/);
      if (onDb) {
        target = onDb[1].trim();
        section = "none";
        continue;
      }

      const proj = line.match(/^Project:\s+(.+)$/);
      if (proj) {
        project = proj[1].trim();
        continue;
      }

      // Section headers.
      if (/^Changes?:$/.test(line)) {
        section = "changes";
        continue;
      }
      if (/^Tags?:$/.test(line)) {
        section = "tags";
        continue;
      }

      // Header block: the most recently deployed change.
      const name = line.match(/^Name:\s+(.+)$/);
      if (name && section === "none") {
        lastChange = name[1].trim();
        continue;
      }
      const deployedAt = line.match(/^Deployed:\s+(.+)$/);
      if (deployedAt && section === "none") {
        lastDeployTime = deployedAt[1].trim();
        continue;
      }
      const headerTagMatch = line.match(/^Tag:\s+@?(\S+)$/);
      if (headerTagMatch && section === "none") {
        if (!tags.includes(headerTagMatch[1])) tags.push(headerTagMatch[1]);
        continue;
      }

      // "<name> - <date> - <who>" rows inside the Changes/Tag sections.
      const row = line.match(/^(\S+)\s+-\s+(\S+)\s+-\s+(.+)$/);
      if (row && section === "changes") {
        deployed.push({
          name: row[1],
          changeId: "",
          deployedAt: row[2],
          deployedBy: row[3].trim(),
          tags: [],
          note: "",
          requires: [],
          conflicts: [],
        });
        continue;
      }
      if (row && section === "tags") {
        // Sqitch does not say which change a tag belongs to here, so tags are
        // reported at the status level; the plan is the source of truth for the
        // tag -> change association.
        const tagName = row[1].replace(/^@/, "");
        if (!tags.includes(tagName)) tags.push(tagName);
      }
      continue;
    }

    // Non-comment lines: the undeployed list and trailing summary.
    if (/^Undeployed changes?:$/.test(line)) {
      section = "undeployed";
      continue;
    }
    if (section === "undeployed") {
      const bullet = line.match(/^\*\s+(\S+)$/);
      if (bullet) pending.push(bullet[1]);
    }
  }

  // Sqitch lists changes newest-first; present them in deployment order.
  deployed.reverse();

  const lastDeployed = deployed[deployed.length - 1];

  return {
    target,
    engine: engineFromTarget(target),
    deployed,
    pending,
    lastChange: lastChange || lastDeployed?.name || "",
    lastTag: tags,
    lastDeployTime: lastDeployTime || lastDeployed?.deployedAt || "",
    project,
  };
}
