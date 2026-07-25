import { beforeAll, describe, expect, it } from "vitest";
import { detectSqitchBinary } from "../../electron/services/binary-detector";
import { SqitchService } from "../../electron/services/sqitch.service";
import { parsePlanFile } from "../../src/lib/plan-parser";
import { parseStatusOutput } from "../../src/lib/status-parser";

const TARGET = process.env.TEST_TARGET || "db:pg://sqitch:sqitch@localhost:54231/sqitch_test";

describe.skipIf(!process.env.RUN_INTEGRATION)("SqitchService integration", () => {
  let sqitch: SqitchService;
  const projectPath = process.env.TEST_PROJECT_PATH || "/tmp/unsqitch-test-project";

  beforeAll(() => {
    const binary = detectSqitchBinary();
    if (!binary) throw new Error("sqitch not found — install sqitch or set RUN_INTEGRATION=0");
    sqitch = new SqitchService(binary);
  });

  it("detects sqitch binary", () => {
    expect(detectSqitchBinary()).toBeTruthy();
  });

  it("runs sqitch status and parses the real output", async () => {
    const result = await sqitch.status(projectPath, TARGET, 30000);

    // `sqitch status` exits 1 when the project has nothing deployed yet, which is
    // a normal state for a fresh database (CI starts from an empty one) — the
    // service tolerates it, so anything else is a genuine failure.
    expect([0, 1]).toContain(result.exitCode);

    const status = parseStatusOutput(result.stdout);
    expect(status.target).toContain("db:pg://");
    // Whatever the deployment state, the plan's changes must be accounted for as
    // either deployed or pending — this is what the Status view relies on.
    const accounted = [...status.deployed.map((c) => c.name), ...status.pending];
    if (accounted.length > 0) {
      expect(accounted).toContain("appschema");
    }
  }, 60000);

  it("runs sqitch plan", async () => {
    const result = await sqitch.plan(projectPath, 30000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");
  }, 60000);

  it("deploys, verifies and reverts the fixture project end to end", async () => {
    // Start from a known state: revert anything already deployed.
    await sqitch.revert(projectPath, TARGET, undefined, 60000).catch(() => {
      // Nothing deployed yet — that is the state we want.
    });

    const deploy = await sqitch.deploy(projectPath, TARGET, undefined, 120000);
    expect(deploy.exitCode).toBe(0);

    const planned = parsePlanFile(
      await import("node:fs").then((fs) => fs.readFileSync(`${projectPath}/sqitch.plan`, "utf-8")),
    ).changes.map((c) => c.name);

    const status = parseStatusOutput((await sqitch.status(projectPath, TARGET, 30000)).stdout);
    expect(status.deployed.map((c) => c.name)).toEqual(planned);
    expect(status.pending).toEqual([]);

    const verify = await sqitch.verify(projectPath, TARGET, 60000);
    expect(verify.exitCode).toBe(0);

    const revert = await sqitch.revert(projectPath, TARGET, undefined, 60000);
    expect(revert.exitCode).toBe(0);

    const after = parseStatusOutput((await sqitch.status(projectPath, TARGET, 30000)).stdout);
    expect(after.deployed).toEqual([]);
  }, 180000);
});
