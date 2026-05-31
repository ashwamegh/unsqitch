import type { DeployedChange, DeploymentStatus } from "../types/deployment";

interface ParseState {
  target: string;
  engine: string;
  deployed: DeployedChange[];
  pending: string[];
  lastChange: string;
  lastTag: string[];
  lastDeployTime: string;
}

export function parseStatusOutput(output: string): DeploymentStatus {
  const state: ParseState = {
    target: "",
    engine: "",
    deployed: [],
    pending: [],
    lastChange: "",
    lastTag: [],
    lastDeployTime: "",
  };

  const lines = output.split("\n");
  let currentChange: Partial<DeployedChange> | null = null;
  let section: "deployed" | "undeployed" | "other" = "other";

  for (const line of lines) {
    const trimmed = line.trim();

    const targetMatch = trimmed.match(/^On database\s+(\S+)/);
    if (targetMatch) {
      state.target = targetMatch[1];
      continue;
    }

    const engineMatch = trimmed.match(/^Engine:\s+(\S+)/);
    if (engineMatch) {
      state.engine = engineMatch[1];
      continue;
    }

    if (trimmed.startsWith("Deployed changes:")) {
      section = "deployed";
      continue;
    }
    if (trimmed.startsWith("Undeployed changes:")) {
      section = "undeployed";
      continue;
    }

    const lastDeployMatch = trimmed.match(/^Last deployed:\s+(\S+)/);
    if (lastDeployMatch) {
      state.lastDeployTime = lastDeployMatch[1];
      continue;
    }

    const changeHeaderMatch = trimmed.match(/^(\w+)\s+-\s+(\S+)\s+-\s+(.+)$/);
    if (changeHeaderMatch && section === "deployed") {
      if (currentChange?.name) {
        state.deployed.push(currentChange as DeployedChange);
      }
      currentChange = {
        name: changeHeaderMatch[1],
        deployedAt: changeHeaderMatch[2],
        deployedBy: changeHeaderMatch[3],
        changeId: "",
        tags: [],
        note: "",
        requires: [],
        conflicts: [],
      };
      state.lastChange = changeHeaderMatch[1];
      continue;
    }

    if (currentChange) {
      const changeIdMatch = trimmed.match(/^Change:\s+(.+)$/);
      if (changeIdMatch) {
        currentChange.changeId = changeIdMatch[1];
        continue;
      }

      const noteMatch = trimmed.match(/^Note:\s+(.+)$/);
      if (noteMatch) {
        currentChange.note = noteMatch[1];
        continue;
      }

      const tagsMatch = trimmed.match(/^Tags:\s*(.*)$/);
      if (tagsMatch) {
        const raw = tagsMatch[1].trim();
        currentChange.tags = raw ? raw.split(/\s+/).map((t) => t.replace(/^@/, "")) : [];
        state.lastTag = currentChange.tags;
        continue;
      }

      const requiresMatch = trimmed.match(/^Requires:\s*(.*)$/);
      if (requiresMatch) {
        const raw = requiresMatch[1].trim();
        currentChange.requires = raw ? raw.split(/\s+/) : [];
        continue;
      }

      const conflictsMatch = trimmed.match(/^Conflicts:\s*(.*)$/);
      if (conflictsMatch) {
        const raw = conflictsMatch[1].trim();
        currentChange.conflicts = raw ? raw.split(/\s+/) : [];
        continue;
      }
    }

    if (section === "undeployed") {
      const pendingMatch = trimmed.match(/^(\w+)$/);
      if (pendingMatch) {
        state.pending.push(pendingMatch[1]);
      }
    }
  }

  if (currentChange?.name) {
    state.deployed.push(currentChange as DeployedChange);
  }

  return {
    target: state.target,
    engine: state.engine,
    deployed: state.deployed,
    pending: state.pending,
    lastChange: state.lastChange,
    lastTag: state.lastTag,
    lastDeployTime: state.lastDeployTime,
  };
}
