import { describe, it, expect } from "vitest";
import { parseSqitchOutput } from "../../src/lib/sqitch-parser";

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
