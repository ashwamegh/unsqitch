import { beforeEach, describe, expect, it, vi } from "vitest";
import { SqitchService } from "../../electron/services/sqitch.service";

function createMockSpawn() {
  return vi.fn();
}

function mockSpawn(
  spawnMock: ReturnType<typeof createMockSpawn>,
  _success: boolean,
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
  spawnMock.mockReturnValue(child);
  return child;
}

describe("SqitchService", () => {
  let service: SqitchService;
  let spawnMock: ReturnType<typeof createMockSpawn>;

  beforeEach(() => {
    spawnMock = createMockSpawn();
    service = new SqitchService("/usr/local/bin/sqitch", spawnMock);
  });

  it("detects binary path", () => {
    expect(service.binaryPath).toBe("/usr/local/bin/sqitch");
  });

  it("builds deploy command", async () => {
    mockSpawn(spawnMock, true, "Deploying changes to mydb\n  + appschema .. ok\n", "");
    const _result = await service.deploy("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "deploy", "mydb", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds deploy-to-change command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.deploy("/project", "mydb", "users");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "deploy", "mydb", "--to", "users", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert command with -y flag", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.revert("/project", "mydb", "users");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "revert", "mydb", "--to", "users", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert-all command (no --to)", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.revert("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "revert", "mydb", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds verify command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.verify("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "verify", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds status command with flags", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.status("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      [
        "--chdir",
        "/project",
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
    mockSpawn(spawnMock, true, "", "");
    await service.log("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "log", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.add("/project", "users", "Add users table", ["appschema"], []);
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["--chdir", "/project", "add", "users", "-n", "Add users table", "-r", "appschema"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command with conflicts", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.add("/project", "new_auth", "New auth", ["users"], ["legacy_auth"]);
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      [
        "--chdir",
        "/project",
        "add",
        "new_auth",
        "-n",
        "New auth",
        "-r",
        "users",
        "-x",
        "legacy_auth",
      ],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("returns stdout on success", async () => {
    mockSpawn(spawnMock, true, "Deploying changes to mydb\n  + appschema .. ok\n", "");
    const result = await service.deploy("/project", "mydb");
    expect(result.stdout).toContain("Deploying changes");
  });

  it("rejects on non-zero exit code", async () => {
    mockSpawn(spawnMock, false, "", "Error: deploy failed", 1);
    await expect(service.deploy("/project", "mydb")).rejects.toMatchObject({
      exitCode: 1,
    });
  });

  it("kills process on timeout", async () => {
    const child = mockSpawn(spawnMock, true, "", "", 0);
    child.on = vi.fn();
    const promise = service.deploy("/project", "mydb", undefined, 100);
    await expect(promise).rejects.toMatchObject({ type: "command_timeout" });
    expect(child.kill).toHaveBeenCalled();
  }, 10000);
});

describe("SqitchService exit-code handling", () => {
  let service: SqitchService;
  let spawnMock: ReturnType<typeof createMockSpawn>;

  beforeEach(() => {
    spawnMock = createMockSpawn();
    service = new SqitchService("/usr/local/bin/sqitch", spawnMock);
  });

  it("treats status exit 1 as an empty status, not a failure", async () => {
    // Real sqitch exits 1 with "No changes deployed" for a project that has
    // nothing deployed yet — a normal state the UI must render as 0 deployed.
    mockSpawn(spawnMock, false, "# On database db:pg://h/d\nNo changes deployed\n", "", 1);
    const result = await service.status("/project", "mydb");
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("No changes deployed");
  });

  it("still rejects when status fails for real (exit 2)", async () => {
    mockSpawn(spawnMock, false, "", 'database "nope" does not exist', 2);
    await expect(service.status("/project", "mydb")).rejects.toMatchObject({ exitCode: 2 });
  });

  it("does not tolerate exit 1 for deploy", async () => {
    mockSpawn(spawnMock, false, "", "boom", 1);
    await expect(service.deploy("/project", "mydb")).rejects.toMatchObject({ exitCode: 1 });
  });

  it("falls back to stdout for the error output when stderr is empty", async () => {
    mockSpawn(spawnMock, false, "connection to server failed", "", 2);
    await expect(service.deploy("/project", "mydb")).rejects.toMatchObject({
      sqitchOutput: "connection to server failed",
    });
  });
});
