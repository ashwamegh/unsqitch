# Plan 3c: Services — Project, Config, Engine, Target

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement project service (CRUD for recent projects in SQLite), config/engine/target services (delegating to sqitch CLI), and the SQLite app database initialization.

**Architecture:** `ProjectService` uses better-sqlite3 for `~/.unsqitch/app.db`. `ConfigService`, `EngineService`, `TargetService` delegate to `SqitchService` and parse results. All services are instantiated in main process and wired to IPC handlers.

**Tech Stack:** TypeScript, better-sqlite3, Vitest

---

### Task 1: Implement ProjectService with SQLite — TDD

**Files:**
- Create: `electron/services/project.service.ts`
- Create: `tests/unit/project.service.test.ts`

- [ ] **Step 1: Write tests for ProjectService**

Create `tests/unit/project.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectService } from '../../electron/services/project.service';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), `unsqitch-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  const dbPath = path.join(tmpDir, 'app.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  fs.rmdirSync(tmpDir, { recursive: true });
});

describe('ProjectService', () => {
  function createService(): ProjectService {
    return new ProjectService(path.join(tmpDir, 'app.db'));
  }

  it('initializes database with tables', () => {
    const service = createService();
    const db = new Database(path.join(tmpDir, 'app.db'));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('recent_commands');
    expect(tableNames).toContain('target_labels');
    db.close();
  });

  it('adds and retrieves a project', () => {
    const service = createService();
    const id = service.addProject({
      name: 'my-app',
      path: '/home/user/my-app',
      engine: 'pg',
    });
    expect(id).toBeTruthy();
    const project = service.getProject(id);
    expect(project).toMatchObject({
      name: 'my-app',
      path: '/home/user/my-app',
      engine: 'pg',
    });
  });

  it('lists projects', () => {
    const service = createService();
    service.addProject({ name: 'app1', path: '/a', engine: 'pg' });
    service.addProject({ name: 'app2', path: '/b', engine: 'mysql' });
    const list = service.listProjects();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.name)).toEqual(['app1', 'app2']);
  });

  it('removes a project', () => {
    const service = createService();
    const id = service.addProject({ name: 'app1', path: '/a', engine: 'pg' });
    service.removeProject(id);
    expect(service.listProjects()).toHaveLength(0);
  });

  it('updates lastOpened on getProject', () => {
    const service = createService();
    const id = service.addProject({ name: 'app1', path: '/a', engine: 'pg' });
    const before = service.getProject(id)!;
    // lastOpened should be set
    expect(before.lastOpened).toBeTruthy();
  });

  it('stores and retrieves settings', () => {
    const service = createService();
    service.setSetting('sqitchPath', '/usr/local/bin/sqitch');
    expect(service.getSetting('sqitchPath')).toBe('/usr/local/bin/sqitch');
  });

  it('returns undefined for missing setting', () => {
    const service = createService();
    expect(service.getSetting('nonexistent')).toBeUndefined();
  });

  it('stores target labels', () => {
    const service = createService();
    const id = service.addProject({ name: 'app', path: '/a', engine: 'pg' });
    service.setTargetLabel(id, 'mydb', 'production');
    expect(service.getTargetLabel(id, 'mydb')).toBe('production');
  });

  it('returns undefined for missing label', () => {
    const service = createService();
    const id = service.addProject({ name: 'app', path: '/a', engine: 'pg' });
    expect(service.getTargetLabel(id, 'mydb')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/project.service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement ProjectService**

Create `electron/services/project.service.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  engine: string;
  lastOpened: string;
  changeCount: number;
  lastDeployment?: string;
}

export class ProjectService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(os.homedir(), '.unsqitch', 'app.db');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        engine TEXT NOT NULL,
        lastOpened TEXT NOT NULL,
        changeCount INTEGER NOT NULL DEFAULT 0,
        lastDeployment TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId TEXT NOT NULL,
        command TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        exitCode INTEGER,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS target_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId TEXT NOT NULL,
        targetName TEXT(128) NOT NULL,
        label TEXT(64),
        UNIQUE(projectId, targetName),
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_target_labels_project ON target_labels(projectId, targetName);
    `);
  }

  addProject(input: { name: string; path: string; engine: string }): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO projects (id, name, path, engine, lastOpened, changeCount) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(id, input.name, input.path, input.engine, now);
    return id;
  }

  getProject(id: string): ProjectRecord | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    // Update lastOpened
    this.db.prepare('UPDATE projects SET lastOpened = ? WHERE id = ?').run(new Date().toISOString(), id);
    return row as unknown as ProjectRecord;
  }

  listProjects(): ProjectRecord[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY lastOpened DESC').all() as unknown as ProjectRecord[];
  }

  removeProject(id: string): void {
    this.db.prepare('DELETE FROM target_labels WHERE projectId = ?').run(id);
    this.db.prepare('DELETE FROM recent_commands WHERE projectId = ?').run(id);
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Record<string, string> | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  getTargetLabel(projectId: string, targetName: string): string | undefined {
    const row = this.db.prepare('SELECT label FROM target_labels WHERE projectId = ? AND targetName = ?').get(projectId, targetName) as Record<string, string> | undefined;
    return row?.label;
  }

  setTargetLabel(projectId: string, targetName: string, label: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO target_labels (projectId, targetName, label) VALUES (?, ?, ?)'
    ).run(projectId, targetName, label);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/project.service.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/services/project.service.ts tests/unit/project.service.test.ts
git commit -m "feat: implement ProjectService with SQLite storage"
```

---

### Task 2: Implement ConfigService, EngineService, TargetService

**Files:**
- Create: `electron/services/config.service.ts`
- Create: `electron/services/engine.service.ts`
- Create: `electron/services/target.service.ts`
- Create: `tests/unit/delegate-services.test.ts`

- [ ] **Step 1: Make runCommand public (keeping full signature)**

In `electron/services/sqitch.service.ts`, change `runCommand` from `private` to `public` — the signature must be kept identical including the `streams` parameter. This must be done BEFORE implementing delegate services since they call `sqitch.runCommand()`:

```typescript
// Change visibility only, keep the full signature with streams:
public runCommand(args: string[], cwd: string, timeout?: number, streams?: StreamCallbacks): Promise<SqitchResult> {
  // ... existing implementation (unchanged)
}
```

- [ ] **Step 2: Implement ConfigService**

Create `electron/services/config.service.ts`:

```typescript
import { SqitchService } from './sqitch.service';
import { parseConfigList } from '../../src/lib/config-parser';
import type { ConfigEntry } from '../../src/types/config';

export class ConfigService {
  constructor(private sqitch: SqitchService) {}

  async list(projectPath: string): Promise<ConfigEntry[]> {
    const result = await this.sqitch.runCommand(['config', '--list'], projectPath);
    return parseConfigList(result.stdout);
  }

  async set(projectPath: string, key: string, value: string): Promise<void> {
    await this.sqitch.runCommand(['config', key, value], projectPath);
  }

  async unset(projectPath: string, key: string): Promise<void> {
    await this.sqitch.runCommand(['config', '--unset', key], projectPath);
  }
}
```

- [ ] **Step 3: Implement EngineService**

Create `electron/services/engine.service.ts`:

```typescript
import { SqitchService } from './sqitch.service';

export interface EngineInfo {
  name: string;
  target: string;
  client?: string;
  registry?: string;
}

export class EngineService {
  constructor(private sqitch: SqitchService) {}

  async add(projectPath: string, name: string, uri: string, client?: string): Promise<void> {
    const args = ['engine', 'add', name, '--target', uri];
    if (client) args.push('--client', client);
    await this.sqitch.runCommand(args, projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(['engine', 'remove', name], projectPath);
  }

  async list(projectPath: string): Promise<EngineInfo[]> {
    const result = await this.sqitch.runCommand(['engine', 'list'], projectPath);
    return this.parseEngineList(result.stdout);
  }

  private parseEngineList(output: string): EngineInfo[] {
    const engines: EngineInfo[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/);
      if (match) {
        engines.push({
          name: match[1],
          target: match[2],
        });
      }
    }
    return engines;
  }
}
```

- [ ] **Step 4: Implement TargetService**

Create `electron/services/target.service.ts`:

```typescript
import { SqitchService } from './sqitch.service';

export interface TargetInfo {
  name: string;
  uri: string;
}

export class TargetService {
  constructor(private sqitch: SqitchService) {}

  async add(projectPath: string, name: string, uri: string): Promise<void> {
    await this.sqitch.runCommand(['target', 'add', name, '--uri', uri], projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(['target', 'remove', name], projectPath);
  }

  async list(projectPath: string): Promise<TargetInfo[]> {
    const result = await this.sqitch.runCommand(['target', 'list'], projectPath);
    return this.parseTargetList(result.stdout);
  }

  private parseTargetList(output: string): TargetInfo[] {
    const targets: TargetInfo[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)$/);
      if (match) {
        targets.push({ name: match[1], uri: match[2] });
      }
    }
    return targets;
  }
}
```

- [ ] **Step 5: Write tests for delegate services**

Create `tests/unit/delegate-services.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '../../electron/services/config.service';
import { EngineService } from '../../electron/services/engine.service';
import { TargetService } from '../../electron/services/target.service';
import type { SqitchService } from '../../electron/services/sqitch.service';

function mockSqitch(stdout: string, stderr = '') {
  return {
    runCommand: vi.fn().mockResolvedValue({ stdout, stderr, exitCode: 0 }),
  } as unknown as SqitchService;
}

describe('ConfigService', () => {
  it('lists config entries', async () => {
    const sqitch = mockSqitch('core.engine=pg\nengine.pg.client=psql\n');
    const service = new ConfigService(sqitch);
    const entries = await service.list('/project');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ section: 'core', key: 'engine', value: 'pg' });
  });

  it('sets a config value', async () => {
    const sqitch = mockSqitch('');
    const service = new ConfigService(sqitch);
    await service.set('/project', 'core.engine', 'pg');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['config', 'core.engine', 'pg'], '/project');
  });

  it('unsets a config value', async () => {
    const sqitch = mockSqitch('');
    const service = new ConfigService(sqitch);
    await service.unset('/project', 'core.engine');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['config', '--unset', 'core.engine'], '/project');
  });
});

describe('EngineService', () => {
  it('adds an engine', async () => {
    const sqitch = mockSqitch('');
    const service = new EngineService(sqitch);
    await service.add('/project', 'pg', 'db:pg://localhost/mydb', 'psql');
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ['engine', 'add', 'pg', '--target', 'db:pg://localhost/mydb', '--client', 'psql'],
      '/project'
    );
  });

  it('removes an engine', async () => {
    const sqitch = mockSqitch('');
    const service = new EngineService(sqitch);
    await service.remove('/project', 'pg');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['engine', 'remove', 'pg'], '/project');
  });
});

describe('TargetService', () => {
  it('adds a target', async () => {
    const sqitch = mockSqitch('');
    const service = new TargetService(sqitch);
    await service.add('/project', 'mydb', 'db:pg://localhost/mydb');
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ['target', 'add', 'mydb', '--uri', 'db:pg://localhost/mydb'],
      '/project'
    );
  });

  it('removes a target', async () => {
    const sqitch = mockSqitch('');
    const service = new TargetService(sqitch);
    await service.remove('/project', 'mydb');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['target', 'remove', 'mydb'], '/project');
  });
});
```

- [ ] **Step 6: Run tests — verify they pass**```bash
npx vitest run tests/unit/delegate-services.test.ts
```

Expected: All tests PASS

- [ ] **Step 7: Commit**```bash
git add electron/services/config.service.ts electron/services/engine.service.ts electron/services/target.service.ts tests/unit/delegate-services.test.ts
git commit -m "feat: implement ConfigService, EngineService, TargetService"
```