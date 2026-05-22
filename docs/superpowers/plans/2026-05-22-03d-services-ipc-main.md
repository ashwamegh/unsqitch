# Plan 3d: Services — IPC Handlers & Binary Detection

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all services to Electron IPC handlers in main process. Implement sqitch binary detection and version checking on app startup.

**Architecture:** `main.ts` initializes all services, registers `ipcMain.handle` for each channel, and exposes streaming via `webContents.send`. Binary detection runs on startup and caches the result.

**Tech Stack:** Electron, TypeScript

---

### Task 1: Implement binary detection utility

**Files:**
- Create: `electron/services/binary-detector.ts`
- Create: `tests/unit/binary-detector.test.ts`

- [ ] **Step 1: Write tests for binary detector**

Create `tests/unit/binary-detector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectSqitchBinary, checkSqitchVersion } from '../../electron/services/binary-detector';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';

describe('detectSqitchBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns path when sqitch is found', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue('/usr/local/bin/sqitch\n');
    const result = detectSqitchBinary();
    expect(result).toBe('/usr/local/bin/sqitch');
  });

  it('returns null when sqitch is not found', () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('not found');
    });
    const result = detectSqitchBinary();
    expect(result).toBeNull();
  });

  it('uses custom path when provided', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue('/custom/sqitch\n');
    const result = detectSqitchBinary('/custom/sqitch');
    expect(result).toBe('/custom/sqitch');
  });
});

describe('checkSqitchVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts semver from sqitch --version output', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue('sqitch 1.3.1\n');
    const result = checkSqitchVersion('/usr/local/bin/sqitch');
    expect(result).toEqual({ version: '1.3.1', meetsMinimum: true });
  });

  it('returns meetsMinimum false for old versions', () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue('sqitch 0.999.0\n');
    const result = checkSqitchVersion('/usr/local/bin/sqitch');
    expect(result).toEqual({ version: '0.999.0', meetsMinimum: false });
  });

  it('returns null when version check fails', () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('exec failed');
    });
    const result = checkSqitchVersion('/usr/local/bin/sqitch');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/binary-detector.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement binary detector**

Create `electron/services/binary-detector.ts`:

```typescript
import { execSync } from 'child_process';

const MINIMUM_VERSION = '1.0.0';

function compareSemver(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
  }
  return 0;
}

export function detectSqitchBinary(customPath?: string): string | null {
  if (customPath) {
    try {
      execSync(`"${customPath}" --version`, { stdio: 'pipe' });
      return customPath;
    } catch {
      return null;
    }
  }

  try {
    const command = process.platform === 'win32' ? 'where sqitch' : 'which sqitch';
    const result = execSync(command, { stdio: 'pipe' }).toString().trim();
    return result.split('\n')[0].trim();
  } catch {
    return null;
  }
}

export function checkSqitchVersion(binaryPath: string): { version: string; meetsMinimum: boolean } | null {
  try {
    const output = execSync(`"${binaryPath}" --version`, { stdio: 'pipe' }).toString();
    const match = output.match(/(\d+\.\d+\.\d+)/);
    if (!match) return null;
    const version = match[1];
    return {
      version,
      meetsMinimum: compareSemver(version, MINIMUM_VERSION) >= 0,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/binary-detector.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/services/binary-detector.ts tests/unit/binary-detector.test.ts
git commit -m "feat: implement sqitch binary detection and version checking"
```

---

### Task 2: Wire IPC handlers in main.ts

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Implement main.ts with IPC handlers**

Replace `electron/main.ts`:

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { SqitchService } from './services/sqitch.service';
import { ProjectService } from './services/project.service';
import { ConfigService } from './services/config.service';
import { EngineService } from './services/engine.service';
import { TargetService } from './services/target.service';
import { detectSqitchBinary, checkSqitchVersion } from './services/binary-detector';
import { IPC_CHANNELS } from './shared/ipc-types';
import { parseStatusOutput } from '../src/lib/status-parser';
import { parseLogOutput } from '../src/lib/log-parser';
import { parsePlanFile } from '../src/lib/plan-parser';
import { parseSqitchOutput } from '../src/lib/sqitch-parser';
import { createAppError } from '../src/types/error';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let sqitchService: SqitchService;
let projectService: ProjectService;
let configService: ConfigService;
let engineService: EngineService;
let targetService: TargetService;

const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }
}

function getTimeout(): number {
  const timeoutStr = projectService.getSetting('commandTimeout');
  return timeoutStr ? parseInt(timeoutStr, 10) : DEFAULT_TIMEOUT;
}

function registerIpcHandlers() {
  // Binary detection
  ipcMain.handle(IPC_CHANNELS.SQITCH_DETECT, async () => {
    const customPath = projectService.getSetting('sqitchPath');
    const binaryPath = detectSqitchBinary(customPath || undefined);
    if (!binaryPath) {
      return { found: false, path: null, version: null, meetsMinimum: false };
    }
    const versionInfo = checkSqitchVersion(binaryPath);
    if (sqitchService) {
      sqitchService.binaryPath = binaryPath;
    }
    return {
      found: true,
      path: binaryPath,
      version: versionInfo?.version ?? null,
      meetsMinimum: versionInfo?.meetsMinimum ?? false,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_VERSION, async () => {
    const binaryPath = sqitchService.binaryPath;
    return checkSqitchVersion(binaryPath);
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_CANCEL, async () => {
    sqitchService.cancel();
    return { success: true };
  });

  // Native dialogs
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return { canceled: result.canceled, path: result.filePaths[0] || null };
  });

  // Project management
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, request: { path: string }) => {
    // Validate it's a sqitch project (must have sqitch.plan or sqitch.conf)
    const hasPlan = fs.existsSync(path.join(request.path, 'sqitch.plan'));
    const hasConf = fs.existsSync(path.join(request.path, 'sqitch.conf'));
    if (!hasPlan && !hasConf) {
      return { project: null, error: 'Not a Sqitch project: no sqitch.plan or sqitch.conf found in directory' };
    }
    const id = projectService.addProject({
      name: path.basename(request.path),
      path: request.path,
      engine: 'unknown',
    });
    // NOTE: fileWatcherService.start(request.path) will be added here in Plan 8
    return { project: projectService.getProject(id) };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return { projects: projectService.listProjects() };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE, async (_event, request: { id: string }) => {
    projectService.removeProject(request.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_event, request: { id: string }) => {
    return projectService.getProject(request.id);
  });

  // Sqitch operations
  ipcMain.handle(IPC_CHANNELS.SQITCH_DEPLOY, async (event, request) => {
    try {
      const sender = event.sender;
      const result = await sqitchService.deploy(request.projectPath, request.target, request.toChange, getTimeout(), {
        onStdout: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stdout' }),
        onStderr: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stderr' }),
      });
      const parsed = parseSqitchOutput(result.stdout);
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: 'deploy',
      });
      return parsed;
    } catch (err: any) {
      const error = createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_REVERT, async (event, request) => {
    try {
      const sender = event.sender;
      const result = await sqitchService.revert(request.projectPath, request.target, request.toChange, getTimeout(), {
        onStdout: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stdout' }),
        onStderr: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stderr' }),
      });
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: 'revert',
      });
      return parseSqitchOutput(result.stdout);
    } catch (err: any) {
      const error = createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_VERIFY, async (event, request) => {
    try {
      const sender = event.sender;
      const result = await sqitchService.verify(request.projectPath, request.target, getTimeout(), {
        onStdout: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stdout' }),
        onStderr: (data) => sender.send(IPC_CHANNELS.SQITCH_STREAM, { projectPath: request.projectPath, data, type: 'stderr' }),
      });
      sender.send(IPC_CHANNELS.SQITCH_COMPLETE, {
        projectPath: request.projectPath,
        exitCode: result.exitCode,
        command: 'verify',
      });
      return parseSqitchOutput(result.stdout);
    } catch (err: any) {
      const error = createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
      event.sender.send(IPC_CHANNELS.SQITCH_ERROR, {
        projectPath: request.projectPath,
        error: error.message,
        type: error.type,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_STATUS, async (event, request) => {
    try {
      const result = await sqitchService.status(request.projectPath, request.target, getTimeout());
      return parseStatusOutput(result.stdout);
    } catch (err: any) {
      const error = createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_LOG, async (event, request) => {
    try {
      const result = await sqitchService.log(request.projectPath, request.target, getTimeout());
      return parseLogOutput(result.stdout);
    } catch (err: any) {
      const error = createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_PLAN, async (event, request) => {
    try {
      const planPath = path.join(request.projectPath, 'sqitch.plan');
      const content = fs.readFileSync(planPath, 'utf-8');
      return parsePlanFile(content);
    } catch (err: any) {
      throw createAppError('file_permission', `Failed to read plan file: ${err.message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_ADD, async (event, request) => {
    try {
      const result = await sqitchService.add(
        request.projectPath, request.name, request.note, request.requires, request.conflicts, getTimeout()
      );
      return { success: true, stdout: result.stdout };
    } catch (err: any) {
      throw createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SQITCH_INIT, async (event, request) => {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(request.directory)) {
        fs.mkdirSync(request.directory, { recursive: true });
      }
      const result = await sqitchService.init(
        request.directory, request.name, request.engine, request.uri, request.topDir, request.planFile, getTimeout()
      );
      return { success: true, stdout: result.stdout };
    } catch (err: any) {
      throw createAppError('sqitch_crash', err.message, err.stderr || err.sqitchOutput);
    }
  });

  // Engine/Target/Config
  ipcMain.handle(IPC_CHANNELS.ENGINE_ADD, async (event, request) => {
    await engineService.add(request.projectPath, request.name, request.uri, request.client);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_REMOVE, async (event, request) => {
    await engineService.remove(request.projectPath, request.name);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ENGINE_LIST, async (event, request) => {
    return engineService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_ADD, async (event, request) => {
    await targetService.add(request.projectPath, request.name, request.uri);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_REMOVE, async (event, request) => {
    await targetService.remove(request.projectPath, request.name);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_LIST, async (event, request) => {
    return targetService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_GET_LABEL, async (event, request) => {
    const label = projectService.getTargetLabel(request.projectId, request.targetName);
    return { label: label ?? null };
  });

  ipcMain.handle(IPC_CHANNELS.TARGET_SET_LABEL, async (event, request) => {
    projectService.setTargetLabel(request.projectId, request.targetName, request.label);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LIST, async (event, request) => {
    return configService.list(request.projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (event, request) => {
    await configService.set(request.projectPath, request.key, request.value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_UNSET, async (event, request) => {
    await configService.unset(request.projectPath, request.key);
    return { success: true };
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, request) => {
    return { value: projectService.getSetting(request.key) };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (event, request) => {
    projectService.setSetting(request.key, request.value);
    return { success: true };
  });
}

// Single-instance enforcement — prevent multiple app instances (spec: Security section)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Initialize services
    const binaryPath = detectSqitchBinary() || 'sqitch';
    sqitchService = new SqitchService(binaryPath);
    projectService = new ProjectService();
    configService = new ConfigService(sqitchService);
    engineService = new EngineService(sqitchService);
    targetService = new TargetService(sqitchService);

    registerIpcHandlers();
    createWindow();

    // Window focus refresh — invalidate status cache when window regains focus
    // Only send stale if last refresh was >5 minutes ago
    app.on('browser-window-focus', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.STATUS_STALE, { threshold: 5 * 60 * 1000 });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "feat: wire IPC handlers in main process with all services"
```