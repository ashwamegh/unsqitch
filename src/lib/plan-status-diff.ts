import type { DeploymentStatus } from "../types/deployment";
import type { PlanFile } from "../types/plan";

/**
 * Local, instant plan-vs-status diff — no database connection.
 * Pending = changes in the plan (in order) that are not present in the deployed
 * set from the (cached) status. This is the safe preview the spec describes;
 * a fresh `sqitch status` is still run separately before actually deploying.
 */
export function pendingChanges(plan: PlanFile | null, status: DeploymentStatus | null): string[] {
  const deployed = new Set((status?.deployed ?? []).map((c) => c.name));
  return (plan?.changes ?? []).map((c) => c.name).filter((name) => !deployed.has(name));
}

/**
 * Changes deployed on the target that no longer appear in the plan (drift).
 */
export function deployedNotInPlan(
  plan: PlanFile | null,
  status: DeploymentStatus | null,
): string[] {
  const planNames = new Set((plan?.changes ?? []).map((c) => c.name));
  return (status?.deployed ?? []).map((c) => c.name).filter((name) => !planNames.has(name));
}
