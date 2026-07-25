import { describe, expect, it } from "vitest";
import { classifyError, createAppError } from "../../src/types/error";

describe("classifyError", () => {
  it("detects database connection failures", () => {
    expect(classifyError("could not connect to server: Connection refused", 1)).toBe(
      "db_connection",
    );
    expect(classifyError("password authentication failed for user", 1)).toBe("db_connection");
    expect(classifyError('database "app" does not exist', 1)).toBe("db_connection");
  });

  it("detects file permission errors", () => {
    expect(classifyError("open sqitch.plan: permission denied", 1)).toBe("file_permission");
  });

  it("detects a missing binary", () => {
    expect(classifyError("/bin/sh: sqitch: command not found", 127)).toBe("binary_not_found");
  });

  it("detects partial/blocked deploy conditions", () => {
    expect(classifyError('Cannot revert change "users": requires "emails" to be deployed', 1)).toBe(
      "partial_deployment",
    );
  });

  it("falls back to sqitch_crash on a generic non-zero exit", () => {
    expect(classifyError("some unexpected sqitch output", 2)).toBe("sqitch_crash");
  });

  it("returns unknown when nothing matches and exit code is clean", () => {
    expect(classifyError("", 0)).toBe("unknown");
  });

  it("maps each type to recovery actions via createAppError", () => {
    expect(createAppError("db_connection", "x").actions.map((a) => a.action)).toContain(
      "check_connection",
    );
    expect(createAppError("binary_not_found", "x").recoverable).toBe(false);
  });
});
