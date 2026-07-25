export interface DeployedChange {
  name: string;
  changeId: string;
  deployedAt: string;
  deployedBy: string;
  tags: string[];
  note: string;
  requires: string[];
  conflicts: string[];
}

export interface DeploymentStatus {
  target: string;
  engine: string;
  /** Project name reported by `sqitch status`. */
  project?: string;
  deployed: DeployedChange[];
  pending: string[];
  lastChange: string;
  lastTag: string[];
  lastDeployTime: string;
}

export interface LogEntry {
  change: string;
  changeId: string;
  action: "deploy" | "revert";
  timestamp: string;
  committer: { name: string; email: string };
  note: string;
  tags: string[];
  requires: string[];
  conflicts: string[];
}
