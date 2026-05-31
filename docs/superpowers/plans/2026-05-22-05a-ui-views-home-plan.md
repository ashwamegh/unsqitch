# Plan 5a: UI Views — Home & Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Home view (project list + open/init) and Plan view (timeline of sqitch.plan entries).

**Architecture:** Home view calls `useIpc()` to list/open/remove projects. Plan view calls `useIpc().sqitchPlan()` and renders parsed `PlanFile` as a timeline. Both use `useProjectStore` for state.

**Tech Stack:** React 18, TypeScript, Zustand, shadcn/ui, Tailwind

---

### Task 1: Implement Home view — project list and open/init

**Files:**

- Modify: `src/pages/HomePage/HomePage.tsx`
- Create: `src/components/shared/ProjectCard.tsx`

- [ ] **Step 1: Create ProjectCard component**

Create `src/components/shared/ProjectCard.tsx`:

```tsx
interface ProjectCardProps {
  name: string;
  engine: string;
  changeCount: number;
  lastDeployment?: string;
  onClick: () => void;
  onRemove: () => void;
}

export function ProjectCard({
  name,
  engine,
  changeCount,
  lastDeployment,
  onClick,
  onRemove,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors group relative"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">{name}</h3>
        <span className="text-xs bg-muted px-2 py-0.5 rounded">{engine}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {changeCount} changes
        {lastDeployment &&
          ` · Last deployed ${new Date(lastDeployment).toLocaleDateString()}`}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition-opacity"
        title="Remove from recent"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement HomePage with project list and directory picker**

Replace `src/pages/HomePage/HomePage.tsx`:

```tsx
import { useEffect } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";
import { ProjectCard } from "../../components/shared/ProjectCard";

export function HomePage() {
  const { projects, setProjects } = useProjectStore();
  const openProject = useNavigationStore((s) => s.openProject);
  const ipc = useIpc();

  useEffect(() => {
    ipc.projectList().then((result) => {
      setProjects(result.projects);
    });
  }, [setProjects]);

  const handleOpenProject = async () => {
    const result = await ipc.dialogOpenDirectory();
    if (result.canceled || !result.path) return;
    try {
      const response = await ipc.projectOpen(result.path);
      if (response.error) {
        alert(response.error);
        return;
      }
      openProject(response.project.id);
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const handleRemoveProject = async (id: string) => {
    await ipc.projectRemove(id);
    const result = await ipc.projectList();
    setProjects(result.projects);
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Welcome to UnSqitch</h2>
          <p className="text-muted-foreground mb-4">
            Open a directory containing a Sqitch project to get started.
          </p>
          <button
            onClick={handleOpenProject}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Open a Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          onClick={handleOpenProject}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
        >
          Open Project
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            name={p.name}
            engine={p.engine}
            changeCount={p.changeCount}
            lastDeployment={p.lastDeployment}
            onClick={() => openProject(p.id)}
            onRemove={() => handleRemoveProject(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Home view with project list and open/remove"
```

---

### Task 2: Implement Plan view — timeline display

**Files:**

- Create: `src/components/plan/PlanTimeline.tsx`
- Create: `src/components/plan/PlanEntry.tsx`
- Create: `src/components/plan/UnparseableWarning.tsx`
- Modify: `src/pages/ProjectPage/ProjectPage.tsx`

- [ ] **Step 1: Create UnparseableWarning component**

Create `src/components/plan/UnparseableWarning.tsx`:

```tsx
import { useState } from "react";

interface UnparseableWarningProps {
  lines: Array<{ line: string; index: number }>;
}

export function UnparseableWarning({ lines }: UnparseableWarningProps) {
  const [expanded, setExpanded] = useState(false);

  if (lines.length === 0) return null;

  return (
    <div className="border border-yellow-500/50 bg-yellow-500/10 rounded p-3 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-yellow-600 hover:text-yellow-500"
      >
        {lines.length} line{lines.length > 1 ? "s" : ""} in sqitch.plan could
        not be parsed
        <span className="ml-1">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="mt-2 text-xs font-mono bg-background/50 rounded p-2 max-h-40 overflow-y-auto">
          {lines.map((l) => (
            <div key={l.index} className="text-yellow-700">
              Line {l.index + 1}: {l.line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PlanEntry component**

Create `src/components/plan/PlanEntry.tsx`:

```tsx
import type { PlanEntry } from "../../types/plan";

interface PlanEntryProps {
  entry: PlanEntry;
  showCommand: boolean;
}

export function PlanEntry({ entry, showCommand }: PlanEntryProps) {
  if (entry.type === "pragma") {
    return (
      <div className="text-xs text-muted-foreground py-0.5 pl-4">
        % {entry.pragma!.key}={entry.pragma!.value}
      </div>
    );
  }

  if (entry.type === "tag") {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-4 border-l-2 border-primary/30 ml-2">
        <span className="bg-primary/20 text-primary text-xs font-mono px-2 py-0.5 rounded">
          @{entry.tag!.name}
        </span>
        <span className="text-xs text-muted-foreground">{entry.tag!.note}</span>
        {showCommand && (
          <span className="text-xs font-mono text-muted-foreground">
            sqitch tag {entry.tag!.name}
          </span>
        )}
      </div>
    );
  }

  if (entry.type === "change") {
    const change = entry.change!;
    return (
      <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-border ml-2 hover:bg-muted/30">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{change.name}</span>
          </div>
          {change.requires.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              ← requires {change.requires.join(", ")}
            </div>
          )}
          {change.conflicts.length > 0 && (
            <div className="text-xs text-red-500 mt-0.5">
              conflicts with {change.conflicts.join(", ")}
            </div>
          )}
          {change.note && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {change.note}
            </div>
          )}
        </div>
        {showCommand && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            sqitch add {change.name}
            {change.requires.map((r) => ` -r ${r}`).join("")}
            {change.conflicts.map((c) => ` -x ${c}`).join("")}
            {change.note ? ` -n "${change.note}"` : ""}
          </span>
        )}
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 3: Create PlanTimeline component**

Create `src/components/plan/PlanTimeline.tsx`:

```tsx
import type { PlanFile } from "../../types/plan";
import { PlanEntry } from "./PlanEntry";
import { UnparseableWarning } from "./UnparseableWarning";

interface PlanTimelineProps {
  plan: PlanFile;
  showCommand: boolean;
}

export function PlanTimeline({ plan, showCommand }: PlanTimelineProps) {
  return (
    <div>
      <UnparseableWarning lines={plan.unparseableLines} />
      <div className="space-y-0.5">
        {plan.entries.map((entry) => (
          <PlanEntry
            key={entry.index}
            entry={entry}
            showCommand={showCommand}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update ProjectPage to render sections**

Replace `src/pages/ProjectPage/ProjectPage.tsx`:

```tsx
import { useEffect } from "react";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import { useIpc } from "../../hooks/useIpc";
import { PlanTimeline } from "../../components/plan/PlanTimeline";

export function ProjectPage() {
  const section = useNavigationStore((s) => s.section);
  const showCommands = useNavigationStore((s) => s.showCommands);
  const { plan, currentProjectId, setPlan, projects } = useProjectStore();
  const ipc = useIpc();

  useEffect(() => {
    if (currentProjectId && section === "plan") {
      const project = projects.find((p) => p.id === currentProjectId);
      if (project) {
        ipc
          .sqitchPlan(project.path)
          .then((result) => {
            setPlan(result as any);
          })
          .catch(console.error);
      }
    }
  }, [currentProjectId, section]);

  const renderSection = () => {
    switch (section) {
      case "plan":
        return plan ? (
          <PlanTimeline plan={plan} showCommand={showCommands} />
        ) : (
          <p className="text-muted-foreground">Loading plan...</p>
        );
      default:
        return (
          <p className="text-muted-foreground">{section} view — coming soon</p>
        );
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4 capitalize">
        {section ?? "Select a section"}
      </h2>
      {renderSection()}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: implement Plan view timeline and Home view project cards"
```

---

### Task 3: Implement Add Change form

**Files:**

- Create: `src/components/plan/AddChangeForm.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add + Add Change button)

- [ ] **Step 1: Create AddChangeForm component**

Create `src/components/plan/AddChangeForm.tsx`:

```tsx
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";

export function AddChangeForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [requiresInput, setRequiresInput] = useState("");
  const [conflictsInput, setConflictsInput] = useState("");
  const [loading, setLoading] = useState(false);

  const requires = requiresInput.split(/[\s,]+/).filter(Boolean);
  const conflicts = conflictsInput.split(/[\s,]+/).filter(Boolean);

  const handleAdd = async () => {
    if (!project || !name) return;
    setLoading(true);
    try {
      await ipc.sqitchAdd(project.path, name, note, requires, conflicts);
      // Refresh plan after adding change
      const planResult = await ipc.sqitchPlan(project.path);
      useProjectStore.getState().setPlan(planResult as any);
      setName("");
      setNote("");
      setRequiresInput("");
      setConflictsInput("");
      onClose();
    } catch (err) {
      console.error("Add change failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-lg p-6 w-[450px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Add Change</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              Change Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., users"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Add users table"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Requires (space-separated)
            </label>
            <input
              value={requiresInput}
              onChange={(e) => setRequiresInput(e.target.value)}
              placeholder="e.g., appschema roles"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Conflicts (space-separated)
            </label>
            <input
              value={conflictsInput}
              onChange={(e) => setConflictsInput(e.target.value)}
              placeholder="e.g., legacy_auth"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
              sqitch add {name} -n "{note}"
              {requires.map((r) => ` -r ${r}`).join("")}
              {conflicts.map((c) => ` -x ${c}`).join("")}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || !name}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Change"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "+ Add Change" button to Sidebar (project view)**

In `src/components/layout/Sidebar.tsx`, add state and button inside the project view sidebar, after the Setup section and before the Show Commands toggle:

```tsx
import { useState } from 'react';
import { AddChangeForm } from '../plan/AddChangeForm';
// ... inside Sidebar component:
const [addChangeOpen, setAddChangeOpen] = useState(false);
// ... add after Setup section, before Show Commands:
<button
  onClick={() => setAddChangeOpen(true)}
  className="w-full text-left px-2 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 mt-4"
>
  + Add Change
</button>
<AddChangeForm open={addChangeOpen} onClose={() => setAddChangeOpen(false)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: implement Add Change form with sidebar button"
```
