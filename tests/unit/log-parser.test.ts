import { describe, expect, it } from "vitest";
import { parseLogOutput } from "../../src/lib/log-parser";

// Captured from `sqitch log <target> --date-format raw` (sqitch 1.6.1).
// One block per event, newest first, with the note as an indented paragraph.
const LOG_OUTPUT = `On database db:pg://sqitch@localhost:54231/sqitch_test
Revert ed042459e67b75f039d9d33e1297e44a2bf462d2
Name:      orders
Committer: System Administrator <root@host.local>
Date:      2026-07-25T15:03:27Z

    Creates orders table.

Deploy ed042459e67b75f039d9d33e1297e44a2bf462d2
Name:      orders
Committer: System Administrator <root@host.local>
Date:      2026-07-25T15:02:57Z

    Creates orders table.

Deploy ac8858ba8264f6776ecac405b79a05203d589937
Name:      users
Committer: System Administrator <root@host.local>
Date:      2026-07-25T15:02:57Z

    Creates users table.
`;

describe("parseLogOutput", () => {
  it("parses one entry per event block", () => {
    expect(parseLogOutput(LOG_OUTPUT)).toHaveLength(3);
  });

  it("parses the revert action from the block header", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].action).toBe("revert");
    expect(result[0].change).toBe("orders");
  });

  it("parses the deploy action", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[1].action).toBe("deploy");
    expect(result[1].change).toBe("orders");
  });

  it("parses the change id from the block header", () => {
    expect(parseLogOutput(LOG_OUTPUT)[0].changeId).toBe("ed042459e67b75f039d9d33e1297e44a2bf462d2");
  });

  it("parses the committer name and email", () => {
    expect(parseLogOutput(LOG_OUTPUT)[0].committer).toEqual({
      name: "System Administrator",
      email: "root@host.local",
    });
  });

  it("parses the timestamp", () => {
    expect(parseLogOutput(LOG_OUTPUT)[0].timestamp).toBe("2026-07-25T15:03:27Z");
  });

  it("parses the indented note paragraph", () => {
    expect(parseLogOutput(LOG_OUTPUT)[0].note).toBe("Creates orders table.");
  });

  it("treats a Fail event as a deploy attempt", () => {
    const failed = `Fail abc123def4567890abc123def4567890abc123de
Name:      orders
Committer: Someone <s@example.com>
Date:      2026-07-25T15:10:00Z

    Broke.
`;
    const result = parseLogOutput(failed);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("deploy");
    expect(result[0].change).toBe("orders");
  });

  it("does not treat the 'On database' line as an entry", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result.every((e) => e.change !== "")).toBe(true);
  });

  it("handles empty output", () => {
    expect(parseLogOutput("")).toEqual([]);
  });
});
