import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProjectLayout, scriptPathFor } from "../../electron/services/project-layout";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "unsqitch-layout-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeConf(contents: string) {
  fs.writeFileSync(path.join(dir, "sqitch.conf"), contents);
}

describe("resolveProjectLayout", () => {
  it("defaults to the project root when there is no sqitch.conf", () => {
    const layout = resolveProjectLayout(dir);
    expect(layout.topDir).toBe(path.resolve(dir));
    expect(layout.planFile).toBe(path.join(dir, "sqitch.plan"));
    expect(layout.deployDir).toBe(path.join(dir, "deploy"));
  });

  it("honors core.top_dir (regression: emojied uses top_dir = sql)", () => {
    writeConf("[core]\n  engine = pg\n  top_dir = sql\n");
    const layout = resolveProjectLayout(dir);
    expect(layout.topDir).toBe(path.join(dir, "sql"));
    expect(layout.planFile).toBe(path.join(dir, "sql", "sqitch.plan"));
    expect(layout.deployDir).toBe(path.join(dir, "sql", "deploy"));
    expect(layout.revertDir).toBe(path.join(dir, "sql", "revert"));
    expect(layout.verifyDir).toBe(path.join(dir, "sql", "verify"));
  });

  it("ignores commented-out settings", () => {
    writeConf("[core]\n  top_dir = sql\n  # plan_file = somewhere/else.plan\n");
    expect(resolveProjectLayout(dir).planFile).toBe(path.join(dir, "sql", "sqitch.plan"));
  });

  it("honors an explicit core.plan_file", () => {
    writeConf("[core]\n  top_dir = sql\n  plan_file = sql/custom.plan\n");
    expect(resolveProjectLayout(dir).planFile).toBe(path.join(dir, "sql", "custom.plan"));
  });

  it("only reads keys from the [core] section", () => {
    writeConf('[engine "pg"]\n  top_dir = wrong\n[core]\n  top_dir = sql\n');
    expect(resolveProjectLayout(dir).topDir).toBe(path.join(dir, "sql"));
  });

  it("strips quotes around values", () => {
    writeConf('[core]\n  top_dir = "sql"\n');
    expect(resolveProjectLayout(dir).topDir).toBe(path.join(dir, "sql"));
  });
});

describe("scriptPathFor", () => {
  it("resolves each script kind under top_dir", () => {
    writeConf("[core]\n  top_dir = sql\n");
    expect(scriptPathFor(dir, "links", "deploy")).toBe(path.join(dir, "sql/deploy/links.sql"));
    expect(scriptPathFor(dir, "links", "revert")).toBe(path.join(dir, "sql/revert/links.sql"));
    expect(scriptPathFor(dir, "links", "verify")).toBe(path.join(dir, "sql/verify/links.sql"));
  });
});
