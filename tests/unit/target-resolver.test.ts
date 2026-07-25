import { describe, expect, it } from "vitest";
import { parseSqitchConf, resolveTargets } from "../../electron/services/target-resolver";
import { parseConfigList } from "../../src/lib/config-parser";

const EMOJIED_CONF = `[core]
  engine = pg
  top_dir = sql
  # plan_file = sql/sqitch.plan

[engine "pg"]
  target = db:pg:emojied_development
  # client = psql
[deploy]
  verify = true
`;

describe("parseSqitchConf", () => {
  it("parses sections, subsections and values", () => {
    const entries = parseSqitchConf(EMOJIED_CONF);
    expect(entries).toContainEqual({
      section: "core",
      subsection: undefined,
      key: "engine",
      value: "pg",
    });
    expect(entries).toContainEqual({
      section: "engine",
      subsection: "pg",
      key: "target",
      value: "db:pg:emojied_development",
    });
  });

  it("ignores comments", () => {
    const entries = parseSqitchConf(EMOJIED_CONF);
    expect(entries.some((e) => e.key === "plan_file")).toBe(false);
    expect(entries.some((e) => e.key === "client")).toBe(false);
  });
});

describe("resolveTargets", () => {
  it("uses the configured engine's target as the default (emojied case)", () => {
    const resolved = resolveTargets(parseSqitchConf(EMOJIED_CONF));
    expect(resolved.engine).toBe("pg");
    expect(resolved.defaultTarget).toBe("db:pg:emojied_development");
    expect(resolved.targets[0]).toMatchObject({ name: "db:pg:emojied_development" });
  });

  it("prefers core.target over the engine target", () => {
    const conf = '[core]\n engine = pg\n target = prod\n[engine "pg"]\n target = dev\n';
    expect(resolveTargets(parseSqitchConf(conf)).defaultTarget).toBe("prod");
  });

  it("lists named targets from target.<name>.uri", () => {
    const conf =
      '[core]\n engine = pg\n[target "staging"]\n uri = db:pg://h/s\n[target "prod"]\n uri = db:pg://h/p\n';
    const resolved = resolveTargets(parseSqitchConf(conf));
    expect(resolved.targets.map((t) => t.name).sort()).toEqual(["prod", "staging"]);
  });

  it("does not duplicate the default when it is also a named target", () => {
    const conf =
      '[core]\n engine = pg\n target = staging\n[target "staging"]\n uri = db:pg://h/s\n';
    const resolved = resolveTargets(parseSqitchConf(conf));
    expect(resolved.targets.filter((t) => t.name === "staging")).toHaveLength(1);
  });

  it("works on flat `sqitch config --list` output too", () => {
    const listed = "core.engine=pg\nengine.pg.target=db:pg:emojied_development\n";
    const resolved = resolveTargets(parseConfigList(listed));
    expect(resolved.defaultTarget).toBe("db:pg:emojied_development");
  });

  it("returns nothing determinable for an empty config", () => {
    const resolved = resolveTargets([]);
    expect(resolved.defaultTarget).toBeUndefined();
    expect(resolved.targets).toEqual([]);
  });
});
