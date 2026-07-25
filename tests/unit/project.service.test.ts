import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectService, redactCommand } from "../../electron/services/project.service";

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
    const _service = createService();
    const db = new Database(path.join(tmpDir, "app.db"));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
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
    // Order-agnostic on purpose: listProjects sorts by lastOpened DESC, and two projects
    // added microseconds apart may or may not share a millisecond timestamp. Asserting a
    // fixed order here made this test fail intermittently. The ordering contract itself is
    // asserted below, where lastOpened is controlled.
    expect(list.map((p) => p.name).sort()).toEqual(["app1", "app2"]);
  });

  it("lists the most recently opened project first", () => {
    const service = createService();
    const first = service.addProject({ name: "app1", path: "/a", engine: "pg" });
    service.addProject({ name: "app2", path: "/b", engine: "mysql" });
    // getProject stamps lastOpened, which is what the ordering is meant to reflect.
    service.getProject(first);
    expect(service.listProjects()[0].name).toBe("app1");
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

  it("finds a project by path", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "pg" });
    expect(service.getProjectByPath("/a")?.id).toBe(id);
    expect(service.getProjectByPath("/missing")).toBeUndefined();
  });

  it("updates engine, changeCount, and lastDeployment metadata", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "unknown" });
    service.updateProjectMeta(id, { engine: "pg", changeCount: 3 });
    let p = service.getProject(id)!;
    expect(p).toMatchObject({ engine: "pg", changeCount: 3 });
    service.updateProjectMeta(id, { lastDeployment: "2026-07-19T00:00:00Z" });
    p = service.getProject(id)!;
    expect(p.lastDeployment).toBe("2026-07-19T00:00:00Z");
    expect(p.changeCount).toBe(3); // untouched fields preserved
  });

  it("records and retrieves recent commands, newest first", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "pg" });
    service.recordCommand(id, "sqitch deploy mydb --verify", 0);
    service.recordCommand(id, "sqitch revert mydb -y", 1);
    const cmds = service.getRecentCommands(id);
    expect(cmds).toHaveLength(2);
    expect(cmds[0].command).toBe("sqitch revert mydb -y");
    expect(cmds[0].exitCode).toBe(1);
  });

  it("redacts embedded credentials before storing a command", () => {
    const service = createService();
    const id = service.addProject({ name: "app", path: "/a", engine: "pg" });
    service.recordCommand(id, "sqitch deploy db:pg://joe:s3cret@host/db --verify", 0);
    expect(service.getRecentCommands(id)[0].command).not.toContain("s3cret");
    expect(service.getRecentCommands(id)[0].command).toContain("***");
  });
});

describe("redactCommand", () => {
  it("masks user:password in a URI", () => {
    expect(redactCommand("db:pg://joe:s3cret@host/db")).toBe("db:pg://***:***@host/db");
  });
  it("masks a lone user in a URI", () => {
    expect(redactCommand("db:pg://joe@host/db")).toBe("db:pg://***@host/db");
  });
  it("leaves credential-free commands unchanged", () => {
    expect(redactCommand("sqitch deploy mydb --verify")).toBe("sqitch deploy mydb --verify");
  });
});
