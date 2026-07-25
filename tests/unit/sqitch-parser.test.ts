import { describe, expect, it } from "vitest";
import { coalesceEvents, parseSqitchOutput } from "../../src/lib/sqitch-parser";
import type { SqitchEvent } from "../../src/types/sqitch-event";

const DEPLOY_OUTPUT = `Deploying changes to db:pg://localhost/mydb
  + appschema  .. ok
  + users      .. ok
  + emails     .. ok
  + @v1.0.0    .. ok`;

const REVERT_OUTPUT = `Reverting changes from db:pg://localhost/mydb
  - emails     .. ok
  - users      .. ok`;

const VERIFY_OUTPUT = `Verifying changes to db:pg://localhost/mydb
  * appschema  .. ok
  * users      .. ok
  * emails     .. not ok`;

const MIXED_OUTPUT = `Deploying changes to db:pg://localhost/mydb
  + appschema  .. ok
  + users      .. FAILED
  + emails     .. ok`;

const HEADER_LINES = `Deploying change users to mydb
Reverting change emails from mydb
Verifying change appschema`;

describe("parseSqitchOutput", () => {
  it("parses deploy events", () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.events).toHaveLength(4);
    expect(result.events[0]).toMatchObject({
      type: "deploy",
      change: "appschema",
      status: "ok",
      rawLine: "  + appschema  .. ok",
    });
  });

  it("parses revert events", () => {
    const result = parseSqitchOutput(REVERT_OUTPUT);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe("revert");
    expect(result.events[0].change).toBe("emails");
  });

  it("parses verify events", () => {
    const result = parseSqitchOutput(VERIFY_OUTPUT);
    expect(result.events).toHaveLength(3);
    expect(result.events[0].type).toBe("verify");
    expect(result.events[2].change).toBe("emails");
    expect(result.events[2].status).toBe("not_ok");
  });

  it('parses FAILED status as "failed"', () => {
    const result = parseSqitchOutput(MIXED_OUTPUT);
    const failed = result.events.find((e) => e.change === "users");
    expect(failed!.status).toBe("failed");
  });

  it("extracts target from header lines", () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.events[0].target).toBe("db:pg://localhost/mydb");
  });

  it('extracts change name from "Deploying change X to Y"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[0]).toMatchObject({
      type: "deploy",
      change: "users",
      target: "mydb",
    });
  });

  it('extracts from "Reverting change X from Y"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[1]).toMatchObject({
      type: "revert",
      change: "emails",
      target: "mydb",
    });
  });

  it('extracts from "Verifying change X"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[2]).toMatchObject({
      type: "verify",
      change: "appschema",
    });
  });

  it("handles empty output", () => {
    const result = parseSqitchOutput("");
    expect(result.events).toEqual([]);
  });

  it("preserves raw output", () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.rawOutput).toBe(DEPLOY_OUTPUT);
  });
});

describe("coalesceEvents", () => {
  it("collapses a running header + completed line into one row per change", () => {
    // Simulates the incremental stream: header ("running") then the result line.
    const events = parseSqitchOutput("Deploying change users to mydb\n  + users .. ok").events;
    const coalesced = coalesceEvents(events);
    expect(coalesced).toHaveLength(1);
    expect(coalesced[0]).toMatchObject({ change: "users", status: "ok" });
  });

  it("keeps a change as running until its result line arrives", () => {
    const events = parseSqitchOutput("Deploying change users to mydb").events;
    const coalesced = coalesceEvents(events);
    expect(coalesced).toHaveLength(1);
    expect(coalesced[0]).toMatchObject({ change: "users", status: "running" });
  });

  it("never downgrades a finished change back to running", () => {
    const events: SqitchEvent[] = [
      { type: "deploy", change: "users", status: "ok", rawLine: "" },
      { type: "deploy", change: "users", status: "running", rawLine: "" },
    ];
    expect(coalesceEvents(events)[0].status).toBe("ok");
  });

  it("preserves an earlier target when a later line omits it", () => {
    const events: SqitchEvent[] = [
      { type: "deploy", change: "users", target: "mydb", status: "running", rawLine: "" },
      { type: "deploy", change: "users", status: "ok", rawLine: "" },
    ];
    expect(coalesceEvents(events)[0]).toMatchObject({ target: "mydb", status: "ok" });
  });

  it("preserves distinct changes in first-seen order", () => {
    const coalesced = coalesceEvents(parseSqitchOutput(DEPLOY_OUTPUT).events);
    expect(coalesced.map((e) => e.change)).toEqual(["appschema", "users", "emails", "@v1.0.0"]);
  });
});
