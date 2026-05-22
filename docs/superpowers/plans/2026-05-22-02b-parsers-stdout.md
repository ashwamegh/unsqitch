# Plan 2b: Parsers — Sqitch Stdout Parser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the real-time sqitch stdout parser that emits `SqitchEvent` objects as output streams from deploy, revert, and verify commands.

**Architecture:** Pure function — `parseSqitchOutput(output: string): SqitchEvent[]` — returns typed events. A streaming variant `createSqitchStreamParser()` will be added in Plan 3 when the service layer is built.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Define sqitch event types

**Files:**
- Create: `src/types/sqitch-event.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create event types**

Create `src/types/sqitch-event.ts`:

```typescript
export type SqitchEventType = 'deploy' | 'revert' | 'verify';
// 'running' is set by the streaming path when a change starts but hasn't completed;
// parseSqitchOutput only produces 'ok' | 'not_ok' | 'failed' from completed lines
export type SqitchEventStatus = 'ok' | 'not_ok' | 'failed' | 'running';

export interface SqitchEvent {
  type: SqitchEventType;
  change: string;
  target?: string;
  status: SqitchEventStatus;
  rawLine: string;
}

export interface SqitchParsedOutput {
  events: SqitchEvent[];
  rawOutput: string;
  exitCode: number | null;
}
```

- [ ] **Step 2: Add to barrel export**

Add to `src/types/index.ts`:

```typescript
export * from './sqitch-event';
```

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add sqitch event types for stdout parser"
```

---

### Task 2: Implement stdout parser — TDD

**Files:**
- Modify: `src/lib/sqitch-parser.ts`
- Create: `tests/unit/sqitch-parser.test.ts`

- [ ] **Step 1: Write tests for stdout parser**

Create `tests/unit/sqitch-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSqitchOutput } from '../../src/lib/sqitch-parser';

const DEPLOY_OUTPUT = `Deploying changes to db:pg://localhost/mydb
  + appschema  .. ok
  + users      .. ok
  + emails     .. ok
  + @v1.0.0    .. ok`;

const REVERT_OUTPUT = `Reverting changes from db:pg://localhost/mydb
  - emails     .. ok
  - users      .. ok`;

const VERIFY_OUTPUT = `Verifying changes to db:pg://localhost/mydb
  * appschema  .. ok
  * users      .. ok
  * emails     .. not ok`;

const MIXED_OUTPUT = `Deploying changes to db:pg://localhost/mydb
  + appschema  .. ok
  + users      .. FAILED
  + emails     .. ok`;

const HEADER_LINES = `Deploying change users to mydb
Reverting change emails from mydb
Verifying change appschema`;

describe('parseSqitchOutput', () => {
  it('parses deploy events', () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.events).toHaveLength(4);
    expect(result.events[0]).toEqual({
      type: 'deploy',
      change: 'appschema',
      status: 'ok',
      rawLine: '  + appschema  .. ok',
    });
  });

  it('parses revert events', () => {
    const result = parseSqitchOutput(REVERT_OUTPUT);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe('revert');
    expect(result.events[0].change).toBe('emails');
  });

  it('parses verify events', () => {
    const result = parseSqitchOutput(VERIFY_OUTPUT);
    expect(result.events).toHaveLength(3);
    expect(result.events[0].type).toBe('verify');
    expect(result.events[2].change).toBe('emails');
    expect(result.events[2].status).toBe('not_ok');
  });

  it('parses FAILED status as "failed"', () => {
    const result = parseSqitchOutput(MIXED_OUTPUT);
    const failed = result.events.find(e => e.change === 'users');
    expect(failed!.status).toBe('failed');
  });

  it('extracts target from header lines', () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.events[0].target).toBe('db:pg://localhost/mydb');
  });

  it('extracts change name from "Deploying change X to Y"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[0]).toMatchObject({
      type: 'deploy',
      change: 'users',
      target: 'mydb',
    });
  });

  it('extracts from "Reverting change X from Y"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[1]).toMatchObject({
      type: 'revert',
      change: 'emails',
      target: 'mydb',
    });
  });

  it('extracts from "Verifying change X"', () => {
    const result = parseSqitchOutput(HEADER_LINES);
    expect(result.events[2]).toMatchObject({
      type: 'verify',
      change: 'appschema',
    });
  });

  it('handles empty output', () => {
    const result = parseSqitchOutput('');
    expect(result.events).toEqual([]);
  });

  it('preserves raw output', () => {
    const result = parseSqitchOutput(DEPLOY_OUTPUT);
    expect(result.rawOutput).toBe(DEPLOY_OUTPUT);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/sqitch-parser.test.ts
```

Expected: FAIL — `parseSqitchOutput` throws "Not implemented"

- [ ] **Step 3: Implement stdout parser**

Replace `src/lib/sqitch-parser.ts`:

```typescript
import type { SqitchEvent, SqitchParsedOutput, SqitchEventStatus } from '../types/sqitch-event';

const DEPLOY_LINE_RE = /^\s*\+\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;
const REVERT_LINE_RE = /^\s*-\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;
const VERIFY_LINE_RE = /^\s*\*\s+(\S+)\s+\.\.\s+(ok|not ok|FAILED)/;

const DEPLOY_HEADER_RE = /^Deploying change (\S+) to (\S+)/;
const REVERT_HEADER_RE = /^Reverting change (\S+) from (\S+)/;
const VERIFY_HEADER_RE = /^Verifying change (\S+)/;

const DEPLOY_TARGET_RE = /^Deploying changes to (\S+)/;
const REVERT_TARGET_RE = /^Reverting changes from (\S+)/;
const VERIFY_TARGET_RE = /^Verifying changes to (\S+)/;

function mapStatus(raw: string): SqitchEventStatus {
  if (raw === 'ok') return 'ok';
  if (raw === 'not ok') return 'not_ok';
  if (raw === 'FAILED') return 'failed';
  return 'failed';
}

export function parseSqitchOutput(output: string): SqitchParsedOutput {
  const lines = output.split('\n');
  const events: SqitchEvent[] = [];
  let currentTarget: string | undefined;

  for (const line of lines) {
    // Try target headers first ("Deploying changes to X")
    const deployTarget = line.match(DEPLOY_TARGET_RE);
    if (deployTarget) {
      currentTarget = deployTarget[1];
      continue;
    }
    const revertTarget = line.match(REVERT_TARGET_RE);
    if (revertTarget) {
      currentTarget = revertTarget[1];
      continue;
    }
    const verifyTarget = line.match(VERIFY_TARGET_RE);
    if (verifyTarget) {
      currentTarget = verifyTarget[1];
      continue;
    }

    // Try per-change headers ("Deploying change X to Y")
    const deployHeader = line.match(DEPLOY_HEADER_RE);
    if (deployHeader) {
      events.push({
        type: 'deploy',
        change: deployHeader[1],
        target: deployHeader[2],
        status: 'running',
        rawLine: line,
      });
      continue;
    }
    const revertHeader = line.match(REVERT_HEADER_RE);
    if (revertHeader) {
      events.push({
        type: 'revert',
        change: revertHeader[1],
        target: revertHeader[2],
        status: 'running',
        rawLine: line,
      });
      continue;
    }
    const verifyHeader = line.match(VERIFY_HEADER_RE);
    if (verifyHeader) {
      events.push({
        type: 'verify',
        change: verifyHeader[1],
        status: 'running',
        rawLine: line,
      });
      continue;
    }

    // Try status lines
    const deployLine = line.match(DEPLOY_LINE_RE);
    if (deployLine) {
      events.push({
        type: 'deploy',
        change: deployLine[1],
        target: currentTarget,
        status: mapStatus(deployLine[2]),
        rawLine: line,
      });
      continue;
    }
    const revertLine = line.match(REVERT_LINE_RE);
    if (revertLine) {
      events.push({
        type: 'revert',
        change: revertLine[1],
        target: currentTarget,
        status: mapStatus(revertLine[2]),
        rawLine: line,
      });
      continue;
    }
    const verifyLine = line.match(VERIFY_LINE_RE);
    if (verifyLine) {
      events.push({
        type: 'verify',
        change: verifyLine[1],
        target: currentTarget,
        status: mapStatus(verifyLine[2]),
        rawLine: line,
      });
      continue;
    }
  }

  return { events, rawOutput: output, exitCode: null };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/sqitch-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sqitch-parser.ts src/types/sqitch-event.ts src/types/index.ts tests/unit/sqitch-parser.test.ts
git commit -m "feat: implement sqitch stdout parser with TDD"
```