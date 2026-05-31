import { describe, it, expect } from "vitest";
import { parsePlanFile } from "../../src/lib/plan-parser";
import type { PlanFile } from "../../src/types/plan";

const BASIC_PLAN = `%syntax-version=1.0.0
%project=my-app
%uri=https://github.com/example/my-app
appschema 2024-01-15T10:00:00Z Marge N. O'Vera <marge@example.com> # Add schema for all flipr objects.
users [appschema] 2024-01-15T10:30:00Z Marge N. O'Vera <marge@example.com> # Creates table to track our users.
@v1.0.0 2024-01-15T11:00:00Z Marge N. O'Vera <marge@example.com> # Tag v1.0.0.
insert_user [users appschema] 2024-01-16T09:00:00Z Marge N. O'Vera <marge@example.com> # Creates a function to insert a user.
new_auth [users !legacy_auth] 2024-01-17T09:00:00Z Marge N. O'Vera <marge@example.com> # New auth, conflicts with legacy.`;

describe("parsePlanFile", () => {
  it("parses pragmas", () => {
    const result = parsePlanFile(BASIC_PLAN);
    expect(result.pragmas).toEqual({
      "syntax-version": "1.0.0",
      project: "my-app",
      uri: "https://github.com/example/my-app",
    });
  });

  it("parses changes with requires", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const users = result.changes.find((c) => c.name === "users");
    expect(users).toBeDefined();
    expect(users!.requires).toEqual(["appschema"]);
    expect(users!.conflicts).toEqual([]);
  });

  it("parses changes with requires and conflicts", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const newAuth = result.changes.find((c) => c.name === "new_auth");
    expect(newAuth).toBeDefined();
    expect(newAuth!.requires).toEqual(["users"]);
    expect(newAuth!.conflicts).toEqual(["legacy_auth"]);
  });

  it("parses changes without dependencies", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const appschema = result.changes.find((c) => c.name === "appschema");
    expect(appschema).toBeDefined();
    expect(appschema!.requires).toEqual([]);
    expect(appschema!.conflicts).toEqual([]);
    expect(appschema!.note).toBe("Add schema for all flipr objects.");
  });

  it("parses tags", () => {
    const result = parsePlanFile(BASIC_PLAN);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe("v1.0.0");
    expect(result.tags[0].note).toBe("Tag v1.0.0.");
  });

  it("preserves entry order in entries array", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const types = result.entries.map((e) => e.type);
    expect(types).toEqual([
      "pragma",
      "pragma",
      "pragma",
      "change",
      "change",
      "tag",
      "change",
      "change",
    ]);
  });

  it("collects changes in order", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const names = result.changes.map((c) => c.name);
    expect(names).toEqual(["appschema", "users", "insert_user", "new_auth"]);
  });

  it("handles empty plan", () => {
    const result = parsePlanFile("");
    expect(result.entries).toEqual([]);
    expect(result.pragmas).toEqual({});
    expect(result.changes).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.unparseableLines).toEqual([]);
  });

  it("tracks unparseable lines", () => {
    const plan = `%syntax-version=1.0.0
this is not valid
appschema 2024-01-15T10:00:00Z Dev <dev@test.com> # A change`;
    const result = parsePlanFile(plan);
    expect(result.unparseableLines).toHaveLength(1);
    expect(result.unparseableLines[0].line).toBe("this is not valid");
    expect(result.unparseableLines[0].index).toBe(1);
  });

  it("parses planner name and email", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const appschema = result.changes.find((c) => c.name === "appschema");
    expect(appschema!.planner).toEqual({
      name: "Marge N. O'Vera",
      email: "marge@example.com",
    });
  });

  it("parses change without note", () => {
    const plan = `appschema 2024-01-15T10:00:00Z Dev <dev@test.com>`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].note).toBe("");
  });

  it("handles change with multiple requires", () => {
    const plan = `mychange [req1 req2 req3] 2024-01-15T10:00:00Z Dev <dev@test.com> # note`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].requires).toEqual(["req1", "req2", "req3"]);
  });

  it("handles change with mixed requires and conflicts", () => {
    const plan = `mychange [req1 !conf1 req2 !conf2] 2024-01-15T10:00:00Z Dev <dev@test.com> # note`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].requires).toEqual(["req1", "req2"]);
    expect(result.changes[0].conflicts).toEqual(["conf1", "conf2"]);
  });
});
