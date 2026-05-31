# Plan 2a: Parsers — Plan File & Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the sqitch.plan file parser and sqitch config parser with full TDD, fixtures, and edge case handling.

**Architecture:** Pure functions — `parsePlanFile(content: string)` and `parseConfigList(output: string)` — return typed data structures, no side effects, no file I/O. All parsing is regex-based against real sqitch output formats.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Define shared types for plan and config data models

**Files:**

- Create: `src/types/plan.ts`
- Create: `src/types/config.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create plan types**

Create `src/types/plan.ts`:

```typescript
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
```

- [ ] **Step 2: Create config types**

Create `src/types/config.ts`:

```typescript
export interface ConfigEntry {
  section: string;
  subsection?: string;
  key: string;
  value: string;
}
```

- [ ] **Step 3: Create barrel export**

Create `src/types/index.ts`:

```typescript
export * from "./plan";
export * from "./config";
```

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add plan and config data model types"
```

---

### Task 2: Implement plan file parser — TDD

**Files:**

- Modify: `src/lib/plan-parser.ts`
- Create: `tests/unit/plan-parser.test.ts`

- [ ] **Step 1: Write tests for plan parser**

Create `tests/unit/plan-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePlanFile } from "../../src/lib/plan-parser";
import type { PlanFile } from "../../src/types/plan";

const BASIC_PLAN = `%syntax-version=1.0.0
%project=my-app
%uri=https://github.com/example/my-app
appschema 2024-01-15T10:00:00Z Marge N. O'Vera <marge@example.com> # Add schema for all flipr objects.
users [appschema] 2024-01-15T10:30:00Z Marge N. O'Vera <marge@example.com> # Creates table to track our users.
@v1.0.0 2024-01-15T11:00:00Z Marge N. O'Vera <marge@example.com> # Tag v1.0.0.
insert_user [users appschema] 2024-01-16T09:00:00Z Marge N. O'Vera <marge@example.com> # Creates a function to insert a user.
new_auth [users !legacy_auth] 2024-01-17T09:00:00Z Marge N. O'Vera <marge@example.com> # New auth, conflicts with legacy.`;

describe("parsePlanFile", () => {
  it("parses pragmas", () => {
    const result = parsePlanFile(BASIC_PLAN);
    expect(result.pragmas).toEqual({
      "syntax-version": "1.0.0",
      project: "my-app",
      uri: "https://github.com/example/my-app",
    });
  });

  it("parses changes with requires", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const users = result.changes.find((c) => c.name === "users");
    expect(users).toBeDefined();
    expect(users!.requires).toEqual(["appschema"]);
    expect(users!.conflicts).toEqual([]);
  });

  it("parses changes with requires and conflicts", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const newAuth = result.changes.find((c) => c.name === "new_auth");
    expect(newAuth).toBeDefined();
    expect(newAuth!.requires).toEqual(["users"]);
    expect(newAuth!.conflicts).toEqual(["legacy_auth"]);
  });

  it("parses changes without dependencies", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const appschema = result.changes.find((c) => c.name === "appschema");
    expect(appschema).toBeDefined();
    expect(appschema!.requires).toEqual([]);
    expect(appschema!.conflicts).toEqual([]);
    expect(appschema!.note).toBe("Add schema for all flipr objects.");
  });

  it("parses tags", () => {
    const result = parsePlanFile(BASIC_PLAN);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe("v1.0.0");
    expect(result.tags[0].note).toBe("Tag v1.0.0.");
  });

  it("preserves entry order in entries array", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const types = result.entries.map((e) => e.type);
    expect(types).toEqual([
      "pragma",
      "pragma",
      "pragma",
      "change",
      "change",
      "tag",
      "change",
      "change",
    ]);
  });

  it("collects changes in order", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const names = result.changes.map((c) => c.name);
    expect(names).toEqual(["appschema", "users", "insert_user", "new_auth"]);
  });

  it("handles empty plan", () => {
    const result = parsePlanFile("");
    expect(result.entries).toEqual([]);
    expect(result.pragmas).toEqual({});
    expect(result.changes).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.unparseableLines).toEqual([]);
  });

  it("tracks unparseable lines", () => {
    const plan = `%syntax-version=1.0.0
this is not valid
appschema 2024-01-15T10:00:00Z Dev <dev@test.com> # A change`;
    const result = parsePlanFile(plan);
    expect(result.unparseableLines).toHaveLength(1);
    expect(result.unparseableLines[0].line).toBe("this is not valid");
    expect(result.unparseableLines[0].index).toBe(1);
  });

  it("parses planner name and email", () => {
    const result = parsePlanFile(BASIC_PLAN);
    const appschema = result.changes.find((c) => c.name === "appschema");
    expect(appschema!.planner).toEqual({
      name: "Marge N. O'Vera",
      email: "marge@example.com",
    });
  });

  it("parses change without note", () => {
    const plan = `appschema 2024-01-15T10:00:00Z Dev <dev@test.com>`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].note).toBe("");
  });

  it("handles change with multiple requires", () => {
    const plan = `mychange [req1 req2 req3] 2024-01-15T10:00:00Z Dev <dev@test.com> # note`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].requires).toEqual(["req1", "req2", "req3"]);
  });

  it("handles change with mixed requires and conflicts", () => {
    const plan = `mychange [req1 !conf1 req2 !conf2] 2024-01-15T10:00:00Z Dev <dev@test.com> # note`;
    const result = parsePlanFile(plan);
    expect(result.changes[0].requires).toEqual(["req1", "req2"]);
    expect(result.changes[0].conflicts).toEqual(["conf1", "conf2"]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/plan-parser.test.ts
```

Expected: FAIL — `parsePlanFile` throws "Not implemented"

- [ ] **Step 3: Implement plan parser**

Replace `src/lib/plan-parser.ts`:

```typescript
import type {
  PlanFile,
  PlanEntry,
  PlanChange,
  PlanTag,
  PlanEntryType,
} from "../types/plan";

const PRAGMA_RE = /^%([\w-]+)=(.+)$/;
const TAG_RE = /^@([\w-]+)\s+(\S+)\s+([^<]*)<([^>]+)>\s*(?:#\s*(.+))?$/;
const CHANGE_RE =
  /^([\w-]+)\s*(?:\[([^\]]+)\])?\s+(\S+)\s+([^<]*)<([^>]+)>\s*(?:#\s*(.+))?$/;

function parseDeps(bracketContent: string | undefined): {
  requires: string[];
  conflicts: string[];
} {
  if (!bracketContent) return { requires: [], conflicts: [] };
  const parts = bracketContent.trim().split(/\s+/);
  const requires: string[] = [];
  const conflicts: string[] = [];
  for (const part of parts) {
    if (part.startsWith("!")) {
      conflicts.push(part.slice(1));
    } else {
      requires.push(part);
    }
  }
  return { requires, conflicts };
}

export function parsePlanFile(content: string): PlanFile {
  const lines = content.split("\n");
  const entries: PlanEntry[] = [];
  const pragmas: Record<string, string> = {};
  const changes: PlanChange[] = [];
  const tags: PlanTag[] = [];
  const unparseableLines: { line: string; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    // Try pragma
    const pragmaMatch = line.match(PRAGMA_RE);
    if (pragmaMatch) {
      const [, key, value] = pragmaMatch;
      const entry: PlanEntry = {
        type: "pragma",
        index: i,
        pragma: { key, value },
      };
      entries.push(entry);
      pragmas[key] = value;
      continue;
    }

    // Try tag
    const tagMatch = line.match(TAG_RE);
    if (tagMatch) {
      const [, name, timestamp, plannerName, plannerEmail, note] = tagMatch;
      const tag: PlanTag = {
        name,
        timestamp,
        planner: { name: plannerName.trim(), email: plannerEmail },
        note: note ?? "",
      };
      tags.push(tag);
      entries.push({ type: "tag", index: i, tag });
      continue;
    }

    // Try change
    const changeMatch = line.match(CHANGE_RE);
    if (changeMatch) {
      const [, name, deps, timestamp, plannerName, plannerEmail, note] =
        changeMatch;
      const { requires, conflicts } = parseDeps(deps);
      const change: PlanChange = {
        name,
        requires,
        conflicts,
        timestamp,
        planner: { name: plannerName.trim(), email: plannerEmail },
        note: note ?? "",
      };
      changes.push(change);
      entries.push({ type: "change", index: i, change });
      continue;
    }

    // Unparseable
    unparseableLines.push({ line, index: i });
    entries.push({ type: "unparseable", index: i, unparseable: { line } });
  }

  return { entries, pragmas, changes, tags, unparseableLines };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/plan-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan-parser.ts src/types/plan.ts src/types/config.ts src/types/index.ts tests/unit/plan-parser.test.ts
git commit -m "feat: implement plan file parser with TDD"
```

---

### Task 3: Implement config parser — TDD

**Files:**

- Modify: `src/lib/config-parser.ts` (new file)
- Create: `tests/unit/config-parser.test.ts`

- [ ] **Step 1: Write tests for config parser**

Create `tests/unit/config-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseConfigList } from "../../src/lib/config-parser";

describe("parseConfigList", () => {
  it("parses simple key=value", () => {
    const result = parseConfigList("core.engine=pg");
    expect(result).toEqual([{ section: "core", key: "engine", value: "pg" }]);
  });

  it("parses key with subsection", () => {
    const result = parseConfigList("engine.pg.client=psql");
    expect(result).toEqual([
      { section: "engine", subsection: "pg", key: "client", value: "psql" },
    ]);
  });

  it("parses value containing equals sign", () => {
    const result = parseConfigList("core.uri=db:pg://user=me@host/db");
    expect(result).toEqual([
      { section: "core", key: "uri", value: "db:pg://user=me@host/db" },
    ]);
  });

  it("parses multiple lines", () => {
    const input = `core.engine=pg
core.top_dir=.
engine.pg.client=psql
engine.pg.target=db:pg://localhost/mydb`;
    const result = parseConfigList(input);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ section: "core", key: "engine", value: "pg" });
    expect(result[2]).toEqual({
      section: "engine",
      subsection: "pg",
      key: "client",
      value: "psql",
    });
  });

  it("handles empty input", () => {
    const result = parseConfigList("");
    expect(result).toEqual([]);
  });

  it("skips blank lines", () => {
    const input = `core.engine=pg

core.top_dir=.`;
    const result = parseConfigList(input);
    expect(result).toHaveLength(2);
  });

  it("handles subsection with deep nesting", () => {
    const result = parseConfigList("target.mydb.uri=db:pg://localhost/mydb");
    expect(result[0]).toEqual({
      section: "target",
      subsection: "mydb",
      key: "uri",
      value: "db:pg://localhost/mydb",
    });
  });

  it("handles empty value", () => {
    const result = parseConfigList("core.plan_file=");
    expect(result[0].value).toBe("");
  });

  it("handles literal \\n in multiline values", () => {
    const result = parseConfigList("core.note=Line 1\\nLine 2");
    expect(result[0].value).toBe("Line 1\\nLine 2");
    // Display code should replace literal \\n with newline on render
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/config-parser.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement config parser**

Create `src/lib/config-parser.ts`:

```typescript
import type { ConfigEntry } from "../types/config";

export function parseConfigList(output: string): ConfigEntry[] {
  const lines = output.split("\n");
  const entries: ConfigEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const keyPart = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);

    // Split keyPart into section[.subsection].key
    const parts = keyPart.split(".");
    let section: string;
    let subsection: string | undefined;
    let key: string;

    if (parts.length === 1) {
      // Invalid — no section.key format, skip
      continue;
    } else if (parts.length === 2) {
      section = parts[0];
      key = parts[1];
      subsection = undefined;
    } else {
      // 3+ parts: section.subsection.key (subsection may contain dots if multi-part)
      section = parts[0];
      subsection = parts.slice(1, -1).join(".");
      key = parts[parts.length - 1];
    }

    entries.push({ section, subsection, key, value });
  }

  return entries;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/config-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/config-parser.ts tests/unit/config-parser.test.ts
git commit -m "feat: implement config parser with TDD"
```
