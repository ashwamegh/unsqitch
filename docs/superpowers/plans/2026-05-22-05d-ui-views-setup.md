# Plan 5d: UI Views — Setup (Engine, Target, Config)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Engine, Target, and Config views for project setup.

**Tech Stack:** React 18, TypeScript, shadcn/ui

---

### Task 1: Implement Engine view

**Files:**

- Create: `src/pages/ProjectPage/EngineView.tsx`

- [ ] **Step 1: Create EngineView**

```tsx
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";

export function EngineView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [engines, setEngines] = useState<
    Array<{ name: string; target: string }>
  >([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [client, setClient] = useState("");

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.engineList(project.path);
    setEngines(result as any);
  };

  const handleAdd = async () => {
    if (!project || !name || !uri) return;
    await ipc.engineAdd(project.path, name, uri, client || undefined);
    setAdding(false);
    setName("");
    setUri("");
    setClient("");
    await handleList();
  };

  const handleRemove = async (engineName: string) => {
    if (!project) return;
    await ipc.engineRemove(project.path, engineName);
    await handleList();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Engines</h3>
        <div className="flex gap-2">
          <button
            onClick={handleList}
            className="px-3 py-1.5 border rounded text-sm hover:bg-muted"
          >
            Refresh
          </button>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          >
            Add Engine
          </button>
        </div>
      </div>

      {adding && (
        <div className="border rounded p-4 mb-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              Engine Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., pg"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">URI</label>
            <input
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="e.g., db:pg://localhost/mydb"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Client Path (optional)
            </label>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g., /usr/bin/psql"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>
                sqitch engine add {name} --target {uri}
                {client ? ` --client ${client}` : ""}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `sqitch engine add ${name} --target ${uri}${client ? ` --client ${client}` : ""}`,
                  )
                }
                className="ml-2 text-xs hover:text-foreground"
              >
                Copy
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {engines.map((e) => (
          <div
            key={e.name}
            className="border rounded p-3 flex items-center justify-between"
          >
            <div>
              <span className="font-mono text-sm font-medium">{e.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {e.target}
              </span>
            </div>
            <button
              onClick={() => handleRemove(e.name)}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to ProjectPage switch**

Add `case 'engine': return <EngineView />;` and import.

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement Engine view"
```

---

### Task 2: Implement Target view with URI builder

**Files:**

- Create: `src/pages/ProjectPage/TargetView.tsx`

- [ ] **Step 1: Create TargetView**

```tsx
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import { useNavigationStore } from "../../store/navigation";
import { useIpc } from "../../hooks/useIpc";

type EngineType = "pg" | "mysql" | "sqlite" | "cockroach" | "yugabyte";

function buildUri(engine: EngineType, fields: Record<string, string>): string {
  switch (engine) {
    case "pg":
      return `db:pg://${fields.user || "user"}${fields.password ? ":" + fields.password : ""}@${fields.host || "localhost"}:${fields.port || "5432"}/${fields.database || "mydb"}`;
    case "mysql":
      return `db:mysql://${fields.user || "user"}${fields.password ? ":" + fields.password : ""}@${fields.host || "localhost"}:${fields.port || "3306"}/${fields.database || "mydb"}`;
    case "sqlite":
      return `db:sqlite:${fields.path || "/path/to/db.sqlite"}`;
    case "cockroach":
      return `db:pg://${fields.user || "user"}${fields.password ? ":" + fields.password : ""}@${fields.host || "localhost"}:${fields.port || "26257"}/${fields.database || "mydb"}`;
    case "yugabyte":
      return `db:pg://${fields.user || "user"}${fields.password ? ":" + fields.password : ""}@${fields.host || "localhost"}:${fields.port || "5433"}/${fields.database || "mydb"}`;
  }
}

export function TargetView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [targets, setTargets] = useState<Array<{ name: string; uri: string }>>(
    [],
  );
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [engine, setEngine] = useState<EngineType>("pg");
  const [fields, setFields] = useState<Record<string, string>>({});

  const uri = buildUri(engine, fields);

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.targetList(project.path);
    setTargets(result as any);
    // Fetch labels for all targets
    const labelMap: Record<string, string> = {};
    for (const t of result as Array<{ name: string }>) {
      const r = await ipc.targetGetLabel(project.id, t.name);
      if ((r as any).label) labelMap[t.name] = (r as any).label;
    }
    setTargetLabels(labelMap);
  };

  const handleToggleProduction = async (targetName: string) => {
    if (!project) return;
    const currentLabel = targetLabels[targetName];
    const newLabel = currentLabel === "production" ? "" : "production";
    await ipc.targetSetLabel(project.id, targetName, newLabel);
    await handleList();
  };

  const handleAdd = async () => {
    if (!project || !targetName) return;
    await ipc.targetAdd(project.path, targetName, uri);
    setAdding(false);
    setTargetName("");
    setFields({});
    await handleList();
  };

  const handleRemove = async (name: string) => {
    if (!project) return;
    await ipc.targetRemove(project.path, name);
    await handleList();
  };

  const updateField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Targets</h3>
        <div className="flex gap-2">
          <button
            onClick={handleList}
            className="px-3 py-1.5 border rounded text-sm hover:bg-muted"
          >
            Refresh
          </button>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          >
            Add Target
          </button>
        </div>
      </div>

      {adding && (
        <div className="border rounded p-4 mb-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              Target Name
            </label>
            <input
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g., mydb"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Engine Type
            </label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as EngineType)}
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            >
              <option value="pg">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="cockroach">CockroachDB</option>
              <option value="yugabyte">YugabyteDB</option>
            </select>
          </div>
          {engine === "sqlite" ? (
            <div>
              <label className="text-sm font-medium block mb-1">
                Database File Path
              </label>
              <input
                value={fields.path || ""}
                onChange={(e) => updateField("path", e.target.value)}
                placeholder="/path/to/db.sqlite"
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Host</label>
                  <input
                    value={fields.host || ""}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="localhost"
                    className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Port</label>
                  <input
                    value={fields.port || ""}
                    onChange={(e) => updateField("port", e.target.value)}
                    placeholder={
                      engine === "mysql"
                        ? "3306"
                        : engine === "cockroach"
                          ? "26257"
                          : engine === "yugabyte"
                            ? "5433"
                            : "5432"
                    }
                    className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Database
                </label>
                <input
                  value={fields.database || ""}
                  onChange={(e) => updateField("database", e.target.value)}
                  placeholder="mydb"
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">User</label>
                  <input
                    value={fields.user || ""}
                    onChange={(e) => updateField("user", e.target.value)}
                    placeholder="user"
                    className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={fields.password || ""}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="•••••"
                    className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                  />
                  <span className="text-xs text-muted-foreground">
                    Avoid embedding passwords in URIs
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
            Constructed URI: {uri}
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>
                sqitch target add {targetName} --uri {uri}
              </span>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `sqitch target add ${targetName} --uri ${uri}`,
                  )
                }
                className="ml-2 text-xs hover:text-foreground"
              >
                Copy
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {targets.map((t) => (
          <div
            key={t.name}
            className="border rounded p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.uri}</span>
              {targetLabels[t.name] === "production" && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                  Production
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleProduction(t.name)}
                className={`text-xs ${targetLabels[t.name] === "production" ? "text-muted-foreground hover:text-foreground" : "text-red-600 hover:underline"}`}
              >
                {targetLabels[t.name] === "production"
                  ? "Unmark Production"
                  : "Mark as Production"}
              </button>
              <button
                onClick={() => handleRemove(t.name)}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to ProjectPage switch**

Add `case 'target': return <TargetView />;` and import.

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement Target view with URI builder"
```

---

### Task 3: Implement Config view

**Files:**

- Create: `src/pages/ProjectPage/ConfigView.tsx`

- [ ] **Step 1: Create ConfigView**

```tsx
import { useState, useMemo } from "react";
import { useProjectStore } from "../../store/project";
import { useIpc } from "../../hooks/useIpc";
import type { ConfigEntry } from "../../types/config";

export function ConfigView() {
  const { currentProjectId, projects } = useProjectStore();
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [activeSection, setActiveSection] = useState<string>("all");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const sections = useMemo(() => {
    const s = new Set(entries.map((e) => e.section));
    return ["all", ...Array.from(s).sort()];
  }, [entries]);

  const filtered =
    activeSection === "all"
      ? entries
      : entries.filter((e) => e.section === activeSection);

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.configList(project.path);
    setEntries(result as any);
  };

  const handleSet = async () => {
    if (!project || !newKey || !newValue) return;
    await ipc.configSet(project.path, newKey, newValue);
    setNewKey("");
    setNewValue("");
    await handleList();
  };

  const handleUnset = async (key: string) => {
    if (!project) return;
    await ipc.configUnset(project.path, key);
    await handleList();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Configuration</h3>
        <button
          onClick={handleList}
          className="px-3 py-1.5 border rounded text-sm hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-2 py-1 rounded text-xs whitespace-nowrap ${activeSection === s ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 border rounded p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Set a config value</p>
        <div className="flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="section.key or section.sub.key"
            className="flex-1 border rounded px-3 py-1.5 text-sm bg-background"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="flex-1 border rounded px-3 py-1.5 text-sm bg-background"
          />
          <button
            onClick={handleSet}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
          >
            Set
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {filtered.map((entry, i) => (
          <div
            key={i}
            className="flex items-center justify-between border rounded px-3 py-2 text-xs"
          >
            <div className="font-mono">
              <span className="text-foreground">
                {entry.section}
                {entry.subsection ? `.${entry.subsection}` : ""}.{entry.key}
              </span>
              <span className="text-muted-foreground">={entry.value}</span>
            </div>
            <button
              onClick={() =>
                handleUnset(
                  `${entry.section}${entry.subsection ? `.${entry.subsection}` : ""}.${entry.key}`,
                )
              }
              className="text-destructive hover:underline"
            >
              Unset
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to ProjectPage switch**

Add `case 'config': return <ConfigView />;` and import.

- [ ] **Step 3: Commit**

```bash
git add src/ && git commit -m "feat: implement Config view with section tabs"
```
