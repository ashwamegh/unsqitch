# Plan 9: External Editor Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement external editor detection and launch, with toast notifications and IPC channels for opening files from the renderer.

**Architecture:** Main process detects editor from `$VISUAL` → `$EDITOR` → platform defaults. Renderer calls `editor:openFile` IPC to launch editor. Toast shows "Opened in VS Code". File watcher (Plan 8) detects external edits and refreshes views.

**Tech Stack:** Electron, child_process, TypeScript, shadcn/ui Toast

---

### Task 1: Add editor IPC channels and preload methods

**Files:**

- Modify: `electron/shared/ipc-types.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add IPC channels**

Add to `IPC_CHANNELS` in `electron/shared/ipc-types.ts`:

```typescript
  // External editor
  EDITOR_OPEN_FILE: 'editor:openFile',
  EDITOR_DETECT: 'editor:detect',
```

Add types:

```typescript
export interface EditorOpenFileRequest {
  filePath: string;
}

export interface EditorDetectResponse {
  command: string | null;
  name: string;
}
```

- [ ] **Step 2: Add preload methods**

Add to the `api` object in `electron/preload.ts`:

```typescript
  editorOpenFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EDITOR_OPEN_FILE, { filePath }),

  editorDetect: () =>
    ipcRenderer.invoke(IPC_CHANNELS.EDITOR_DETECT),
```

- [ ] **Step 3: Commit**

```bash
git add electron/shared/ipc-types.ts electron/preload.ts
git commit -m "feat: add editor IPC channels and preload methods"
```

---

### Task 2: Implement editor service

**Files:**

- Create: `electron/services/editor.service.ts`
- Create: `tests/unit/editor.service.test.ts`

- [ ] **Step 1: Write tests for editor service**

Create `tests/unit/editor.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
import { EditorService } from "../../electron/services/editor.service";

describe("EditorService", () => {
  let service: EditorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EditorService();
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

  it("falls back to platform default (code)", () => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    const result = service.detectEditor();
    expect(result.command).toBe("code");
    expect(result.name).toBe("VS Code");
  });

  it("spawns editor with file path", () => {
    service.editorCommand = "code";
    service.openFile("/project/deploy/users.sql");
    expect(spawn).toHaveBeenCalledWith(
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/unit/editor.service.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement EditorService**

Create `electron/services/editor.service.ts`:

```typescript
import { spawn } from "child_process";
import path from "path";

export class EditorService {
  editorCommand: string | null = null;

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

  openFile(filePath: string): void {
    const command = this.editorCommand || this.detectEditor().command;
    if (!command) return;

    const child = spawn(command, [filePath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/unit/editor.service.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/services/editor.service.ts tests/unit/editor.service.test.ts
git commit -m "feat: implement EditorService with detection and file launch"
```

---

### Task 3: Wire editor service in main.ts and add toast notification

**Files:**

- Modify: `electron/main.ts`
- Create: `src/components/shared/Toast.tsx`

- [ ] **Step 1: Add EditorService to main.ts**

Add import and initialization:

```typescript
import { EditorService } from "./services/editor.service";
// ... alongside other service initialization:
let editorService: EditorService;

// Inside app.whenReady():
editorService = new EditorService();
editorService.detectEditor();
```

Add IPC handlers:

```typescript
ipcMain.handle(IPC_CHANNELS.EDITOR_DETECT, async () => {
  return editorService.detectEditor();
});

ipcMain.handle(
  IPC_CHANNELS.EDITOR_OPEN_FILE,
  async (_event, request: { filePath: string }) => {
    editorService.openFile(request.filePath);
    return {
      success: true,
      editorName: editorService.deriveEditorName(
        editorService.editorCommand || "code",
      ),
    };
  },
);
```

- [ ] **Step 2: Create Toast component for editor launch feedback**

Create `src/components/shared/Toast.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";

interface ToastMessage {
  id: number;
  text: string;
}

let nextId = 0;
const listeners: Array<(toast: ToastMessage) => void> = [];

export function showToast(text: string) {
  const toast: ToastMessage = { id: nextId++, text };
  for (const listener of listeners) {
    listener(toast);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const index = listeners.indexOf(addToast);
      if (index >= 0) listeners.splice(index, 1);
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-foreground text-background px-4 py-2 rounded shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2"
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add ToastContainer to App.tsx**

Add `<ToastContainer />` at the bottom of `AppLayout`:

```tsx
import { ToastContainer } from "../shared/Toast";

export function AppLayout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <MainPanel />
      <ToastContainer />
    </div>
  );
}
```

- [ ] **Step 4: Use editor open in Plan view**

When a user clicks a change in the PlanTimeline, add an "Open in Editor" button that calls:

```tsx
const handleOpenInEditor = async (scriptPath: string) => {
  const result = await ipc.editorOpenFile(scriptPath);
  if (result.editorName) {
    showToast(`Opened in ${result.editorName}`);
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add electron/main.ts src/components/shared/Toast.tsx
git commit -m "feat: wire editor service in main process and add toast notifications"
```
