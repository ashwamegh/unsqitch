export type PlanEntryType = "pragma" | "change" | "tag" | "unparseable";

export interface PlanChange {
  name: string;
  requires: string[];
  conflicts: string[];
  timestamp: string;
  planner: { name: string; email: string };
  note: string;
}

export interface PlanTag {
  name: string;
  timestamp: string;
  planner: { name: string; email: string };
  note: string;
}

export interface PlanEntry {
  type: PlanEntryType;
  index: number;
  pragma?: { key: string; value: string };
  change?: PlanChange;
  tag?: PlanTag;
  unparseable?: { line: string };
}

export interface PlanFile {
  entries: PlanEntry[];
  pragmas: Record<string, string>;
  changes: PlanChange[];
  tags: PlanTag[];
  unparseableLines: { line: string; index: number }[];
}
