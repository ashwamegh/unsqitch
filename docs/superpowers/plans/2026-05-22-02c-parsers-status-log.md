# Plan 2c: Parsers — Status & Log Parsers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `sqitch status` and `sqitch log` output parsers that produce `DeploymentStatus` and `LogEntry` typed objects.

**Architecture:** Pure functions — `parseStatusOutput(output: string)` and `parseLogOutput(output: string)`. Status parser extracts deployed changes, pending changes, and summary counts. Log parser extracts chronological deployment history entries.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Define status and log data types

**Files:**

- Create: `src/types/deployment.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create deployment types**

Create `src/types/deployment.ts`:

```typescript
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
```

- [ ] **Step 2: Add to barrel export**

Add to `src/types/index.ts`:

```typescript
export * from "./deployment";
```

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add deployment status and log entry types"
```

---

### Task 2: Implement status parser — TDD

**Files:**

- Create: `src/lib/status-parser.ts`
- Create: `tests/unit/status-parser.test.ts`

- [ ] **Step 1: Write tests for status parser**

Create `tests/unit/status-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseStatusOutput } from "../../src/lib/status-parser";

const STATUS_OUTPUT = `On database mydb
Deployed changes:
  appschema - 2024-01-15T10:00:00Z - Marge <marge@example.com>
    Change: abc123def456
    Note: Add schema for all flipr objects
    Tags: @v1.0.0
    Requires:
    Conflicts:
  users - 2024-01-15T10:30:00Z - Marge <marge@example.com>
    Change: def789ghi012
    Note: Creates table to track our users
    Tags:
    Requires: appschema
    Conflicts:
  emails - 2024-01-16T09:00:00Z - Marge <marge@example.com>
    Change: jkl345mno678
    Note: Add emails table
    Tags: @v1.0.0
    Requires: users
    Conflicts:
Undeployed changes:
  orders
  payments
Last deployed: 2024-01-16T09:00:00Z
Engine: pg`;

describe("parseStatusOutput", () => {
  it("parses target name", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.target).toBe("mydb");
  });

  it("parses engine", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.engine).toBe("pg");
  });

  it("parses deployed changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.deployed).toHaveLength(3);
  });

  it("parses deployed change fields", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const users = result.deployed.find((c) => c.name === "users");
    expect(users).toBeDefined();
    expect(users!.changeId).toBe("def789ghi012");
    expect(users!.deployedBy).toBe("Marge <marge@example.com>");
    expect(users!.note).toBe("Creates table to track our users");
    expect(users!.requires).toEqual(["appschema"]);
  });

  it("parses tags on deployed changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const appschema = result.deployed.find((c) => c.name === "appschema");
    expect(appschema!.tags).toEqual(["v1.0.0"]);
  });

  it("parses pending (undeployed) changes", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.pending).toEqual(["orders", "payments"]);
  });

  it("parses lastChange", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.lastChange).toBe("emails");
  });

  it("parses lastDeployTime", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    expect(result.lastDeployTime).toBe("2024-01-16T09:00:00Z");
  });

  it("handles empty status", () => {
    const result = parseStatusOutput("");
    expect(result.deployed).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it("parses --date-format raw output (strict ISO-8601 UTC)", () => {
    const output = `On database mydb
Engine: pg
Deployed changes:
  appschema - 2024-01-15T10:00:00Z - Test <test@example.com>
    Change: abc123
    Note: Test change
    Tags:
    Requires:
    Conflicts:
Undeployed changes:
Last deployed: 2024-01-15T10:00:00Z`;
    const result = parseStatusOutput(output);
    expect(result.deployed).toHaveLength(1);
    expect(result.deployed[0].deployedAt).toBe("2024-01-15T10:00:00Z");
  });

  it("parses deployedBy with angle brackets", () => {
    const result = parseStatusOutput(STATUS_OUTPUT);
    const appschema = result.deployed.find((c) => c.name === "appschema");
    expect(appschema!.deployedBy).toBe("Marge <marge@example.com>");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/status-parser.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement status parser**

Create `src/lib/status-parser.ts`:

```typescript
import type { DeploymentStatus, DeployedChange } from "../types/deployment";

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

    // Target line: "On database <name>"
    const targetMatch = trimmed.match(/^On database\s+(\S+)/);
    if (targetMatch) {
      state.target = targetMatch[1];
      continue;
    }

    // Engine line
    const engineMatch = trimmed.match(/^Engine:\s+(\S+)/);
    if (engineMatch) {
      state.engine = engineMatch[1];
      continue;
    }

    // Section headers
    if (trimmed.startsWith("Deployed changes:")) {
      section = "deployed";
      continue;
    }
    if (trimmed.startsWith("Undeployed changes:")) {
      section = "undeployed";
      continue;
    }

    // Last deployed
    const lastDeployMatch = trimmed.match(/^Last deployed:\s+(\S+)/);
    if (lastDeployMatch) {
      state.lastDeployTime = lastDeployMatch[1];
      continue;
    }

    // Deployed change header line: "name - timestamp - deployer"
    const changeHeaderMatch = trimmed.match(
      /^([\w.-]+)\s+-\s+(\S+)\s+-\s+(.+)$/,
    );
    if (changeHeaderMatch && section === "deployed") {
      if (currentChange && currentChange.name) {
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

    // Change detail lines (indented under a change)
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
        currentChange.tags = raw
          ? raw.split(/\s+/).map((t) => t.replace(/^@/, ""))
          : [];
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

    // Pending (undeployed) change names
    if (section === "undeployed") {
      const pendingMatch = trimmed.match(/^([\w.-]+)$/);
      if (pendingMatch) {
        state.pending.push(pendingMatch[1]);
        continue;
      }
    }
  }

  // Flush last change
  if (currentChange && currentChange.name) {
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/status-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-parser.ts src/types/deployment.ts src/types/index.ts tests/unit/status-parser.test.ts
git commit -m "feat: implement status parser with TDD"
```

---

### Task 3: Implement log parser — TDD

**Files:**

- Create: `src/lib/log-parser.ts`
- Create: `tests/unit/log-parser.test.ts`

- [ ] **Step 1: Write tests for log parser**

Create `tests/unit/log-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseLogOutput } from "../../src/lib/log-parser";

const LOG_OUTPUT = `On database mydb
Change: appschema
  ID: abc123def456
  Action: deploy
  Committed by Marge <marge@example.com>
  Date: 2024-01-15T10:00:00Z
  Note: Add schema for all flipr objects
  Tags: @v1.0.0
  Requires:
  Conflicts:

Change: users
  ID: def789ghi012
  Action: deploy
  Committed by Marge <marge@example.com>
  Date: 2024-01-15T10:30:00Z
  Note: Creates table to track our users
  Tags:
  Requires: appschema
  Conflicts:

Change: users
  ID: def789ghi012
  Action: revert
  Committed by Marge <marge@example.com>
  Date: 2024-01-16T08:00:00Z
  Note: Reverting users
  Tags:
  Requires: appschema
  Conflicts:`;

describe("parseLogOutput", () => {
  it("parses all log entries", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result).toHaveLength(3);
  });

  it("parses deploy action", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].change).toBe("appschema");
    expect(result[0].action).toBe("deploy");
  });

  it("parses revert action", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[2].change).toBe("users");
    expect(result[2].action).toBe("revert");
  });

  it("parses change ID", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].changeId).toBe("abc123def456");
  });

  it("parses committer", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].committer).toEqual({
      name: "Marge",
      email: "marge@example.com",
    });
  });

  it("parses timestamp", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].timestamp).toBe("2024-01-15T10:00:00Z");
  });

  it("parses note", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].note).toBe("Add schema for all flipr objects");
  });

  it("parses tags", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].tags).toEqual(["v1.0.0"]);
  });

  it("parses empty tags", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[1].tags).toEqual([]);
  });

  it("parses requires", () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[1].requires).toEqual(["appschema"]);
  });

  it("handles empty output", () => {
    const result = parseLogOutput("");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/log-parser.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement log parser**

Create `src/lib/log-parser.ts`:

```typescript
import type { LogEntry } from "../types/deployment";

export function parseLogOutput(output: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = output.split("\n");
  let current: Partial<LogEntry> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Change header: "Change: <name>"
    const changeMatch = trimmed.match(/^Change:\s+(.+)$/);
    if (changeMatch) {
      if (current && current.change) {
        entries.push(current as LogEntry);
      }
      current = {
        change: changeMatch[1],
        tags: [],
        requires: [],
        conflicts: [],
      };
      continue;
    }

    if (!current) continue;

    const idMatch = trimmed.match(/^ID:\s+(.+)$/);
    if (idMatch) {
      current.changeId = idMatch[1];
      continue;
    }

    const actionMatch = trimmed.match(/^Action:\s+(deploy|revert)$/);
    if (actionMatch) {
      current.action = actionMatch[1] as "deploy" | "revert";
      continue;
    }

    const committerMatch = trimmed.match(/^Committed by\s+(.+?)\s+<(.+)>$/);
    if (committerMatch) {
      current.committer = { name: committerMatch[1], email: committerMatch[2] };
      continue;
    }

    const dateMatch = trimmed.match(/^Date:\s+(.+)$/);
    if (dateMatch) {
      current.timestamp = dateMatch[1];
      continue;
    }

    const noteMatch = trimmed.match(/^Note:\s+(.*)$/);
    if (noteMatch) {
      current.note = noteMatch[1];
      continue;
    }

    const tagsMatch = trimmed.match(/^Tags:\s*(.*)$/);
    if (tagsMatch) {
      const raw = tagsMatch[1].trim();
      current.tags = raw
        ? raw.split(/\s+/).map((t) => t.replace(/^@/, ""))
        : [];
      continue;
    }

    const requiresMatch = trimmed.match(/^Requires:\s*(.*)$/);
    if (requiresMatch) {
      const raw = requiresMatch[1].trim();
      current.requires = raw ? raw.split(/\s+/) : [];
      continue;
    }

    const conflictsMatch = trimmed.match(/^Conflicts:\s*(.*)$/);
    if (conflictsMatch) {
      const raw = conflictsMatch[1].trim();
      current.conflicts = raw ? raw.split(/\s+/) : [];
      continue;
    }
  }

  // Flush last entry
  if (current && current.change) {
    entries.push(current as LogEntry);
  }

  return entries;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/log-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/log-parser.ts tests/unit/log-parser.test.ts
git commit -m "feat: implement log parser with TDD"
```
