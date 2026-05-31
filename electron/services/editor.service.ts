import { spawn as defaultSpawn } from "child_process";
import path from "path";

export class EditorService {
  editorCommand: string | null = null;
  private _spawn: typeof defaultSpawn;

  constructor(spawnImpl: typeof defaultSpawn = defaultSpawn) {
    this._spawn = spawnImpl;
  }

  detectEditor(): { command: string | null; name: string } {
    const visual = process.env.VISUAL;
    const editor = process.env.EDITOR;

    if (visual) {
      this.editorCommand = visual;
      return { command: visual, name: this.deriveEditorName(visual) };
    }

    if (editor) {
      this.editorCommand = editor;
      return { command: editor, name: this.deriveEditorName(editor) };
    }

    const defaultEditor = process.platform === "win32" ? "notepad" : "code";
    this.editorCommand = defaultEditor;
    return {
      command: defaultEditor,
      name: this.deriveEditorName(defaultEditor),
    };
  }

  openFile(filePath: string): string {
    const command = this.editorCommand || this.detectEditor().command;
    if (!command) return "";

    const child = this._spawn(command, [filePath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return this.deriveEditorName(command);
  }

  deriveEditorName(command: string): string {
    const base = path.basename(command);
    const nameMap: Record<string, string> = {
      code: "VS Code",
      vim: "Vim",
      nvim: "Neovim",
      nano: "Nano",
      emacs: "Emacs",
      subl: "Sublime Text",
      notepad: "Notepad",
    };
    return nameMap[base] || base;
  }
}
