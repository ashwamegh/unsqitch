import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSqitchVersion, detectSqitchBinary } from "../../electron/services/binary-detector";

vi.mock("node:child_process", () => {
  const execSync = vi.fn();
  return {
    default: { execSync },
    execSync,
  };
});

import { execSync } from "node:child_process";

describe("detectSqitchBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns path when sqitch is found", () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue("/usr/local/bin/sqitch\n");
    const result = detectSqitchBinary();
    expect(result).toBe("/usr/local/bin/sqitch");
  });

  it("returns null when sqitch is not found", () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("not found");
    });
    const result = detectSqitchBinary();
    expect(result).toBeNull();
  });

  it("uses custom path when provided", () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue("/custom/sqitch\n");
    const result = detectSqitchBinary("/custom/sqitch");
    expect(result).toBe("/custom/sqitch");
  });
});

describe("checkSqitchVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts semver from sqitch --version output", () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue("sqitch 1.3.1\n");
    const result = checkSqitchVersion("/usr/local/bin/sqitch");
    expect(result).toEqual({ version: "1.3.1", meetsMinimum: true });
  });

  it("returns meetsMinimum false for old versions", () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue("sqitch 0.999.0\n");
    const result = checkSqitchVersion("/usr/local/bin/sqitch");
    expect(result).toEqual({ version: "0.999.0", meetsMinimum: false });
  });

  it("returns null when version check fails", () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("exec failed");
    });
    const result = checkSqitchVersion("/usr/local/bin/sqitch");
    expect(result).toBeNull();
  });
});
