# Plan 4a: UI Shell — Zustand Store & Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Zustand navigation store, App.tsx routing, and main layout shell (sidebar + main panel).

**Architecture:** State-driven rendering — no URL router. Zustand store holds `{ view, projectId, section }`. Sidebar and main panel read from store. Layout uses Tailwind + shadcn/ui components.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS v4, shadcn/ui

---

### Task 1: Install shadcn/ui components needed for layout

**Files:**
- Modify: `package.json` (via npx)

- [ ] **Step 1: Add shadcn components**

```bash
npx shadcn@latest add button card scroll-area separator tooltip dialog input select tabs badge
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui layout components"
```

---

### Task 2: Create navigation store

**Files:**
- Create: `src/store/navigation.ts`

- [ ] **Step 1: Implement navigation store**

Create `src/store/navigation.ts`:

```typescript
import { create } from 'zustand';

export type View = 'home' | 'project';
export type Section =
  | 'plan'
  | 'deploy'
  | 'revert'
  | 'status'
  | 'verify'
  | 'log'
  | 'engine'
  | 'target'
  | 'config';

interface NavigationState {
  view: View;
  projectId: string | null;
  section: Section | null;
  showCommands: boolean;
  commandTooltipDismissed: boolean;
}

interface NavigationActions {
  goHome: () => void;
  openProject: (projectId: string) => void;
  setSection: (section: Section) => void;
  toggleShowCommands: () => void;
  dismissCommandTooltip: () => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => ({
  view: 'home',
  projectId: null,
  section: null,
  showCommands: false,
  commandTooltipDismissed: false,

  goHome: () => set({ view: 'home', projectId: null, section: null }),

  openProject: (projectId) => set({ view: 'project', projectId, section: 'plan' }),

  setSection: (section) => set({ section }),

  toggleShowCommands: () => set((state) => ({ showCommands: !state.showCommands })),

  dismissCommandTooltip: () => set({ commandTooltipDismissed: true }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/navigation.ts
git commit -m "feat: add Zustand navigation store with view/section/command toggle"
```

---

### Task 3: Create project store

**Files:**
- Create: `src/store/project.ts`

- [ ] **Step 1: Implement project store**

Create `src/store/project.ts`:

```typescript
import { create } from 'zustand';
import type { DeploymentStatus, DeployedChange, LogEntry } from '../types/deployment';
import type { PlanFile } from '../types/plan';
import type { ConfigEntry } from '../types/config';
import type { SqitchEvent } from '../types/sqitch-event';
import type { AppError } from '../types/error';

interface ProjectState {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
    lastDeployment?: string;
    lastOpened: string;
  }>;
  currentProjectId: string | null;
  plan: PlanFile | null;
  status: DeploymentStatus | null;
  log: LogEntry[];
  config: ConfigEntry[];
  events: SqitchEvent[];
  error: AppError | null;
  isRunning: boolean;
  statusStale: boolean;
  lastStatusRefresh: number | null;
}

interface ProjectActions {
  setProjects: (projects: ProjectState['projects']) => void;
  setCurrentProject: (id: string | null) => void;
  setPlan: (plan: PlanFile | null) => void;
  setStatus: (status: DeploymentStatus | null) => void;
  setLog: (log: LogEntry[]) => void;
  setConfig: (config: ConfigEntry[]) => void;
  addEvent: (event: SqitchEvent) => void;
  clearEvents: () => void;
  setError: (error: AppError | null) => void;
  setRunning: (running: boolean) => void;
  setStatusStale: (stale: boolean) => void;
  markStatusStale: () => void;
  setLastStatusRefresh: (timestamp: number) => void;
  reset: () => void;
}

const initialState: ProjectState = {
  projects: [],
  currentProjectId: null,
  plan: null,
  status: null,
  log: [],
  config: [],
  events: [],
  error: null,
  isRunning: false,
  statusStale: false,
  lastStatusRefresh: null,
};

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  ...initialState,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (id) => set({ currentProjectId: id }),
  setPlan: (plan) => set({ plan }),
  setStatus: (status) => set({ status, statusStale: false }),
  setLog: (log) => set({ log }),
  setConfig: (config) => set({ config }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  clearEvents: () => set({ events: [] }),
  setError: (error) => set({ error }),
  setRunning: (running) => set({ isRunning: running }),
  setStatusStale: (stale) => set({ statusStale: stale }),
  markStatusStale: () => set({ statusStale: true }),
  setLastStatusRefresh: (timestamp) => set({ lastStatusRefresh: timestamp, statusStale: false }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/project.ts
git commit -m "feat: add Zustand project store for state management"
```

---

### Task 4: Create layout components

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/MainPanel.tsx`
- Create: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `src/components/layout/Sidebar.tsx`:

```tsx
import { useNavigationStore, type Section } from '../../store/navigation';
import { useProjectStore } from '../../store/project';

const devSections: { id: Section; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'revert', label: 'Revert' },
  { id: 'status', label: 'Status' },
  { id: 'verify', label: 'Verify' },
  { id: 'log', label: 'Log' },
];

const setupSections: { id: Section; label: string }[] = [
  { id: 'engine', label: 'Engine' },
  { id: 'target', label: 'Target' },
  { id: 'config', label: 'Config' },
];

export function Sidebar() {
  const { view, section, setSection, goHome, showCommands, toggleShowCommands, commandTooltipDismissed, dismissCommandTooltip } = useNavigationStore();
  const currentProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId)
  );

  if (view === 'home') {
    return (
      <aside className="w-56 border-r bg-muted/30 flex flex-col p-4">
        <h1 className="text-lg font-semibold mb-4">UnSqitch</h1>
        <p className="text-sm text-muted-foreground">Select or open a project</p>
      </aside>
    );
  }

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <button
          onClick={goHome}
          className="text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          ← Back
        </button>
        <h2 className="text-sm font-semibold truncate">{currentProject?.name ?? 'Project'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-1">Development</p>
        {devSections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              section === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}

        <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-4 mb-1">Setup</p>
        {setupSections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              section === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-3 border-t">
        <div className="relative">
          <button
            onClick={toggleShowCommands}
            className={`text-xs px-2 py-1 rounded border ${
              showCommands ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            }`}
          >
            &lt;/&gt; Show Commands
          </button>
          {!commandTooltipDismissed && !showCommands && (
            <div className="absolute bottom-full left-0 mb-2 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs w-48 shadow-md">
              Toggle this to see the exact sqitch CLI commands behind each action.
              <button onClick={dismissCommandTooltip} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create MainPanel component**

Create `src/components/layout/MainPanel.tsx`:

```tsx
import { useNavigationStore } from '../../store/navigation';
import { HomePage } from '../../pages/HomePage/HomePage';
import { ProjectPage } from '../../pages/ProjectPage/ProjectPage';

export function MainPanel() {
  const view = useNavigationStore((s) => s.view);

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      {view === 'home' ? <HomePage /> : <ProjectPage />}
    </main>
  );
}
```

- [ ] **Step 3: Create AppLayout component**

Create `src/components/layout/AppLayout.tsx`:

```tsx
import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';

export function AppLayout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <MainPanel />
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder page components**

Create `src/pages/HomePage/HomePage.tsx`:

```tsx
export function HomePage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Welcome to UnSqitch</h2>
        <p className="text-muted-foreground mb-4">
          Open a directory containing a Sqitch project to get started.
        </p>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
          Open a Project
        </button>
      </div>
    </div>
  );
}
```

Create `src/pages/ProjectPage/ProjectPage.tsx`:

```tsx
import { useNavigationStore } from '../../store/navigation';

export function ProjectPage() {
  const section = useNavigationStore((s) => s.section);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4 capitalize">{section ?? 'Select a section'}</h2>
      <p className="text-muted-foreground">Section content will be implemented in Plan 5.</p>
    </div>
  );
}
```

- [ ] **Step 5: Wire App.tsx**

Replace `src/App.tsx`:

```tsx
import { AppLayout } from './components/layout/AppLayout';

export default function App() {
  return <AppLayout />;
}
```

- [ ] **Step 6: Verify app runs**

```bash
npm run dev
```

Expected: Electron window opens with sidebar showing UnSqitch branding and main panel showing home view.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: implement layout shell with sidebar, navigation store, and placeholder pages"
```

---

### Task 5: Create convenience hooks

**Files:**
- Create: `src/hooks/useProject.ts`
- Create: `src/hooks/useSqitchCommand.ts`

- [ ] **Step 1: Implement useProject hook**

Create `src/hooks/useProject.ts`:

```typescript
import { useProjectStore } from '../store/project';
import { useNavigationStore } from '../store/navigation';
import { useIpc } from './useIpc';

export function useProject() {
  const { currentProjectId, projects, status, plan, isRunning, statusStale, setStatus, setPlan, setRunning, setLastStatusRefresh } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId) ?? null;
  const ipc = useIpc();

  const refreshStatus = async (target: string) => {
    if (!project || !target) return;
    const result = await ipc.sqitchStatus(project.path, target);
    setStatus(result as any);
    setLastStatusRefresh(Date.now());
  };

  const refreshPlan = async () => {
    if (!project) return;
    const result = await ipc.sqitchPlan(project.path);
    setPlan(result as any);
  };

  return { project, status, plan, isRunning, statusStale, refreshStatus, refreshPlan, setRunning };
}
```

- [ ] **Step 2: Implement useSqitchCommand hook**

Create `src/hooks/useSqitchCommand.ts`:

```typescript
import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project';
import { useIpc } from './useIpc';

interface CommandState {
  isRunning: boolean;
  error: string | null;
  output: string;
}

export function useSqitchCommand() {
  const ipc = useIpc();
  const [state, setState] = useState<CommandState>({ isRunning: false, error: null, output: '' });

  const run = useCallback(async (
    command: 'deploy' | 'revert' | 'verify' | 'status' | 'log' | 'add' | 'init',
    args: Record<string, any>
  ) => {
    setState({ isRunning: true, error: null, output: '' });
    useProjectStore.getState().setRunning(true);
    try {
      let result: any;
      switch (command) {
        case 'deploy':
          result = await ipc.sqitchDeploy(args.projectPath, args.target, args.toChange);
          break;
        case 'revert':
          result = await ipc.sqitchRevert(args.projectPath, args.target, args.toChange);
          break;
        case 'verify':
          result = await ipc.sqitchVerify(args.projectPath, args.target);
          break;
        case 'status':
          result = await ipc.sqitchStatus(args.projectPath, args.target);
          break;
        case 'log':
          result = await ipc.sqitchLog(args.projectPath, args.target);
          break;
        case 'add':
          result = await ipc.sqitchAdd(args.projectPath, args.name, args.note, args.requires, args.conflicts);
          break;
        case 'init':
          result = await ipc.sqitchInit(args.directory, args.name, args.engine, args.uri, args.topDir, args.planFile);
          break;
      }
      setState({ isRunning: false, error: null, output: result?.stdout ?? '' });
      return result;
    } catch (err: any) {
      setState({ isRunning: false, error: err.message ?? String(err), output: '' });
      throw err;
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  }, [ipc]);

  return { ...state, run };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProject.ts src/hooks/useSqitchCommand.ts
git commit -m "feat: add useProject and useSqitchCommand convenience hooks"
```