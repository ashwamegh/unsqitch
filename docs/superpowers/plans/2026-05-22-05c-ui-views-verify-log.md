# Plan 5c: UI Views — Verify & Log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Verify view (run verify + per-change results) and Log view (chronological deployment history).

**Tech Stack:** React 18, TypeScript, shadcn/ui

---

### Task 1: Implement Verify view

**Files:**

- Create: `src/pages/ProjectPage/VerifyView.tsx`

- [ ] **Step 1: Create VerifyView**

```tsx
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";

export function VerifyView() {
  const { currentProjectId, projects, isRunning } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState("");
  const [results, setResults] = useState<
    Array<{ change: string; status: string; raw: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === currentProjectId);

  const handleVerify = async () => {
    if (!project || !target) return;
    setError(null);
    try {
      useProjectStore.getState().setRunning(true);
      const result = await ipc.sqitchVerify(project.path, target);
      setResults((result as any).events || []);
    } catch (err: any) {
      setError(err.message || "Verify failed");
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Target</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g., mydb"
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <button
          onClick={handleVerify}
          disabled={isRunning || !target}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 mt-5"
        >
          {isRunning ? "Verifying..." : "Run Verify"}
        </button>
      </div>

      {showCommands && target && (
        <div className="mb-4 p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
          sqitch verify {target}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 border border-destructive rounded text-sm text-destructive">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border rounded px-3 py-2 text-xs"
            >
              <span>
                {r.status === "ok" ? "✔" : r.status === "not_ok" ? "✕" : "⟳"}
              </span>
              <span className="font-mono">{r.change}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update ProjectPage switch to include verify**

Add `case 'verify': return <VerifyView />;` to the switch in `src/pages/ProjectPage/ProjectPage.tsx` and import `VerifyView`.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Verify view with per-change results"
```

---

### Task 2: Implement Log view

**Files:**

- Create: `src/pages/ProjectPage/LogView.tsx`

- [ ] **Step 1: Create LogView**

```tsx
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";
import type { LogEntry } from "../../types/deployment";

export function LogView() {
  const { currentProjectId, projects, isRunning } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const project = projects.find((p) => p.id === currentProjectId);

  const handleFetchLog = async () => {
    if (!project || !target) return;
    try {
      useProjectStore.getState().setRunning(true);
      const result = await ipc.sqitchLog(project.path, target);
      setEntries(result as any);
    } catch (err) {
      console.error("Log fetch failed:", err);
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Target</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g., mydb"
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <button
          onClick={handleFetchLog}
          disabled={isRunning || !target}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 mt-5"
        >
          {isRunning ? "Loading..." : "Fetch Log"}
        </button>
      </div>

      {showCommands && target && (
        <div className="mb-4 p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
          sqitch log {target}
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={i} className="border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${entry.action === "deploy" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}
                >
                  {entry.action}
                </span>
                <span className="font-mono text-sm font-medium">
                  {entry.change}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {entry.timestamp}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.committer.name} &lt;{entry.committer.email}&gt;
            </div>
            {entry.note && <div className="text-xs mt-1">{entry.note}</div>}
            {entry.tags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {entry.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                  >
                    @{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ProjectPage switch to include log**

Add `case 'log': return <LogView />;` and import `LogView`.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Log view with deployment history"
```
