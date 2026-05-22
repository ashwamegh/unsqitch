# Plan 5e: UI Views — Settings & Init

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Settings dialog and Init (new project) flow accessible from Home view.

**Tech Stack:** React 18, TypeScript, shadcn/ui

---

### Task 1: Implement Settings dialog

**Files:**
- Create: `src/components/shared/SettingsDialog.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create SettingsDialog**

```tsx
import { useState, useEffect } from 'react';
import { useIpc } from '../../hooks/useIpc';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const [sqitchPath, setSqitchPath] = useState('');
  const [editor, setEditor] = useState('');
  const [theme, setTheme] = useState('system');
  const [showCommandsDefault, setShowCommandsDefault] = useState(false);
  const [timeout, setTimeout_] = useState('300000');
  const [scrollback, setScrollback] = useState('10000');
  const [revertThreshold, setRevertThreshold] = useState('5');

  useEffect(() => {
    if (!open) return;
    ipc.settingsGet('sqitchPath').then((r: any) => setSqitchPath(r.value || ''));
    ipc.settingsGet('editor').then((r: any) => setEditor(r.value || ''));
    ipc.settingsGet('theme').then((r: any) => setTheme(r.value || 'system'));
    ipc.settingsGet('showCommandsDefault').then((r: any) => setShowCommandsDefault(r.value === 'true'));
    ipc.settingsGet('commandTimeout').then((r: any) => setTimeout_(r.value || '300000'));
    ipc.settingsGet('scrollbackBuffer').then((r: any) => setScrollback(r.value || '10000'));
    ipc.settingsGet('revertThreshold').then((r: any) => setRevertThreshold(r.value || '5'));
  }, [open]);

  const handleSave = async () => {
    try {
      await ipc.settingsSet('sqitchPath', sqitchPath);
      await ipc.settingsSet('editor', editor);
      await ipc.settingsSet('theme', theme);
      await ipc.settingsSet('showCommandsDefault', String(showCommandsDefault));
      await ipc.settingsSet('commandTimeout', timeout);
      await ipc.settingsSet('scrollbackBuffer', scrollback);
      await ipc.settingsSet('revertThreshold', revertThreshold);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Sqitch Binary Path</label>
            <input value={sqitchPath} onChange={(e) => setSqitchPath(e.target.value)} placeholder="Auto-detected" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
            <p className="text-xs text-muted-foreground mt-1">Leave empty for auto-detection via PATH</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">External Editor</label>
            <input value={editor} onChange={(e) => setEditor(e.target.value)} placeholder="code (auto-detected from $EDITOR)" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Show Commands Default</label>
            <input type="checkbox" checked={showCommandsDefault} onChange={(e) => setShowCommandsDefault(e.target.checked)} className="ml-2" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Command Timeout (ms)</label>
            <input type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Terminal Scrollback Buffer</label>
            <input type="number" value={scrollback} onChange={(e) => setScrollback(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Large Revert Warning Threshold</label>
            <input type="number" value={revertThreshold} onChange={(e) => setRevertThreshold(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add settings button to Sidebar**

In `src/components/layout/Sidebar.tsx`, add state and the SettingsDialog:

```tsx
import { useState } from 'react';
import { SettingsDialog } from '../shared/SettingsDialog';
// ... inside Sidebar component:
const [settingsOpen, setSettingsOpen] = useState(false);
// ... add before closing </aside>:
<button onClick={() => setSettingsOpen(true)} className="text-sm text-muted-foreground hover:text-foreground">Settings</button>
<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement Settings dialog"
```

---

### Task 2: Implement Init (new project) flow

**Files:**
- Create: `src/pages/HomePage/InitProjectDialog.tsx`
- Modify: `src/pages/HomePage/HomePage.tsx`

- [ ] **Step 1: Create InitProjectDialog**

```tsx
import { useState } from 'react';
import { useIpc } from '../../hooks/useIpc';
import { useNavigationStore } from '../../store/navigation';

type EngineType = 'pg' | 'mysql' | 'sqlite' | 'cockroach' | 'yugabyte';

export function InitProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const openProject = useNavigationStore((s) => s.openProject);
  const [directory, setDirectory] = useState('');
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<EngineType>('pg');
  const [uri, setUri] = useState('');
  const [topDir, setTopDir] = useState('.');
  const [planFile, setPlanFile] = useState('sqitch.plan');
  const [loading, setLoading] = useState(false);
  const showCommands = useNavigationStore((s) => s.showCommands);

  const handleInit = async () => {
    if (!directory || !name) return;
    setLoading(true);
    try {
      await ipc.sqitchInit(directory, name, engine, uri, topDir, planFile);
      const response = await ipc.projectOpen(directory);
      if (response.error) {
        console.error('Open after init failed:', response.error);
        return;
      }
      openProject(response.project.id);
      onClose();
    } catch (err) {
      console.error('Init failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Project Directory</label>
            <input value={directory} onChange={(e) => setDirectory(e.target.value)} placeholder="/path/to/new/project" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Engine</label>
            <select value={engine} onChange={(e) => setEngine(e.target.value as EngineType)} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="pg">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="cockroach">CockroachDB</option>
              <option value="yugabyte">YugabyteDB</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">URI</label>
            <input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="db:pg://localhost/mydb" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium block mb-1">Top Directory</label><input value={topDir} onChange={(e) => setTopDir(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
            <div><label className="text-sm font-medium block mb-1">Plan File</label><input value={planFile} onChange={(e) => setPlanFile(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
              sqitch init {name} --engine {engine} --uri {uri || '...'} --top-dir {topDir}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button onClick={handleInit} disabled={loading || !directory || !name} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50">
            {loading ? 'Initializing...' : 'Initialize'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Init dialog to HomePage**

In `src/pages/HomePage/HomePage.tsx`, add:

```tsx
import { useState } from 'react';
import { InitProjectDialog } from './InitProjectDialog';
// ... inside HomePage component:
const [initOpen, setInitOpen] = useState(false);
// ... add "New Project" button next to "Open a Project"
<button onClick={() => setInitOpen(true)} className="text-sm text-primary hover:underline">or create a new project</button>
<InitProjectDialog open={initOpen} onClose={() => setInitOpen(false)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement Init project dialog and Settings dialog"
```