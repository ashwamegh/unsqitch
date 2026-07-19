import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorService } from "../../electron/services/editor.service";

function createMockSpawn() {
  return vi.fn(() => ({ unref: vi.fn() }));
}

describe("EditorService", () => {
  let service: EditorService;
  let spawnMock: ReturnType<typeof createMockSpawn>;

  beforeEach(() => {
    spawnMock = createMockSpawn();
    service = new EditorService(spawnMock);
  });

  afterEach(() => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
  });

  it("detects editor from VISUAL env var", () => {
    process.env.VISUAL = "vim";
    process.env.EDITOR = "nano";
    const result = service.detectEditor();
    expect(result.command).toBe("vim");
    expect(result.name).toBe("Vim");
  });

  it("falls back to EDITOR env var", () => {
    delete process.env.VISUAL;
    process.env.EDITOR = "nano";
    const result = service.detectEditor();
    expect(result.command).toBe("nano");
    expect(result.name).toBe("Nano");
  });

  it("falls back to code on non-Windows", () => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    const result = service.detectEditor();
    expect(result.command).toBe("code");
    expect(result.name).toBe("VS Code");
  });

  it("spawns editor with file path", () => {
    service.editorCommand = "code";
    service.openFile("/project/deploy/users.sql");
    expect(spawnMock).toHaveBeenCalledWith(
      "code",
      ["/project/deploy/users.sql"],
      expect.objectContaining({ detached: true }),
    );
  });

  it("derives name from custom path", () => {
    const result = service.deriveEditorName("/usr/local/bin/sublime-text");
    expect(result).toBe("sublime-text");
  });
});
