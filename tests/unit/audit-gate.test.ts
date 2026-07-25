import { describe, expect, it } from "vitest";
// @ts-expect-error — plain JS build script, deliberately not part of the TS project
import {
  findExposures,
  parentKey,
  parseLockfile,
  productionClosure,
  resolveEntry,
  satisfies,
} from "../../scripts/lib/audit-core.mjs";

/**
 * The production-dependency audit gate is the thing that fails CI when shipped code has a
 * known vulnerability, so a bug in it is silent by nature: the gate just goes green.
 *
 * These tests exist because a real bug did exactly that — resolveEntry treated the
 * "@scope" of a scoped package as a path segment, so resolving "vite" from
 * "@tailwindcss/vite" matched the requiring package itself. The walk stopped there and
 * vite, postcss and esbuild — the only three shipped packages that had advisories — were
 * never audited, while the gate reported success.
 */

// Mirrors real bun.lock shape: name -> [spec, registry, meta, hash], nested keys allowed.
const LOCK = parseLockfile(`{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "app",
      "dependencies": { "@tailwindcss/vite": "^4.3.0", "shipped-lib": "^1.0.0" },
      "devDependencies": { "builder": "^26.0.0" },
    },
  },
  "packages": {
    "@tailwindcss/vite": ["@tailwindcss/vite@4.3.3", "", { "dependencies": { "vite": "^7.0.0" } }, "sha512-x"],
    "vite": ["vite@7.3.4", "", { "dependencies": { "postcss": "^8.0.0", "minimatch": "^10.0.0" } }, "sha512-x"],
    "postcss": ["postcss@8.5.15", "", {}, "sha512-x"],
    "shipped-lib": ["shipped-lib@1.2.0", "", { "dependencies": { "minimatch": "^3.0.0" } }, "sha512-x"],
    "minimatch": ["minimatch@10.2.5", "", { "dependencies": { "brace-expansion": "^5.0.5" } }, "sha512-x"],
    "brace-expansion": ["brace-expansion@5.0.8", "", {}, "sha512-x"],
    "builder": ["builder@26.15.3", "", { "dependencies": { "tar": "^7.0.0" } }, "sha512-x"],
    "tar": ["tar@7.5.15", "", {}, "sha512-x"],
    "shipped-lib/minimatch": ["minimatch@3.1.5", "", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-x"],
    "shipped-lib/brace-expansion": ["brace-expansion@1.1.12", "", {}, "sha512-x"],
  },
}`);

const SHIPPED_ROOTS = ["@tailwindcss/vite", "shipped-lib"];

describe("bun.lock key handling", () => {
  it("drops one plain segment and two scoped segments", () => {
    expect(parentKey("@electron/asar/minimatch")).toBe("@electron/asar");
    expect(parentKey("@electron/asar")).toBe("");
    expect(parentKey("shipped-lib/minimatch")).toBe("shipped-lib");
    expect(parentKey("minimatch")).toBe("");
  });

  it("resolves a dependency of a scoped package to the dependency, not the package", () => {
    // The regression: this returned "@tailwindcss/vite" itself.
    expect(resolveEntry(LOCK.packages, "@tailwindcss/vite", "vite")).toBe("vite");
  });

  it("prefers a nested entry over the hoisted one", () => {
    expect(resolveEntry(LOCK.packages, "shipped-lib", "minimatch")).toBe("shipped-lib/minimatch");
    expect(resolveEntry(LOCK.packages, "", "minimatch")).toBe("minimatch");
  });
});

describe("production closure", () => {
  const closure = productionClosure(LOCK, SHIPPED_ROOTS);

  it("includes transitive dependencies of a scoped production package", () => {
    expect(closure.get("vite")).toEqual(new Set(["7.3.4"]));
    expect(closure.get("postcss")).toEqual(new Set(["8.5.15"]));
  });

  it("includes both resolutions when a package appears hoisted and nested", () => {
    // vite reaches the hoisted minimatch@10 (-> brace-expansion@5), while shipped-lib
    // pins its own minimatch@3 (-> brace-expansion@1). An advisory can affect either.
    expect(closure.get("minimatch")).toEqual(new Set(["10.2.5", "3.1.5"]));
    expect(closure.get("brace-expansion")).toEqual(new Set(["5.0.8", "1.1.12"]));
  });

  it("prefers a package's own nested resolution over the hoisted one", () => {
    // shipped-lib must see minimatch@3.1.5, not the hoisted 10.2.5.
    expect(resolveEntry(LOCK.packages, "shipped-lib", "minimatch")).toBe("shipped-lib/minimatch");
  });

  it("excludes dev-only dependencies and their subtrees", () => {
    expect(closure.has("builder")).toBe(false);
    expect(closure.has("tar")).toBe(false);
  });
});

describe("advisory range matching", () => {
  it.each([
    ["7.3.4", ">=7.0.0 <=7.3.4", true],
    ["7.3.6", ">=7.0.0 <=7.3.4", false],
    ["8.5.15", "<=8.5.17", true],
    ["8.5.23", "<=8.5.17", false],
    ["0.27.5", ">=0.27.3 <0.28.1", true],
    ["0.25.12", ">=0.27.3 <0.28.1", false],
    ["0.28.1", ">=0.27.3 <0.28.1", false],
    ["6.26.0", "<6.27.0 || >=7.0.0 <7.28.0", true],
    ["7.29.0", "<6.27.0 || >=7.0.0 <7.28.0", false],
    ["1.1.12", "<1.1.16", true],
  ])("%s against %s -> %s", (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it("does not match when the range is missing", () => {
    expect(satisfies("1.0.0", undefined)).toBe(false);
    expect(satisfies("1.0.0", "")).toBe(false);
  });
});

describe("exposure detection", () => {
  const closure = productionClosure(LOCK, SHIPPED_ROOTS);
  const HIGH = 3;

  it("fails on a high advisory affecting a shipped transitive dependency", () => {
    const exposures = findExposures(
      {
        vite: [{ severity: "high", vulnerable_versions: ">=7.0.0 <=7.3.4", title: "t", url: "u" }],
      },
      closure,
      HIGH,
    );
    expect(exposures).toHaveLength(1);
    expect(exposures[0]).toMatchObject({ name: "vite", versions: ["7.3.4"] });
  });

  it("ignores an advisory that only affects a dev-only package", () => {
    const exposures = findExposures(
      { tar: [{ severity: "high", vulnerable_versions: "<7.5.18", title: "t", url: "u" }] },
      closure,
      HIGH,
    );
    expect(exposures).toEqual([]);
  });

  it("ignores an advisory whose range excludes the shipped version", () => {
    const exposures = findExposures(
      { postcss: [{ severity: "high", vulnerable_versions: "<8.0.0", title: "t", url: "u" }] },
      closure,
      HIGH,
    );
    expect(exposures).toEqual([]);
  });

  it("ignores advisories below the threshold but catches them at a lower one", () => {
    const advisories = {
      "brace-expansion": [
        { severity: "low", vulnerable_versions: "<1.1.16", title: "t", url: "u" },
      ],
    };
    expect(findExposures(advisories, closure, HIGH)).toEqual([]);
    expect(findExposures(advisories, closure, 1)).toHaveLength(1);
  });

  it("reports only the affected resolution when a package is installed twice", () => {
    const exposures = findExposures(
      {
        "brace-expansion": [
          { severity: "high", vulnerable_versions: "<1.1.16", title: "t", url: "u" },
        ],
      },
      closure,
      HIGH,
    );
    expect(exposures[0].versions).toEqual(["1.1.12"]);
  });
});
