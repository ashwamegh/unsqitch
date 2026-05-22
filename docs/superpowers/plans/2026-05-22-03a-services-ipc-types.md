# Plan 3a: Services & IPC — IPC Types & Preload Bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **NOTE:** Plans 8 (File Watcher) and 9 (External Editor) extend both `ipc-types.ts` and `preload.ts`. When implementing those plans, add their new channels and preload methods to the files created here — do NOT overwrite them.

**Goal:** Define all typed IPC channels and create the preload bridge that exposes them to the renderer.

**Architecture:** Shared `ipc-types.ts` defines channel names and payload types. Preload script uses `contextBridge.exposeInMainWorld` to expose typed IPC methods. Main process registers handlers via `ipcMain.handle`.

**Tech Stack:** Electron, TypeScript

---

### Task 1: Define IPC channel types

**Files:**
- Modify: `electron/shared/ipc-types.ts`

- [ ] **Step 1: Write IPC types**

Replace `electron/shared/ipc-types.ts`:

```typescript
// IPC channel definitions — shared between main and renderer via @shared alias

// Sqitch commands
export const IPC_CHANNELS = {
  // Project management
  PROJECT_OPEN: 'project:open',
  PROJECT_LIST: 'project:list',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_GET: 'project:get',

  // Sqitch operations
  SQITCH_DEPLOY: 'sqitch:deploy',
  SQITCH_REVERT: 'sqitch:revert',
  SQITCH_VERIFY: 'sqitch:verify',
  SQITCH_STATUS: 'sqitch:status',
  SQITCH_LOG: 'sqitch:log',
  SQITCH_PLAN: 'sqitch:plan',
  SQITCH_ADD: 'sqitch:add',
  SQITCH_INIT: 'sqitch:init',

  // Engine/Target/Config
  ENGINE_ADD: 'engine:add',
  ENGINE_REMOVE: 'engine:remove',
  ENGINE_LIST: 'engine:list',
  TARGET_ADD: 'target:add',
  TARGET_REMOVE: 'target:remove',
  TARGET_LIST: 'target:list',
  TARGET_GET_LABEL: 'target:getLabel',
  TARGET_SET_LABEL: 'target:setLabel',
  CONFIG_LIST: 'config:list',
  CONFIG_SET: 'config:set',
  CONFIG_UNSET: 'config:unset',

  // Sqitch binary
  SQITCH_DETECT: 'sqitch:detect',
  SQITCH_VERSION: 'sqitch:version',
  SQITCH_CANCEL: 'sqitch:cancel',

  // File watching
  WATCH_START: 'watch:start',
  WATCH_STOP: 'watch:stop',

  // Native dialogs (main → renderer request, main handles)
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',

  // Stream events (main → renderer)
  SQITCH_STREAM: 'sqitch:stream',
  SQITCH_COMPLETE: 'sqitch:complete',
  SQITCH_ERROR: 'sqitch:error',
  STATUS_STALE: 'status:stale',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// Request/Response types per channel
export interface ProjectOpenRequest {
  path: string;
}

export interface ProjectOpenResponse {
  project: {
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
  } | null;
  error?: string;
}

export interface ProjectListResponse {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
    lastDeployment?: string;
    lastOpened: string;
  }>;
}

export interface SqitchDeployRequest {
  projectPath: string;
  target: string;
  toChange?: string;
}

export interface SqitchRevertRequest {
  projectPath: string;
  target: string;
  toChange?: string;
}

export interface SqitchVerifyRequest {
  projectPath: string;
  target: string;
}

export interface SqitchStatusRequest {
  projectPath: string;
  target: string;
}

export interface SqitchLogRequest {
  projectPath: string;
  target: string;
}

export interface SqitchPlanRequest {
  projectPath: string;
}

export interface SqitchAddRequest {
  projectPath: string;
  name: string;
  note: string;
  requires: string[];
  conflicts: string[];
}

export interface SqitchInitRequest {
  directory: string;
  name: string;
  engine: string;
  uri: string;
  topDir: string;
  planFile: string;
}

export interface SqitchStreamEvent {
  projectPath: string;
  data: string;
  type: 'stdout' | 'stderr';
}

export interface SqitchCompleteEvent {
  projectPath: string;
  exitCode: number;
  command: string;
}

export interface SqitchErrorEvent {
  projectPath: string;
  error: string;
  type: string;
}

export interface TargetAddRequest {
  projectPath: string;
  name: string;
  uri: string;
}

export interface TargetGetLabelRequest {
  projectId: string;
  targetName: string;
}

export interface TargetSetLabelRequest {
  projectId: string;
  targetName: string;
  label: string;
}

export interface EngineAddRequest {
  projectPath: string;
  name: string;
  uri: string;
  client?: string;
}

export interface SettingsGetRequest {
  key: string;
}

export interface SettingsSetRequest {
  key: string;
  value: string;
}

export interface DialogOpenDirectoryResponse {
  canceled: boolean;
  path: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/shared/ipc-types.ts
git commit -m "feat: define typed IPC channels and request/response types"
```

---

### Task 2: Create preload bridge

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: Implement preload with contextBridge**

Replace `electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc-types';

const api = {
  // Project management
  projectOpen: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, { path }),

  projectList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  projectRemove: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE, { id }),

  projectGet: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, { id }),

  // Sqitch operations
  sqitchDeploy: (projectPath: string, target: string, toChange?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_DEPLOY, { projectPath, target, toChange }),

  sqitchRevert: (projectPath: string, target: string, toChange?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_REVERT, { projectPath, target, toChange }),

  sqitchVerify: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_VERIFY, { projectPath, target }),

  sqitchStatus: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_STATUS, { projectPath, target }),

  sqitchLog: (projectPath: string, target: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_LOG, { projectPath, target }),

  sqitchPlan: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_PLAN, { projectPath }),

  sqitchAdd: (projectPath: string, name: string, note: string, requires: string[], conflicts: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_ADD, { projectPath, name, note, requires, conflicts }),

  sqitchInit: (directory: string, name: string, engine: string, uri: string, topDir: string, planFile: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_INIT, { directory, name, engine, uri, topDir, planFile }),

  // Engine/Target/Config
  engineAdd: (projectPath: string, name: string, uri: string, client?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_ADD, { projectPath, name, uri, client }),

  engineRemove: (projectPath: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_REMOVE, { projectPath, name }),

  engineList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENGINE_LIST, { projectPath }),

  targetAdd: (projectPath: string, name: string, uri: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_ADD, { projectPath, name, uri }),

  targetRemove: (projectPath: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_REMOVE, { projectPath, name }),

  targetList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_LIST, { projectPath }),

  targetGetLabel: (projectId: string, targetName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_GET_LABEL, { projectId, targetName }),

  targetSetLabel: (projectId: string, targetName: string, label: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TARGET_SET_LABEL, { projectId, targetName, label }),

  configList: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LIST, { projectPath }),

  configSet: (projectPath: string, key: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { projectPath, key, value }),

  configUnset: (projectPath: string, key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UNSET, { projectPath, key }),

  // Sqitch binary
  sqitchDetect: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_DETECT),

  sqitchVersion: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_VERSION),

  sqitchCancel: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SQITCH_CANCEL),

  // Native dialogs
  dialogOpenDirectory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),

  // Stream listeners
  onSqitchStream: (callback: (event: { projectPath: string; data: string; type: 'stdout' | 'stderr' }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { projectPath: string; data: string; type: 'stdout' | 'stderr' }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_STREAM, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_STREAM, handler);
  },

  onSqitchComplete: (callback: (event: { projectPath: string; exitCode: number; command: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { projectPath: string; exitCode: number; command: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_COMPLETE, handler);
  },

  onSqitchError: (callback: (event: { projectPath: string; error: string; type: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { projectPath: string; error: string; type: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SQITCH_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SQITCH_ERROR, handler);
  },

  onStatusStale: (callback: (payload: { threshold?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { threshold?: number }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.STATUS_STALE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATUS_STALE, handler);
  },

  // File watching
  watchStart: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_START, { projectPath }),

  watchStop: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_STOP, { projectPath }),

  // Settings
  settingsGet: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, { key }),

  settingsSet: (key: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
};

contextBridge.exposeInMainWorld('unsqitch', api);

export type UnsqitchAPI = typeof api;
```

- [ ] **Step 2: Create type declaration for window.unsqitch**

Create `src/types/window.d.ts`:

```typescript
import type { UnsqitchAPI } from '../../electron/preload';

declare global {
  interface Window {
    unsqitch: UnsqitchAPI;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add electron/preload.ts src/types/window.d.ts
git commit -m "feat: implement preload bridge with typed IPC API"
```

---

### Task 3: Create useIpc hook

**Files:**
- Modify: `src/hooks/useIpc.ts`

- [ ] **Step 1: Implement useIpc hook**

Replace `src/hooks/useIpc.ts`:

```typescript
export function useIpc() {
  const api = window.unsqitch;

  if (!api) {
    throw new Error('Unsqitch API not available — preload script may not have loaded');
  }

  return api;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useIpc.ts
git commit -m "feat: add useIpc hook for typed renderer-side IPC access"
```