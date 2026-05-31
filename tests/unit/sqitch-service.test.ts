import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqitchService } from "../../electron/services/sqitch.service";

function createMockSpawn() {
  return vi.fn();
}

function mockSpawn(
  spawnMock: ReturnType<typeof createMockSpawn>,
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
    mockSpawn(
      spawnMock,
      true,
      "Deploying changes to mydb\n  + appschema .. ok\n",
      "",
    );
    const result = await service.deploy("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["deploy", "mydb", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds deploy-to-change command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.deploy("/project", "mydb", "users");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["deploy", "mydb", "--to", "users", "--verify"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert command with -y flag", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.revert("/project", "mydb", "users");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["revert", "mydb", "--to", "users", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds revert-all command (no --to)", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.revert("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["revert", "mydb", "-y"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds verify command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.verify("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["verify", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds status command with flags", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.status("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
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
    mockSpawn(spawnMock, true, "", "");
    await service.log("/project", "mydb");
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["log", "mydb"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.add(
      "/project",
      "users",
      "Add users table",
      ["appschema"],
      [],
    );
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["add", "users", "-n", "Add users table", "-r", "appschema"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("builds add command with conflicts", async () => {
    mockSpawn(spawnMock, true, "", "");
    await service.add(
      "/project",
      "new_auth",
      "New auth",
      ["users"],
      ["legacy_auth"],
    );
    expect(spawnMock).toHaveBeenCalledWith(
      "/usr/local/bin/sqitch",
      ["add", "new_auth", "-n", "New auth", "-r", "users", "-x", "legacy_auth"],
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("returns stdout on success", async () => {
    mockSpawn(
      spawnMock,
      true,
      "Deploying changes to mydb\n  + appschema .. ok\n",
      "",
    );
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
