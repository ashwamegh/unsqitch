import { describe, expect, it } from "vitest";
import { parseStatusOutput } from "../../src/lib/status-parser";

// Captured from `sqitch status <target> --show-changes --show-tags
// --date-format raw` (sqitch 1.6.1, PostgreSQL 16). Every informational line is
// "# "-prefixed and changes are listed newest-first.
const STATUS_UP_TO_DATE = `# On database db:pg://sqitch@localhost:54231/sqitch_test
# Project:  test-project
# Change:   ed042459e67b75f039d9d33e1297e44a2bf462d2
# Name:     orders
# Deployed: 2026-07-25T15:06:29Z
# By:       System Administrator <root@host.local>
#
# Changes:
#   orders    - 2026-07-25T15:06:29Z - System Administrator <root@host.local>
#   users     - 2026-07-25T15:06:29Z - System Administrator <root@host.local>
#   appschema - 2026-07-25T15:06:29Z - System Administrator <root@host.local>
#
# Tag:
#   @v1.0.0 - 2026-07-25T15:06:29Z - System Administrator <root@host.local>
#
Nothing to deploy (up-to-date)`;

const STATUS_PENDING = `# On database db:pg://sqitch@localhost:54231/sqitch_test
# Project:  test-project
# Change:   ac8858ba8264f6776ecac405b79a05203d589937
# Name:     users
# Tag:      @v1.0.0
# Deployed: 2026-07-25T15:02:57Z
# By:       System Administrator <root@host.local>
#
# Changes:
#   users     - 2026-07-25T15:02:57Z - System Administrator <root@host.local>
#   appschema - 2026-07-25T15:02:57Z - System Administrator <root@host.local>
#
Undeployed change:
  * orders`;

const STATUS_MULTI_PENDING = `# On database db:pg://sqitch@localhost:54231/sqitch_test
# Project:  test-project
#
# Changes:
#   appschema - 2026-07-25T15:02:57Z - System Administrator <root@host.local>
#
Undeployed changes:
  * users
  * orders`;

describe("parseStatusOutput", () => {
  it("parses the target URI", () => {
    expect(parseStatusOutput(STATUS_UP_TO_DATE).target).toBe(
      "db:pg://sqitch@localhost:54231/sqitch_test",
    );
  });

  it("infers the engine from the target URI (sqitch does not print it)", () => {
    expect(parseStatusOutput(STATUS_UP_TO_DATE).engine).toBe("pg");
  });

  it("parses the project name", () => {
    expect(parseStatusOutput(STATUS_UP_TO_DATE).project).toBe("test-project");
  });

  it("parses deployed changes in deployment order (sqitch lists newest first)", () => {
    const result = parseStatusOutput(STATUS_UP_TO_DATE);
    expect(result.deployed.map((c) => c.name)).toEqual(["appschema", "users", "orders"]);
  });

  it("parses each deployed change's timestamp and deployer", () => {
    const result = parseStatusOutput(STATUS_UP_TO_DATE);
    const users = result.deployed.find((c) => c.name === "users");
    expect(users).toBeDefined();
    expect(users?.deployedAt).toBe("2026-07-25T15:06:29Z");
    expect(users?.deployedBy).toBe("System Administrator <root@host.local>");
  });

  it("parses tags from the Tag section", () => {
    expect(parseStatusOutput(STATUS_UP_TO_DATE).lastTag).toEqual(["v1.0.0"]);
  });

  it("reports no pending changes when up to date", () => {
    expect(parseStatusOutput(STATUS_UP_TO_DATE).pending).toEqual([]);
  });

  it("parses a single undeployed change", () => {
    const result = parseStatusOutput(STATUS_PENDING);
    expect(result.deployed.map((c) => c.name)).toEqual(["appschema", "users"]);
    expect(result.pending).toEqual(["orders"]);
  });

  it("parses multiple undeployed changes", () => {
    const result = parseStatusOutput(STATUS_MULTI_PENDING);
    expect(result.pending).toEqual(["users", "orders"]);
  });

  it("parses lastChange and lastDeployTime from the header block", () => {
    const result = parseStatusOutput(STATUS_UP_TO_DATE);
    expect(result.lastChange).toBe("orders");
    expect(result.lastDeployTime).toBe("2026-07-25T15:06:29Z");
  });

  it("does not treat the header Tag line as a deployed change", () => {
    const result = parseStatusOutput(STATUS_PENDING);
    expect(result.deployed.some((c) => c.name.startsWith("@"))).toBe(false);
    expect(result.lastTag).toContain("v1.0.0");
  });

  it("handles empty output", () => {
    const result = parseStatusOutput("");
    expect(result.deployed).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it("handles a database with nothing deployed", () => {
    const result = parseStatusOutput(
      "# On database db:pg://sqitch@localhost:54231/sqitch_test\nNo changes deployed",
    );
    expect(result.deployed).toEqual([]);
    expect(result.target).toBe("db:pg://sqitch@localhost:54231/sqitch_test");
  });
});
