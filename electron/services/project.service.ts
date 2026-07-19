import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  engine: string;
  lastOpened: string;
  changeCount: number;
  lastDeployment?: string;
}

export interface RecentCommand {
  id: number;
  projectId: string;
  command: string;
  timestamp: string;
  exitCode: number | null;
}

/** Strip embedded credentials from a command string before persisting it. */
export function redactCommand(command: string): string {
  // db:pg://user:pass@host -> db:pg://***:***@host  (and user@host -> ***@host)
  return command
    .replace(/(:\/\/)[^:@/\s]+:[^@/\s]+@/g, "$1***:***@")
    .replace(/(:\/\/)[^:@/\s]+@/g, "$1***@");
}

export class ProjectService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(os.homedir(), ".unsqitch", "app.db");
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
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
    this.db
      .prepare(
        "INSERT INTO projects (id, name, path, engine, lastOpened, changeCount) VALUES (?, ?, ?, ?, ?, 0)",
      )
      .run(id, input.name, input.path, input.engine, now);
    return id;
  }

  getProject(id: string): ProjectRecord | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;
    this.db
      .prepare("UPDATE projects SET lastOpened = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    return row as unknown as ProjectRecord;
  }

  getProjectByPath(projectPath: string): ProjectRecord | undefined {
    return this.db.prepare("SELECT * FROM projects WHERE path = ?").get(projectPath) as
      | ProjectRecord
      | undefined;
  }

  listProjects(): ProjectRecord[] {
    return this.db
      .prepare("SELECT * FROM projects ORDER BY lastOpened DESC")
      .all() as unknown as ProjectRecord[];
  }

  updateProjectMeta(
    id: string,
    meta: { engine?: string; changeCount?: number; lastDeployment?: string },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (meta.engine !== undefined) {
      sets.push("engine = ?");
      values.push(meta.engine);
    }
    if (meta.changeCount !== undefined) {
      sets.push("changeCount = ?");
      values.push(meta.changeCount);
    }
    if (meta.lastDeployment !== undefined) {
      sets.push("lastDeployment = ?");
      values.push(meta.lastDeployment);
    }
    if (sets.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  recordCommand(projectId: string, command: string, exitCode: number | null): void {
    this.db
      .prepare(
        "INSERT INTO recent_commands (projectId, command, timestamp, exitCode) VALUES (?, ?, ?, ?)",
      )
      .run(projectId, redactCommand(command), new Date().toISOString(), exitCode);
  }

  getRecentCommands(projectId: string, limit = 20): RecentCommand[] {
    return this.db
      .prepare("SELECT * FROM recent_commands WHERE projectId = ? ORDER BY id DESC LIMIT ?")
      .all(projectId, limit) as unknown as RecentCommand[];
  }

  removeProject(id: string): void {
    this.db.prepare("DELETE FROM target_labels WHERE projectId = ?").run(id);
    this.db.prepare("DELETE FROM recent_commands WHERE projectId = ?").run(id);
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | Record<string, string>
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  getTargetLabel(projectId: string, targetName: string): string | undefined {
    const row = this.db
      .prepare("SELECT label FROM target_labels WHERE projectId = ? AND targetName = ?")
      .get(projectId, targetName) as Record<string, string> | undefined;
    return row?.label;
  }

  setTargetLabel(projectId: string, targetName: string, label: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO target_labels (projectId, targetName, label) VALUES (?, ?, ?)",
      )
      .run(projectId, targetName, label);
  }

  close(): void {
    this.db.close();
  }
}
