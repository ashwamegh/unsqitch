# Plan 6: Terminal Panel & Progress UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement xterm.js terminal panel (collapsible, resizable) and change-by-change progress UI for deploy/revert/verify operations.

**Architecture:** Terminal panel sits at the bottom of the main panel, auto-opens on command start, streams sqitch stdout/stderr via IPC. Progress bar shows per-change status. Both are driven by `useProjectStore` events.

**Tech Stack:** React 18, TypeScript, xterm.js, @xterm/addon-fit

---

### Task 1: Verify xterm.js is installed

> Note: `@xterm/xterm` and `@xterm/addon-fit` were already installed in Plan 1 Task 4. If they were somehow skipped, run: `npm install @xterm/xterm @xterm/addon-fit`

---

### Task 2: Create TerminalPanel component

**Files:**

- Create: `src/components/terminal/TerminalPanel.tsx`

- [ ] **Step 1: Create TerminalPanel**

```tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useIpc } from "../../hooks/useIpc";

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(200);
  const ipc = useIpc();

  const writeLine = useCallback((data: string, type: "stdout" | "stderr") => {
    if (!xtermRef.current) return;
    const prefix = type === "stderr" ? "\x1b[31m" : "";
    const suffix = type === "stderr" ? "\x1b[0m" : "";
    xtermRef.current.writeln(`${prefix}${data}${suffix}`);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new Terminal({
      scrollback: 10000,
      fontSize: 13,
      fontFamily: "Menlo, Monaco, Consolas, monospace",
      cursorBlink: false,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    return () => {
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!xtermRef.current || !isOpen) return;
    fitRef.current?.fit();
  }, [isOpen, height]);

  // Listen for stream events
  useEffect(() => {
    const unsubStream = ipc.onSqitchStream((event) => {
      setIsOpen(true);
      const lines = event.data.split("\n");
      for (const line of lines) {
        if (line.trim()) writeLine(line, event.type);
      }
    });

    const unsubComplete = ipc.onSqitchComplete(() => {
      if (xtermRef.current) {
        xtermRef.current.writeln("\x1b[32m--- Command completed ---\x1b[0m");
      }
    });

    const unsubError = ipc.onSqitchError((event) => {
      setIsOpen(true);
      writeLine(`ERROR: ${event.error}`, "stderr");
    });

    return () => {
      unsubStream();
      unsubComplete();
      unsubError();
    };
  }, [ipc, writeLine]);

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(
          150,
          Math.min(window.innerHeight * 0.5, startHeight + delta),
        );
        setHeight(newHeight);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        fitRef.current?.fit();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height],
  );

  return (
    <div
      className="border-t bg-background flex flex-col"
      style={{ height: isOpen ? height : 32 }}
    >
      <div
        className="flex items-center justify-between px-3 py-1 bg-muted/50 cursor-pointer select-none border-b"
        onClick={handleToggle}
      >
        <span className="text-xs font-medium">Terminal</span>
        <div className="flex gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {isOpen ? "▼" : "▲"}
          </span>
        </div>
      </div>

      {/* Resize handle */}
      {isOpen && (
        <div
          className="h-1 cursor-ns-resize bg-border hover:bg-primary/50"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden px-1"
        style={{ display: isOpen ? "block" : "none" }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ && git commit -m "feat: implement TerminalPanel with xterm.js streaming"
```

---

### Task 3: Create ProgressUI component

**Files:**

- Create: `src/components/progress/ProgressUI.tsx`

- [ ] **Step 1: Create ProgressUI**

```tsx
import { useProjectStore } from "../../store/project";
import { useIpc } from "../../hooks/useIpc";

export function ProgressUI() {
  const { events, isRunning } = useProjectStore();
  const ipc = useIpc();

  if (events.length === 0 && !isRunning) return null;

  const completed = events.filter(
    (e) => e.status === "ok" || e.status === "not_ok" || e.status === "failed",
  ).length;
  const total = events.length || 1;
  const progress = (completed / total) * 100;
  const hasFailed = events.some((e) => e.status === "failed");

  return (
    <div className="border-b bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {isRunning ? "Running..." : hasFailed ? "Failed" : "Completed"}
        </span>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} changes
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${hasFailed ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-0.5">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span>
              {event.status === "ok"
                ? "✔"
                : event.status === "failed"
                  ? "✕"
                  : event.status === "not_ok"
                    ? "✕"
                    : "⟳"}
            </span>
            <span className="font-mono">{event.change}</span>
            {event.target && (
              <span className="text-muted-foreground">→ {event.target}</span>
            )}
          </div>
        ))}
      </div>

      {isRunning && (
        <button
          onClick={() => {
            ipc.sqitchCancel();
            useProjectStore.getState().setRunning(false);
          }}
          className="mt-2 px-3 py-1 border border-destructive text-destructive rounded text-xs hover:bg-destructive/10"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire ProgressUI and TerminalPanel into ProjectPage**

Update `src/pages/ProjectPage/ProjectPage.tsx` to include both components:

```tsx
import { ProgressUI } from "../../components/progress/ProgressUI";
import { TerminalPanel } from "../../components/terminal/TerminalPanel";
// ... inside the return, wrap content:
<div className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-1 p-6 overflow-y-auto">
    <h2 className="text-xl font-semibold mb-4 capitalize">
      {section ?? "Select a section"}
    </h2>
    {renderSection()}
  </div>
  <ProgressUI />
  <TerminalPanel />
</div>;
```

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement ProgressUI and wire TerminalPanel into ProjectPage"
```
