import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSqitchVersion, detectSqitchBinary } from "../../electron/services/binary-detector";

/**
 * These mock spawnSync, not execSync, because the detector must never build a shell
 * command string: the sqitch path comes from the Settings dialog, so an interpolated
 * value containing a quote could close the quoting and run arbitrary commands.
 * The assertions below check the argument array as well as the result.
 */
vi.mock("node:child_process", () => {
  const spawnSync = vi.fn();
  return {
    default: { spawnSync },
    spawnSync,
  };
});

import { spawnSync } from "node:child_process";

const mock = () => spawnSync as ReturnType<typeof vi.fn>;
const succeedsWith = (stdout: string) => mock().mockReturnValue({ status: 0, stdout });
const fails = () => mock().mockReturnValue({ status: 1, stdout: "", error: new Error("ENOENT") });

describe("detectSqitchBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns path when sqitch is found", () => {
    succeedsWith("/usr/local/bin/sqitch\n");
    expect(detectSqitchBinary()).toBe("/usr/local/bin/sqitch");
  });

  it("looks the binary up with an argument array rather than a shell string", () => {
    succeedsWith("/usr/local/bin/sqitch\n");
    detectSqitchBinary();
    const [command, args, options] = mock().mock.calls[0];
    expect([command, args]).toEqual([process.platform === "win32" ? "where" : "which", ["sqitch"]]);
    expect(options?.shell).toBeFalsy();
  });

  it("returns null when sqitch is not found", () => {
    fails();
    expect(detectSqitchBinary()).toBeNull();
  });

  it("returns null when the lookup succeeds but prints nothing", () => {
    succeedsWith("\n");
    expect(detectSqitchBinary()).toBeNull();
  });

  it("uses custom path when provided", () => {
    succeedsWith("sqitch 1.6.1\n");
    expect(detectSqitchBinary("/custom/sqitch")).toBe("/custom/sqitch");
  });

  it("passes a custom path as an argv entry, never interpolated into a command", () => {
    succeedsWith("sqitch 1.6.1\n");
    // A path like this would break out of `execSync(`"${path}" --version`)`.
    const hostile = '/tmp/sqitch" ; touch /tmp/pwned ; echo "';
    detectSqitchBinary(hostile);
    const [command, args, options] = mock().mock.calls[0];
    expect(command).toBe(hostile);
    expect(args).toEqual(["--version"]);
    expect(options?.shell).toBeFalsy();
  });

  it("returns null when a custom path cannot be executed", () => {
    fails();
    expect(detectSqitchBinary("/nope/sqitch")).toBeNull();
  });
});

describe("checkSqitchVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts semver from sqitch --version output", () => {
    succeedsWith("sqitch 1.3.1\n");
    expect(checkSqitchVersion("/usr/local/bin/sqitch")).toEqual({
      version: "1.3.1",
      meetsMinimum: true,
    });
  });

  it("returns meetsMinimum false for old versions", () => {
    succeedsWith("sqitch 0.999.0\n");
    expect(checkSqitchVersion("/usr/local/bin/sqitch")).toEqual({
      version: "0.999.0",
      meetsMinimum: false,
    });
  });

  it("returns null when version check fails", () => {
    fails();
    expect(checkSqitchVersion("/usr/local/bin/sqitch")).toBeNull();
  });

  it("returns null when the output carries no version number", () => {
    succeedsWith("sqitch: command not understood\n");
    expect(checkSqitchVersion("/usr/local/bin/sqitch")).toBeNull();
  });
});
