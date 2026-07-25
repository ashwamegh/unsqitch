import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfigList } from "../../src/lib/config-parser";
import { parseLogOutput } from "../../src/lib/log-parser";
import { parsePlanFile } from "../../src/lib/plan-parser";
import { parseSqitchOutput } from "../../src/lib/sqitch-parser";
import { parseStatusOutput } from "../../src/lib/status-parser";

const fixturesDir = resolve(__dirname, "../fixtures");

function readFixture(...parts: string[]): string {
  return readFileSync(resolve(fixturesDir, ...parts), "utf-8");
}

describe("fixture validation", () => {
  describe("plan parser", () => {
    it("parses sqitch.plan fixture", () => {
      const content = readFixture("test-project", "sqitch.plan");
      const result = parsePlanFile(content);

      expect(result.pragmas["syntax-version"]).toBe("1.0.0");
      expect(result.pragmas.project).toBe("test-project");
      expect(result.pragmas.uri).toBe("https://github.com/example/test-project");

      expect(result.changes).toHaveLength(3);
      expect(result.changes[0].name).toBe("appschema");
      expect(result.changes[0].requires).toEqual([]);
      expect(result.changes[1].name).toBe("users");
      expect(result.changes[1].requires).toEqual(["appschema"]);
      expect(result.changes[2].name).toBe("orders");
      expect(result.changes[2].requires).toEqual(["users"]);
      // The fixture project must stay deployable by real sqitch, so it declares no
      // conflicts (conflict parsing is covered by plan-parser tests).
      expect(result.changes[2].conflicts).toEqual([]);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].name).toBe("v1.0.0");

      expect(result.unparseableLines).toHaveLength(0);
    });

    it("parses plan.txt fixture with tag", () => {
      const content = readFixture("sqitch-output", "plan.txt");
      const result = parsePlanFile(content);

      expect(result.changes).toHaveLength(2);
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].name).toBe("v1.0.0");
      expect(result.unparseableLines).toHaveLength(0);
    });
  });

  describe("config parser", () => {
    it("parses config.txt fixture", () => {
      const content = readFixture("sqitch-output", "config.txt");
      const result = parseConfigList(content);

      expect(result).toContainEqual({
        section: "core",
        key: "engine",
        value: "pg",
      });
      expect(result).toContainEqual({
        section: "core",
        key: "top_dir",
        value: ".",
      });
      expect(result).toContainEqual({
        section: "core",
        key: "plan_file",
        value: "sqitch.plan",
      });
      expect(
        result.find((e) => e.section === "engine" && e.subsection === "pg" && e.key === "target")
          ?.value,
      ).toContain("db:pg://");
    });
  });

  describe("sqitch output parser", () => {
    it("parses deploy.txt fixture (dot-padded names and a tagged change)", () => {
      const result = parseSqitchOutput(readFixture("sqitch-output", "deploy.txt"));

      expect(result.events.map((e) => e.change)).toEqual(["appschema", "users", "orders"]);
      expect(result.events.every((e) => e.type === "deploy")).toBe(true);
      expect(result.events.every((e) => e.status === "ok")).toBe(true);
    });

    it("parses revert.txt fixture", () => {
      const result = parseSqitchOutput(readFixture("sqitch-output", "revert.txt"));

      expect(result.events.map((e) => e.change)).toEqual(["orders", "users", "appschema"]);
      expect(result.events.every((e) => e.type === "revert")).toBe(true);
    });

    it("parses verify.txt fixture", () => {
      const result = parseSqitchOutput(readFixture("sqitch-output", "verify.txt"));

      expect(result.events.map((e) => e.change)).toEqual(["appschema", "users", "orders"]);
      expect(result.events.every((e) => e.type === "verify")).toBe(true);
    });
  });

  describe("status parser", () => {
    // These fixtures are real `sqitch status` captures against a Dockerised
    // PostgreSQL, so they exercise the "# "-prefixed format sqitch emits.
    it("parses the up-to-date status.txt fixture", () => {
      const result = parseStatusOutput(readFixture("sqitch-output", "status.txt"));

      expect(result.target).toContain("db:pg://");
      expect(result.engine).toBe("pg");
      expect(result.project).toBe("test-project");
      expect(result.deployed.map((c) => c.name)).toEqual(["appschema", "users", "orders"]);
      expect(result.deployed[0].deployedBy).toContain("<");
      expect(result.pending).toEqual([]);
      expect(result.lastChange).toBe("orders");
      expect(result.lastTag).toEqual(["v1.0.0"]);
    });

    it("parses the partially deployed status-partial.txt fixture", () => {
      const result = parseStatusOutput(readFixture("sqitch-output", "status-partial.txt"));

      expect(result.deployed.map((c) => c.name)).toEqual(["appschema", "users"]);
      expect(result.pending).toEqual(["orders"]);
    });
  });

  describe("log parser", () => {
    it("parses log.txt fixture (newest first, deploy and revert events)", () => {
      const result = parseLogOutput(readFixture("sqitch-output", "log.txt"));

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((e) => e.change !== "")).toBe(true);
      expect(result.every((e) => /^[0-9a-f]{6,40}$/.test(e.changeId))).toBe(true);
      expect(result.every((e) => e.action === "deploy" || e.action === "revert")).toBe(true);
      expect(result.some((e) => e.action === "deploy")).toBe(true);
      expect(result[0].committer.name).not.toBe("");
      expect(result[0].timestamp).not.toBe("");
    });
  });
});
