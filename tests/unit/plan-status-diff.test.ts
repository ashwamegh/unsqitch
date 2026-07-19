import { describe, expect, it } from "vitest";
import { deployedNotInPlan, pendingChanges } from "../../src/lib/plan-status-diff";
import type { DeployedChange, DeploymentStatus } from "../../src/types/deployment";
import type { PlanChange, PlanFile } from "../../src/types/plan";

function change(name: string): PlanChange {
  return {
    name,
    requires: [],
    conflicts: [],
    timestamp: "",
    planner: { name: "", email: "" },
    note: "",
  };
}
function deployed(name: string): DeployedChange {
  return {
    name,
    changeId: name,
    deployedAt: "",
    deployedBy: "",
    tags: [],
    note: "",
    requires: [],
    conflicts: [],
  };
}
function plan(names: string[]): PlanFile {
  return { entries: [], pragmas: {}, changes: names.map(change), tags: [], unparseableLines: [] };
}
function status(names: string[]): DeploymentStatus {
  return {
    target: "t",
    engine: "pg",
    deployed: names.map(deployed),
    pending: [],
    lastChange: "",
    lastTag: [],
    lastDeployTime: "",
  };
}

describe("pendingChanges (local plan-vs-status diff)", () => {
  it("returns plan changes not yet deployed, in plan order", () => {
    expect(pendingChanges(plan(["a", "b", "c"]), status(["a"]))).toEqual(["b", "c"]);
  });

  it("returns all plan changes when nothing is deployed", () => {
    expect(pendingChanges(plan(["a", "b"]), status([]))).toEqual(["a", "b"]);
    expect(pendingChanges(plan(["a", "b"]), null)).toEqual(["a", "b"]);
  });

  it("returns empty when the plan is fully deployed", () => {
    expect(pendingChanges(plan(["a", "b"]), status(["a", "b"]))).toEqual([]);
  });

  it("handles a null plan", () => {
    expect(pendingChanges(null, status(["a"]))).toEqual([]);
  });
});

describe("deployedNotInPlan (drift)", () => {
  it("flags deployed changes missing from the plan", () => {
    expect(deployedNotInPlan(plan(["a"]), status(["a", "ghost"]))).toEqual(["ghost"]);
  });
});
