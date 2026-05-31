import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";

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
    const resolvedPath =
      dbPath || path.join(os.homedir(), ".unsqitch", "app.db");
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
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    this.db
      .prepare("UPDATE projects SET lastOpened = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    return row as unknown as ProjectRecord;
  }

  listProjects(): ProjectRecord[] {
    return this.db
      .prepare("SELECT * FROM projects ORDER BY lastOpened DESC")
      .all() as unknown as ProjectRecord[];
  }

  removeProject(id: string): void {
    this.db.prepare("DELETE FROM target_labels WHERE projectId = ?").run(id);
    this.db.prepare("DELETE FROM recent_commands WHERE projectId = ?").run(id);
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  getSetting(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as Record<string, string> | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(key, value);
  }

  getTargetLabel(projectId: string, targetName: string): string | undefined {
    const row = this.db
      .prepare(
        "SELECT label FROM target_labels WHERE projectId = ? AND targetName = ?",
      )
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
