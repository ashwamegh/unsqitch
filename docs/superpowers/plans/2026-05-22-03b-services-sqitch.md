# Plan 3b: Services — Sqitch Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the sqitch service that spawns sqitch CLI commands as child processes, streams stdout/stderr, and returns parsed results.

**Architecture:** `SqitchService` class wraps `child_process.spawn`. Each method builds the correct sqitch command, spawns it, streams output via callbacks, and resolves/rejects the promise on exit. Binary detection and version checking included.

**Tech Stack:** TypeScript, Node.js child_process, Vitest

---

### Task 1: Create AppError type

**Files:**

- Create: `src/types/error.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create error types**

Create `src/types/error.ts`:

```typescript
export type ErrorType =
  | "sqitch_crash"
  | "db_connection"
  | "file_permission"
  | "binary_not_found"
  | "partial_deployment"
  | "command_timeout"
  | "unknown";

export interface ErrorAction {
  label: string;
  action:
    | "retry"
    | "revert"
    | "view_log"
    | "check_connection"
    | "open_settings"
    | "open_file_manager"
    | "refresh";
}

export interface AppError {
  type: ErrorType;
  message: string;
  sqitchOutput?: string;
  recoverable: boolean;
  actions: ErrorAction[];
}

export function createAppError(
  type: ErrorType,
  message: string,
  sqitchOutput?: string,
): AppError {
  const actionMap: Record<ErrorType, ErrorAction[]> = {
    sqitch_crash: [
      { label: "View Log", action: "view_log" },
      { label: "Retry", action: "retry" },
    ],
    db_connection: [
      { label: "Check Connection", action: "check_connection" },
      { label: "Retry", action: "retry" },
    ],
    file_permission: [
      { label: "Open File Manager", action: "open_file_manager" },
    ],
    binary_not_found: [{ label: "Open Settings", action: "open_settings" }],
    partial_deployment: [
      { label: "Deploy Remaining", action: "retry" },
      { label: "Revert All", action: "revert" },
    ],
    command_timeout: [
      { label: "Retry", action: "retry" },
      { label: "Open Settings", action: "open_settings" },
    ],
    unknown: [{ label: "Refresh", action: "refresh" }],
  };

  return {
    type,
    message,
    sqitchOutput,
    recoverable: type !== "binary_not_found",
    actions: actionMap[type],
  };
}
```

- [ ] **Step 2: Add to barrel export**

Add to `src/types/index.ts`:

```typescript
export * from "./error";
```

- [ ] **Step 3: Commit**

```bash
git add src/types/error.ts src/types/index.ts
git commit -m "feat: add AppError type with action mappings"
```

---

### Task 2: Implement SqitchService — TDD

**Files:**

- Create: `electron/services/sqitch.service.ts`
- Create: `tests/unit/sqitch-service.test.ts`

- [ ] **Step 1: Write tests for sqitch service**

Create `tests/unit/sqitch-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqitchService } from "../../electron/services/sqitch.service";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";

function mockSpawn(
  success: boolean,
  stdout: string,
  stderr: string,
  exitCode = 0,
) {
  const child = {
    stdout: {
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === "data") setTimeout(() => cb(Buffer.from(stdout)), 10);
      }),
    },
    stderr: {
      on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === "data") setTimeout(() => cb(Buffer.from(stderr)), 10);
      }),
    },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === "close") setTimeout(() => cb(exitCode), 20);
    }),
    kill: vi.fn(),
  };
  (spawn as ReturnType<typeof vi.fn>).mockReturnValue(child);
  return child;
}

describe("SqitchService", () => {
  let service: SqitchService;

  beforeEach(() => {
    service = new SqitchService("/usr/local/bin/sqitch");
    vi.clearAllMocks();
  });

  it("detects binary path", () => {
    expect(service.binaryPath).toBe("/usr/local/bin/sqitch");
  });

  it("builds deploy command", async () => {
    mockSpawn(true, "Deploying changes to mydb\n  + appschema .. ok\n", "");
    const result = await service.deploy("/project", "mydb");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["deploy", "mydb", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds deploy-to-change command", async () => {
    mockSpawn(true, "", "");
    await service.deploy("/project", "mydb", "users");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["deploy", "mydb", "--to", "users", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert command with -y flag", async () => {
    mockSpawn(true, "", "");
    await service.revert("/project", "mydb", "users");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["revert", "mydb", "--to", "users", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert-all command (no --to)", async () => {
    mockSpawn(true, "", "");
    await service.revert("/project", "mydb");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["revert", "mydb", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds verify command", async () => {
    mockSpawn(true, "", "");
    await service.verify("/project", "mydb");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["verify", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds status command with flags", async () => {
    mockSpawn(true, "", "");
    await service.status("/project", "mydb");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      [
        "status",
        "mydb",
        "--show-changes",
        "--show-tags",
        "--date-format",
        "raw",
      ],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds log command", async () => {
    mockSpawn(true, "", "");
    await service.log("/project", "mydb");
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["log", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command", async () => {
    mockSpawn(true, "", "");
    await service.add(
      "/project",
      "users",
      "Add users table",
      ["appschema"],
      [],
    );
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["add", "users", "-n", "Add users table", "-r", "appschema"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command with conflicts", async () => {
    mockSpawn(true, "", "");
    await service.add(
      "/project",
      "new_auth",
      "New auth",
      ["users"],
      ["legacy_auth"],
    );
    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["add", "new_auth", "-n", "New auth", "-r", "users", "-x", "legacy_auth"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("returns stdout on success", async () => {
    mockSpawn(true, "Deploying changes to mydb\n  + appschema .. ok\n", "");
    const result = await service.deploy("/project", "mydb");
    expect(result.stdout).toContain("Deploying changes");
  });

  it("rejects on non-zero exit code", async () => {
    mockSpawn(false, "", "Error: deploy failed", 1);
    await expect(service.deploy("/project", "mydb")).rejects.toMatchObject({
      exitCode: 1,
    });
  });

  it("kills process on timeout", async () => {
    const child = mockSpawn(true, "", "", 0);
    // Override 'on' to never call close
    child.on = vi.fn();
    const promise = service.deploy("/project", "mydb", undefined, 100);
    await expect(promise).rejects.toMatchObject({ type: "command_timeout" });
    expect(child.kill).toHaveBeenCalled();
  }, 10000);
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/sqitch-service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement SqitchService**

Create `electron/services/sqitch.service.ts`:

```typescript
import { spawn, ChildProcess } from "child_process";
import { createAppError, AppError } from "../../src/types/error";

export interface SqitchResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StreamCallbacks {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export class SqitchService {
  private _binaryPath: string;
  private activeProcess: ChildProcess | null = null;

  constructor(binaryPath: string) {
    this._binaryPath = binaryPath;
  }

  get binaryPath(): string {
    return this._binaryPath;
  }

  set binaryPath(path: string) {
    this._binaryPath = path;
  }

  private runCommand(
    args: string[],
    cwd: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this._binaryPath, args, { cwd });
      this.activeProcess = child;

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        streams?.onStdout?.(chunk);
      });

      child.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        streams?.onStderr?.(chunk);
      });

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          child.kill();
          this.activeProcess = null;
          reject(
            createAppError(
              "command_timeout",
              `Command timed out after ${timeout}ms`,
            ),
          );
        }, timeout);
      }

      child.on("close", (code: number) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.activeProcess = null;

        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          const error: AppError & {
            exitCode: number;
            stdout: string;
            stderr: string;
          } = {
            ...createAppError(
              "sqitch_crash",
              `sqitch exited with code ${code}`,
              stderr,
            ),
            exitCode: code,
            stdout,
            stderr,
          };
          reject(error);
        }
      });
    });
  }

  async deploy(
    projectPath: string,
    target: string,
    toChange?: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    const args = ["deploy", target, "--verify"];
    if (toChange) args.push("--to", toChange);
    return this.runCommand(args, projectPath, timeout, streams);
  }

  async revert(
    projectPath: string,
    target: string,
    toChange?: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    const args = ["revert", target, "-y"];
    if (toChange) args.push("--to", toChange);
    return this.runCommand(args, projectPath, timeout, streams);
  }

  async verify(
    projectPath: string,
    target: string,
    timeout?: number,
    streams?: StreamCallbacks,
  ): Promise<SqitchResult> {
    return this.runCommand(["verify", target], projectPath, timeout, streams);
  }

  async status(
    projectPath: string,
    target: string,
    timeout?: number,
  ): Promise<SqitchResult> {
    return this.runCommand(
      [
        "status",
        target,
        "--show-changes",
        "--show-tags",
        "--date-format",
        "raw",
      ],
      projectPath,
      timeout,
    );
  }

  async log(
    projectPath: string,
    target: string,
    timeout?: number,
  ): Promise<SqitchResult> {
    return this.runCommand(["log", target], projectPath, timeout);
  }

  async plan(projectPath: string, timeout?: number): Promise<SqitchResult> {
    return this.runCommand(["plan"], projectPath, timeout);
  }

  async add(
    projectPath: string,
    name: string,
    note: string,
    requires: string[],
    conflicts: string[],
    timeout?: number,
  ): Promise<SqitchResult> {
    const args = ["add", name, "-n", note];
    for (const req of requires) args.push("-r", req);
    for (const conf of conflicts) args.push("-x", conf);
    return this.runCommand(args, projectPath, timeout);
  }

  async init(
    directory: string,
    name: string,
    engine: string,
    uri: string,
    topDir: string,
    planFile: string,
    timeout?: number,
  ): Promise<SqitchResult> {
    const args = [
      "init",
      name,
      "--engine",
      engine,
      "--uri",
      uri,
      "--top-dir",
      topDir,
    ];
    if (planFile && planFile !== "sqitch.plan")
      args.push("--plan-file", planFile);
    return this.runCommand(args, directory, timeout);
  }

  cancel(): void {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
    }
  }
}
```

Note: `sqitch plan` is available but the IPC handler in Plan 3d reads the plan file directly (`fs.readFileSync`) since `parsePlanFile` operates on file contents, not CLI output. The `plan()` method is kept for cases where CLI output is preferred (e.g., `sqitch plan --format json` in future versions).

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/sqitch-service.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/services/sqitch.service.ts src/types/error.ts tests/unit/sqitch-service.test.ts
git commit -m "feat: implement SqitchService with spawn, streaming, and timeout"
```
