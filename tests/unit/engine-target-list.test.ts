import { describe, expect, it, vi } from "vitest";
import { EngineService } from "../../electron/services/engine.service";
import type { SqitchService } from "../../electron/services/sqitch.service";
import { TargetService } from "../../electron/services/target.service";

function stubSqitch(stdout: string) {
  const runCommand = vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode: 0 });
  return { runCommand } as unknown as SqitchService & { runCommand: typeof runCommand };
}

describe("EngineService.list", () => {
  it("requests --verbose so the target is included", async () => {
    const sqitch = stubSqitch("pg\tdb:pg://sqitch@localhost:54231/sqitch_test\n");
    await new EngineService(sqitch).list("/project");
    expect(sqitch.runCommand).toHaveBeenCalledWith(["engine", "list", "--verbose"], "/project");
  });

  it("parses the real tab-separated verbose output", () => {
    const service = new EngineService(stubSqitch(""));
    const engines = service.parseEngineList("pg\tdb:pg://sqitch@localhost:54231/sqitch_test\n");
    expect(engines).toEqual([{ name: "pg", target: "db:pg://sqitch@localhost:54231/sqitch_test" }]);
  });

  it("still lists an engine when only the name is printed", () => {
    // `sqitch engine list` without --verbose prints just the name; a bare name
    // used to be dropped entirely, leaving the Engine view empty.
    const service = new EngineService(stubSqitch(""));
    expect(service.parseEngineList("pg\n")).toEqual([{ name: "pg", target: "" }]);
  });

  it("ignores blank lines", () => {
    const service = new EngineService(stubSqitch(""));
    expect(service.parseEngineList("\n\n")).toEqual([]);
  });
});

describe("TargetService.list", () => {
  it("requests --verbose so the URI is included", async () => {
    const sqitch = stubSqitch("staging\tdb:pg://sqitch@localhost:54231/sqitch_test\n");
    await new TargetService(sqitch).list("/project");
    expect(sqitch.runCommand).toHaveBeenCalledWith(["target", "list", "--verbose"], "/project");
  });

  it("parses the real tab-separated verbose output", () => {
    const service = new TargetService(stubSqitch(""));
    expect(service.parseTargetList("staging\tdb:pg://h/s\nprod\tdb:pg://h/p\n")).toEqual([
      { name: "staging", uri: "db:pg://h/s" },
      { name: "prod", uri: "db:pg://h/p" },
    ]);
  });

  it("still lists a target when only the name is printed", () => {
    const service = new TargetService(stubSqitch(""));
    expect(service.parseTargetList("staging\n")).toEqual([{ name: "staging", uri: "" }]);
  });
});

describe("command shapes verified against the real CLI", () => {
  it("target add passes the URI positionally (--uri is a usage error)", async () => {
    const sqitch = stubSqitch("");
    await new TargetService(sqitch).add("/project", "staging", "db:pg://h/s");
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ["target", "add", "staging", "db:pg://h/s"],
      "/project",
    );
  });

  it("engine add passes the URI via --target", async () => {
    const sqitch = stubSqitch("");
    await new EngineService(sqitch).add("/project", "pg", "db:pg://h/s");
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ["engine", "add", "pg", "--target", "db:pg://h/s"],
      "/project",
    );
  });
});
