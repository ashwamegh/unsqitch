# Plan 8: File Watcher Service & Stale State Handling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement chokidar-based file watcher service in the main process, wire it to the renderer via IPC for live plan/script updates, and implement stale state detection with UI banners.

**Architecture:** `FileWatcherService` runs in main process, watches `sqitch.plan` and script directories per project. Sends change events to renderer via IPC. Renderer tracks staleness via `browser-window-focus` events and a 5-minute timer. Stale banner shows at top of section views.

**Tech Stack:** chokidar, Electron IPC, React, TypeScript, Vitest

---

### Task 1: Add IPC channels for file watching events

**Files:**

- Modify: `electron/shared/ipc-types.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add watch event channels to ipc-types.ts**

Add to `IPC_CHANNELS` in `electron/shared/ipc-types.ts`:

```typescript
  // File watching (WATCH_START and WATCH_STOP already defined in Plan 3a)
  WATCH_EVENT: 'watch:event',  // main → renderer
```

Add a new type:

```typescript
export interface WatchEventPayload {
  projectPath: string;
  type: "plan" | "script";
  filePath: string;
  action: "change" | "add" | "unlink";
}
```

- [ ] **Step 2: Add watch event listener to preload.ts**

Add to the `api` object in `electron/preload.ts`:

```typescript
  onWatchEvent: (callback: (event: WatchEventPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: WatchEventPayload) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WATCH_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WATCH_EVENT, handler);
  },
```

Import `WatchEventPayload` from `@shared/ipc-types`.

- [ ] **Step 3: Commit**

```bash
git add electron/shared/ipc-types.ts electron/preload.ts
git commit -m "feat: add file watcher IPC channels and preload listener"
```

---

### Task 2: Implement FileWatcherService

**Files:**

- Create: `electron/services/file-watcher.service.ts`
- Create: `tests/unit/file-watcher.service.test.ts`

- [ ] **Step 1: Write tests for FileWatcherService**

Create `tests/unit/file-watcher.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("chokidar", () => ({
  watch: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  })),
}));

import { watch } from "chokidar";
import { FileWatcherService } from "../../electron/services/file-watcher.service";

describe("FileWatcherService", () => {
  let service: FileWatcherService;
  const onEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileWatcherService(onEvent);
  });

  it("starts watching a project directory", () => {
    service.start("/project");
    expect(watch).toHaveBeenCalledWith(
      [
        "/project/sqitch.plan",
        "/project/deploy",
        "/project/revert",
        "/project/verify",
      ],
      expect.objectContaining({
        ignoreInitial: true,
        atomic: true,
        awaitWriteFinish: { stabilityThreshold: 500 },
        ignored: expect.arrayContaining([
          "**/.git/**",
          "**/node_modules/**",
          "**/*.tmp",
        ]),
      }),
    );
  });

  it("stops watching", () => {
    service.start("/project");
    service.stop("/project");
  });

  it("does not start duplicate watchers", () => {
    service.start("/project");
    service.start("/project");
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it("stops all watchers on stopAll", () => {
    service.start("/project-a");
    service.start("/project-b");
    service.stopAll();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/file-watcher.service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement FileWatcherService**

Create `electron/services/file-watcher.service.ts`:

```typescript
import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import type { WatchEventPayload } from "../shared/ipc-types";

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private onEvent: (event: WatchEventPayload) => void;

  constructor(onEvent: (event: WatchEventPayload) => void) {
    this.onEvent = onEvent;
  }

  start(projectPath: string): void {
    if (this.watchers.has(projectPath)) return;

    const watchPaths = [
      path.join(projectPath, "sqitch.plan"),
      path.join(projectPath, "deploy"),
      path.join(projectPath, "revert"),
      path.join(projectPath, "verify"),
    ];

    const watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
      },
      ignored: ["**/.git/**", "**/node_modules/**", "**/*.tmp"],
    });

    watcher.on("change", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "change");
    });

    watcher.on("add", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "add");
    });

    watcher.on("unlink", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "unlink");
    });

    this.watchers.set(projectPath, watcher);
  }

  stop(projectPath: string): void {
    const watcher = this.watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectPath);
    }
  }

  stopAll(): void {
    for (const [projectPath, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }

  private emitEvent(
    projectPath: string,
    filePath: string,
    action: WatchEventPayload["action"],
  ): void {
    const type: WatchEventPayload["type"] = filePath.endsWith("sqitch.plan")
      ? "plan"
      : "script";
    this.onEvent({ projectPath, type, filePath, action });
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/file-watcher.service.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/services/file-watcher.service.ts tests/unit/file-watcher.service.test.ts
git commit -m "feat: implement FileWatcherService with chokidar"
```

---

### Task 3: Wire FileWatcherService in main.ts

**Files:**

- Modify: `electron/main.ts`

- [ ] **Step 1: Add FileWatcherService to main.ts**

Add import and initialization alongside other services in `electron/main.ts`:

```typescript
import { FileWatcherService } from "./services/file-watcher.service";
// ... after other service initialization:
let fileWatcherService: FileWatcherService;

// Inside app.whenReady():
fileWatcherService = new FileWatcherService((event) => {
  mainWindow?.webContents.send(IPC_CHANNELS.WATCH_EVENT, event);
});
```

- [ ] **Step 2: Register watch IPC handlers**

Add to `registerIpcHandlers()`:

```typescript
// File watching
ipcMain.handle(
  IPC_CHANNELS.WATCH_START,
  async (_event, request: { projectPath: string }) => {
    fileWatcherService.start(request.projectPath);
    return { success: true };
  },
);

ipcMain.handle(
  IPC_CHANNELS.WATCH_STOP,
  async (_event, request: { projectPath: string }) => {
    fileWatcherService.stop(request.projectPath);
    return { success: true };
  },
);
```

- [ ] **Step 3: Start watcher when project opens, stop on remove**

In the `PROJECT_OPEN` handler, after validation and adding the project, start the watcher. This replaces the PROJECT_OPEN handler from Plan 3d — keep the sqitch project validation check:

```typescript
ipcMain.handle(
  IPC_CHANNELS.PROJECT_OPEN,
  async (_event, request: { path: string }) => {
    // Validate it's a sqitch project (must have sqitch.plan or sqitch.conf)
    const hasPlan = fs.existsSync(path.join(request.path, "sqitch.plan"));
    const hasConf = fs.existsSync(path.join(request.path, "sqitch.conf"));
    if (!hasPlan && !hasConf) {
      return {
        project: null,
        error:
          "Not a Sqitch project: no sqitch.plan or sqitch.conf found in directory",
      };
    }
    const id = projectService.addProject({
      name: path.basename(request.path),
      path: request.path,
      engine: "unknown",
    });
    fileWatcherService.start(request.path);
    return { project: projectService.getProject(id) };
  },
);
```

In the `PROJECT_REMOVE` handler:

```typescript
ipcMain.handle(
  IPC_CHANNELS.PROJECT_REMOVE,
  async (_event, request: { id: string }) => {
    const project = projectService.getProject(request.id);
    if (project) fileWatcherService.stop(project.path);
    projectService.removeProject(request.id);
    return { success: true };
  },
);
```

- [ ] **Step 4: Stop all watchers on app quit**

```typescript
app.on("before-quit", () => {
  fileWatcherService.stopAll();
});
```

- [ ] **Step 5: Commit**

```bash
git add electron/main.ts
git commit -m "feat: wire FileWatcherService in main process with IPC handlers"
```

---

### Task 4: Implement stale state handling in renderer

**Files:**

- Modify: `src/store/project.ts`
- Create: `src/components/shared/StaleBanner.tsx`
- Modify: `src/pages/ProjectPage/ProjectPage.tsx`

- [ ] **Step 1: Add stale state tracking to project store**

Add to `src/store/project.ts`:

```typescript
interface ProjectState {
  // ... existing fields
  statusStale: boolean;
  lastStatusRefresh: number | null;  // timestamp
}

// Add to initialState:
  lastStatusRefresh: null,

  // Add action:
  setLastStatusRefresh: (timestamp: number) => set({ lastStatusRefresh: timestamp, statusStale: false }),
  markStatusStale: () => set({ statusStale: true }),
  // NOTE: markStatusStale() is a convenience alias for setStatusStale(true). Both exist:
  //   - setStatusStale(bool) — general-purpose setter
  //   - markStatusStale() — shorthand for event handlers
```

- [ ] **Step 2: Create StaleBanner component**

Create `src/components/shared/StaleBanner.tsx`:

```tsx
import { useProjectStore } from "../../store/project";

export function StaleBanner() {
  const { statusStale, setLastStatusRefresh } = useProjectStore();

  if (!statusStale) return null;

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-yellow-700">
        Data may be outdated — switch sections or use Refresh to update
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Wire stale detection in ProjectPage**

In `src/pages/ProjectPage/ProjectPage.tsx`, add a `useEffect` for the `onStatusStale` IPC listener and the `onWatchEvent` listener:

```tsx
import { useEffect } from "react";
import { useIpc } from "../../hooks/useIpc";
import { useProjectStore } from "../../store/project";
import { StaleBanner } from "../../components/shared/StaleBanner";
import type { PlanFile } from "../../types/plan";

// Inside ProjectPage component:
const ipc = useIpc();
const { markStatusStale, setPlan } = useProjectStore();

useEffect(() => {
  const unsubStale = ipc.onStatusStale((payload) => {
    const { lastStatusRefresh } = useProjectStore.getState();
    const threshold = payload.threshold ?? 5 * 60 * 1000;
    if (!lastStatusRefresh || Date.now() - lastStatusRefresh > threshold) {
      markStatusStale();
    }
    // Also invalidate config cache so views re-fetch on focus
    useProjectStore.getState().setConfig([]);
  });

  const unsubWatch = ipc.onWatchEvent((event) => {
    if (event.type === "plan" && event.action === "change") {
      ipc
        .sqitchPlan(event.projectPath)
        .then((result) => {
          setPlan(result as PlanFile);
        })
        .catch(console.error);
    }
    markStatusStale();
  });

  return () => {
    unsubStale();
    unsubWatch();
  };
}, [ipc, markStatusStale, setPlan]);
```

Add `<StaleBanner />` at the top of the ProjectPage render, above the section content.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: implement stale state handling with banner and file watcher events"
```
