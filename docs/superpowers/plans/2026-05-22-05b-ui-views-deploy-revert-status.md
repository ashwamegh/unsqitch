# Plan 5b: UI Views — Deploy, Revert, Status

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Deploy view (form + preview + run), Revert view (click-to-revert with confirmation), and Status view (dashboard cards + changes list).

**Architecture:** Each view uses `useIpc()` to call sqitch commands via IPC. Deploy/Revert show preview before executing. Status renders parsed `DeploymentStatus`. Natural language summaries generated from data.

**Tech Stack:** React 18, TypeScript, shadcn/ui

---

### Task 1: Implement Deploy view

**Files:**
- Create: `src/pages/ProjectPage/DeployView.tsx`
- Create: `src/components/progress/DeployPreview.tsx`

- [ ] **Step 1: Create DeployPreview component**

Create `src/components/progress/DeployPreview.tsx`:

```tsx
interface DeployPreviewProps {
  pendingChanges: string[];
  target: string;
  showCommand: boolean;
  toChange?: string;
}

export function DeployPreview({ pendingChanges, target, showCommand, toChange }: DeployPreviewProps) {
  const count = pendingChanges.length;
  const summary = toChange
    ? `You're about to deploy ${count} changes to ${target}, up to "${toChange}".`
    : `You're about to deploy ${count} new change${count > 1 ? 's' : ''} to ${target}.`;

  return (
    <div className="border rounded-lg p-4 mb-4 bg-muted/30">
      <p className="text-sm mb-3">{summary}</p>
      <div className="space-y-1">
        {pendingChanges.map((change, i) => (
          <div key={i} className="text-xs font-mono flex items-center gap-2">
            <span className="text-green-500">+ {change}</span>
          </div>
        ))}
      </div>
      {showCommand && (
        <div className="mt-3 p-2 bg-background rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
          <span>sqitch deploy {target}{toChange ? ` --to ${toChange}` : ''} --verify</span>
          <button onClick={() => navigator.clipboard.writeText(`sqitch deploy ${target}${toChange ? ` --to ${toChange}` : ''} --verify`)} className="ml-2 text-xs hover:text-foreground">Copy</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create DeployView**

Create `src/pages/ProjectPage/DeployView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';
import { DeployPreview } from '../../components/progress/DeployPreview';

export function DeployView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [confirmedTarget, setConfirmedTarget] = useState('');
  const [toChange, setToChange] = useState('');

  const project = projects.find((p) => p.id === currentProjectId);
  const pending = status?.pending ?? [];

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc.sqitchStatus(project.path, confirmedTarget).then((result) => {
        setStatus(result as any);
      }).catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleDeploy = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    try {
      useProjectStore.getState().setRunning(true);
      await ipc.sqitchDeploy(project.path, target, toChange || undefined);
      // Refresh status after deploy
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
    } catch (err) {
      console.error('Deploy failed:', err);
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
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Deploy to (optional)</label>
          <input
            type="text"
            value={toChange}
            onChange={(e) => setToChange(e.target.value)}
            placeholder="Leave empty for all pending"
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      {pending.length > 0 && (
        <DeployPreview
          pendingChanges={pending}
          target={target}
          showCommand={showCommands}
          toChange={toChange || undefined}
        />
      )}

      <button
        onClick={handleDeploy}
        disabled={isRunning || !target}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {isRunning ? 'Deploying...' : 'Deploy'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Deploy view with preview and form"
```

---

### Task 2: Implement Revert view

**Files:**
- Create: `src/pages/ProjectPage/RevertView.tsx`

- [ ] **Step 1: Create RevertView**

Create `src/pages/ProjectPage/RevertView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';
import type { DeployedChange, DeploymentStatus } from '../../types/deployment';

export function RevertView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [confirmedTarget, setConfirmedTarget] = useState('');
  const [revertTo, setRevertTo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [productionLabel, setProductionLabel] = useState<string | undefined>(undefined);

  const project = projects.find((p) => p.id === currentProjectId);
  const deployed = status?.deployed ?? [];
  const LARGE_REVERT_THRESHOLD = 5;

  // Check if target is labeled production (via target_labels table, not settings)
  useEffect(() => {
    if (project && confirmedTarget) {
      ipc.targetGetLabel(project.id, confirmedTarget).then((r: any) => {
        setProductionLabel(r.label ?? undefined);
      }).catch(() => setProductionLabel(undefined));
    }
  }, [project, confirmedTarget]);

  const isProduction = productionLabel === 'production';

  // Determine what would be reverted
  const revertToIndex = deployed.findIndex((c) => c.name === revertTo);
  const changesToRevert = revertToIndex >= 0
    ? deployed.slice(revertToIndex + 1)
    : revertTo
      ? deployed // revert all if no specific change
      : deployed.length > 1
        ? [deployed[deployed.length - 1]] // revert latest only
        : deployed;

  const remainingCount = deployed.length - changesToRevert.length;
  const requiresConfirm = changesToRevert.length >= LARGE_REVERT_THRESHOLD;

  // Dependency-aware blocking: check if any change NOT being reverted depends on a change being reverted
  const remainingChanges = revertToIndex >= 0 ? deployed.slice(0, revertToIndex + 1) : [];
  const blockedByDeps: string[] = [];
  for (const remaining of remainingChanges) {
    for (const req of remaining.requires) {
      if (changesToRevert.some((c) => c.name === req)) {
        blockedByDeps.push(remaining.name);
        break;
      }
    }
  }
  const hasDepBlockers = blockedByDeps.length > 0;

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc.sqitchStatus(project.path, confirmedTarget).then((result) => {
        setStatus(result as DeploymentStatus);
      }).catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleRevert = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    if (isProduction && confirmText !== 'REVERT PRODUCTION') return;
    if (!isProduction && requiresConfirm && confirmText !== String(changesToRevert.length)) return;

    try {
      useProjectStore.getState().setRunning(true);
      const toChangeArg = revertTo || (deployed.length <= 1 ? undefined : deployed[deployed.length - 2]?.name);
      await ipc.sqitchRevert(project.path, target, toChangeArg);
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as DeploymentStatus);
      setConfirming(false);
      setConfirmText('');
    } catch (err) {
      console.error('Revert failed:', err);
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
      </div>

      {deployed.length > 0 && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30">
          <p className="text-sm font-medium mb-2">Deployed changes</p>
          <div className="space-y-1">
            {deployed.map((change) => (
              <div key={change.changeId} className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => setRevertTo(change.name)}
                  className={`text-left hover:underline ${revertTo === change.name ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  {change.name}
                </button>
                {change.tags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({change.tags.map(t => `@${t}`).join(', ')})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {revertTo && (
        <div className={`border rounded p-4 mb-4 ${isProduction ? 'border-red-600 bg-red-600/10' : 'border-red-500/50 bg-red-500/10'}`}>
          <p className={`text-sm mb-2 ${isProduction ? 'text-red-700 font-semibold' : 'text-red-600'}`}>
            This will undo {changesToRevert.length} change{changesToRevert.length > 1 ? 's' : ''}.
            {remainingCount} change{remainingCount !== 1 ? 's' : ''} will remain deployed, including "{revertTo}".
          </p>
          {isProduction && (
            <p className="text-sm text-red-700 font-bold mb-2">
              WARNING: "{target}" is a PRODUCTION target. Destructive actions require extra confirmation.
            </p>
          )}
          {hasDepBlockers && (
            <div className="mb-2 p-2 border border-yellow-500 bg-yellow-500/10 rounded">
              <p className="text-sm text-yellow-700 font-medium">Blocked by dependencies</p>
              <p className="text-xs text-yellow-600">
                The following remaining changes depend on changes being reverted: {blockedByDeps.join(', ')}.
                Revert these dependent changes first, or revert all at once.
              </p>
            </div>
          )}
          {changesToRevert.map((c) => (
            <div key={c.changeId} className="text-xs font-mono text-red-500">✕ {c.name}</div>
          ))}
          {showCommands && (
            <div className="mt-2 p-2 bg-background rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>sqitch revert {target} --to {revertTo} -y</span>
              <button onClick={() => navigator.clipboard.writeText(`sqitch revert ${target} --to ${revertTo} -y`)} className="ml-2 text-xs hover:text-foreground">Copy</button>
            </div>
          )}
        </div>
      )}

      {confirming && requiresConfirm && !isProduction && (
        <div className="mb-4">
          <label className="text-sm block mb-1">
            Type <strong>{changesToRevert.length}</strong> to confirm revert:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-background w-32"
          />
        </div>
      )}

      {confirming && isProduction && (
        <div className="mb-4">
          <label className="text-sm block mb-1 text-red-700 font-semibold">
            Type <strong>REVERT PRODUCTION</strong> to confirm revert on production target:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="border border-red-600 rounded px-3 py-1.5 text-sm bg-background w-64"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(true)}
          disabled={isRunning || !target || !revertTo || hasDepBlockers}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
        >
          Preview Revert
        </button>
        {confirming && (
          <button
            onClick={handleRevert}
            disabled={isRunning || (requiresConfirm && confirmText !== String(changesToRevert.length)) || (isProduction && confirmText !== 'REVERT PRODUCTION')}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
          >
            Confirm Revert
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: implement Revert view with preview and confirmation"
```

---

### Task 3: Implement Status view

**Files:**
- Create: `src/pages/ProjectPage/StatusView.tsx`

- [ ] **Step 1: Create StatusView**

Create `src/pages/ProjectPage/StatusView.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/project';
import { useIpc } from '../../hooks/useIpc';

export function StatusView() {
  const { status, currentProjectId, projects, setStatus, setLastStatusRefresh } = useProjectStore();
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [confirmedTarget, setConfirmedTarget] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const project = projects.find((p) => p.id === currentProjectId);

  const deployed = status?.deployed ?? [];
  const pending = status?.pending ?? [];
  const paged = deployed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(deployed.length / PAGE_SIZE);

  const handleRefresh = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    try {
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
      setLastStatusRefresh(Date.now());
    } catch (err) {
      console.error('Status refresh failed:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
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
          onClick={handleRefresh}
          className="px-3 py-1.5 border rounded text-sm hover:bg-muted mt-5"
        >
          Refresh
        </button>
      </div>

      {status && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{deployed.length}</div>
              <div className="text-xs text-muted-foreground">Deployed</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{pending.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{status.lastChange || '—'}</div>
              <div className="text-xs text-muted-foreground">Last Change</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{deployed.length > 0 ? deployed[0].name : '—'}</div>
              <div className="text-xs text-muted-foreground">First Deployed</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-2">Deployed Changes</h3>
          <div className="space-y-1">
            {paged.map((change) => (
              <div key={change.changeId} className="flex items-center justify-between border rounded px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{change.name}</span>
                  {change.tags.length > 0 && (
                    <span className="text-muted-foreground">
                      {change.tags.map(t => `@${t}`).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {change.deployedAt} · {change.deployedBy}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update ProjectPage to route to all section views**

Replace `src/pages/ProjectPage/ProjectPage.tsx`:

```tsx
import { useNavigationStore } from '../../store/navigation';
import { useProjectStore } from '../../store/project';
import { DeployView } from './DeployView';
import { RevertView } from './RevertView';
import { StatusView } from './StatusView';

export function ProjectPage() {
  const section = useNavigationStore((s) => s.section);

  const renderSection = () => {
    switch (section) {
      case 'deploy': return <DeployView />;
      case 'revert': return <RevertView />;
      case 'status': return <StatusView />;
      default: return <p className="text-muted-foreground">{section} view — coming soon</p>;
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4 capitalize">{section ?? 'Select a section'}</h2>
      {renderSection()}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Status view and wire all section views in ProjectPage"
```