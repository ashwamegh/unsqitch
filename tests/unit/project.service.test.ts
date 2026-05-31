import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectService } from "../../electron/services/project.service";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

const tmpDir = path.join(os.tmpdir(), `unsqitch-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  const dbPath = path.join(tmpDir, "app.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  fs.rmdirSync(tmpDir, { recursive: true });
});

describe("ProjectService", () => {
  function createService(): ProjectService {
    return new ProjectService(path.join(tmpDir, "app.db"));
  }

  it("initializes database with tables", () => {
    const service = createService();
    const db = new Database(path.join(tmpDir, "app.db"));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("settings");
    expect(tableNames).toContain("recent_commands");
    expect(tableNames).toContain("target_labels");
    db.close();
  });

  it("adds and retrieves a project", () => {
    const service = createService();
    const id = service.addProject({
      name: "my-app",
      path: "/home/user/my-app",
      engine: "pg",
    });
    expect(id).toBeTruthy();
    const project = service.getProject(id);
    expect(project).toMatchObject({
      name: "my-app",
      path: "/home/user/my-app",
      engine: "pg",
    });
  });

  it("lists projects", () => {
    const service = createService();
    service.addProject({ name: "app1", path: "/a", engine: "pg" });
    service.addProject({ name: "app2", path: "/b", engine: "mysql" });
    const list = service.listProjects();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.name)).toEqual(["app1", "app2"]);
  });

  it("removes a project", () => {
    const service = createService();
    const id = service.addProject({ name: "app1", path: "/a", engine: "pg" });
    service.removeProject(id);
    expect(service.listProjects()).toHaveLength(0);
  });

  it("updates lastOpened on getProject", () => {
    const service = createService();
    const id = service.addProject({ name: "app1", path: "/a", engine: "pg" });
    const before = service.getProject(id)!;
    expect(before.lastOpened).toBeTruthy();
  });

  it("stores and retrieves settings", () => {
    const service = createService();
    service.setSetting("sqitchPath", "/usr/local/bin/sqitch");
    expect(service.getSetting("sqitchPath")).toBe("/usr/local/bin/sqitch");
  });

  it("returns undefined for missing setting", () => {
    const service = createService();
    expect(service.getSetting("nonexistent")).toBeUndefined();
  });

  it("stores target labels", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "pg" });
    service.setTargetLabel(id, "mydb", "production");
    expect(service.getTargetLabel(id, "mydb")).toBe("production");
  });

  it("returns undefined for missing label", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "pg" });
    expect(service.getTargetLabel(id, "mydb")).toBeUndefined();
  });
});
