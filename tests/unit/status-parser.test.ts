import { describe, expect, it } from "vitest";
import { parseStatusOutput } from "../../src/lib/status-parser";

const STATUS_OUTPUT = `On database mydb
Deployed changes:
  appschema - 2024-01-15T10:00:00Z - Marge <marge@example.com>
    Change: abc123def456
    Note: Add schema for all flipr objects
    Tags: @v1.0.0
    Requires:
    Conflicts:
  users - 2024-01-15T10:30:00Z - Marge <marge@example.com>
    Change: def789ghi012
    Note: Creates table to track our users
    Tags:
    Requires: appschema
    Conflicts:
  emails - 2024-01-16T09:00:00Z - Marge <marge@example.com>
    Change: jkl345mno678
    Note: Add emails table
    Tags: @v1.0.0
    Requires: users
    Conflicts:
Undeployed changes:
  orders
  payments
Last deployed: 2024-01-16T09:00:00Z
Engine: pg`;

describe("parseStatusOutput", () => {
  it("parses target name", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.target).toBe("mydb");
  });

  it("parses engine", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.engine).toBe("pg");
  });

  it("parses deployed changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.deployed).toHaveLength(3);
  });

  it("parses deployed change fields", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const users = result.deployed.find((c) => c.name === "users");
    expect(users).toBeDefined();
    expect(users!.changeId).toBe("def789ghi012");
    expect(users!.deployedBy).toBe("Marge <marge@example.com>");
    expect(users!.note).toBe("Creates table to track our users");
    expect(users!.requires).toEqual(["appschema"]);
  });

  it("parses tags on deployed changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const appschema = result.deployed.find((c) => c.name === "appschema");
    expect(appschema!.tags).toEqual(["v1.0.0"]);
  });

  it("parses pending (undeployed) changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.pending).toEqual(["orders", "payments"]);
  });

  it("parses lastChange", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.lastChange).toBe("emails");
  });

  it("parses lastDeployTime", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.lastDeployTime).toBe("2024-01-16T09:00:00Z");
  });

  it("handles empty status", () => {
    const result = parseStatusOutput("");
    expect(result.deployed).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it("parses deployedBy with angle brackets", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const appschema = result.deployed.find((c) => c.name === "appschema");
    expect(appschema!.deployedBy).toBe("Marge <marge@example.com>");
  });
});
