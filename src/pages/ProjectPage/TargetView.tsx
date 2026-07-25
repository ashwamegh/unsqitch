import { Network, Pencil, Plus, RefreshCw, Settings, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { buildUri, type EngineType, parseUri } from "../../lib/uri-builder";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";

export function TargetView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [targets, setTargets] = useState<Array<{ name: string; uri: string }>>([]);
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [engine, setEngine] = useState<EngineType>("pg");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  const uri = buildUri(engine, fields);

  const handleList = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const result = await ipc.targetList(project.path);
      setTargets(result as any);
      const labelMap: Record<string, string> = {};
      for (const t of result as Array<{ name: string }>) {
        const r = await ipc.targetGetLabel(project.id, t.name);
        if ((r as any).label) labelMap[t.name] = (r as any).label;
      }
      setTargetLabels(labelMap);
    } catch (err: any) {
      console.error("List targets failed:", err);
      showToast(err.message || "Failed to load targets", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProduction = async (name: string) => {
    if (!project) return;
    const currentLabel = targetLabels[name];
    const newLabel = currentLabel === "production" ? "" : "production";
    try {
      await ipc.targetSetLabel(project.id, name, newLabel);
      showToast(
        newLabel === "production"
          ? `Target "${name}" marked as Production`
          : `Target "${name}" unmarked as Production`,
        newLabel === "production" ? "warning" : "success",
      );
      await handleList();
    } catch (err: any) {
      console.error("Toggle label failed:", err);
    }
  };

  const resetForm = () => {
    setAdding(false);
    setEditingName(null);
    setTargetName("");
    setFields({});
  };

  const handleSave = async () => {
    if (!project || !targetName) return;
    try {
      // Editing an existing target: replace it (remove old, add updated URI).
      if (editingName) await ipc.targetRemove(project.path, editingName);
      await ipc.targetAdd(project.path, targetName, uri);
      resetForm();
      await handleList();
      showToast(editingName ? "Target updated" : "Database target added successfully!", "success");
    } catch (err: any) {
      console.error("Save target failed:", err);
      showToast(err.message || "Failed to save target", "error");
    }
  };

  // Editing repopulates the builder from the target's URI. The password is NOT
  // restored (masked) — the user re-enters it only if changing it.
  const startEdit = (t: { name: string; uri: string }) => {
    const parsed = parseUri(t.uri);
    setEngine(parsed.engine);
    setFields(parsed.fields as Record<string, string>);
    setTargetName(t.name);
    setEditingName(t.name);
    setAdding(true);
  };

  const handleRemove = async (name: string) => {
    if (!project) return;
    try {
      await ipc.targetRemove(project.path, name);
      await handleList();
      showToast(`Target "${name}" removed`, "success");
    } catch (err: any) {
      console.error("Remove target failed:", err);
      showToast(err.message || "Failed to remove target", "error");
    }
  };

  const updateField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Auto load on mount. Depend only on project — handleList is recreated every
  // render, so including it would loop (setState -> re-render -> new fn -> rerun).
  useEffect(() => {
    if (project) {
      handleList();
    }
  }, [project]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Database Targets
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleList}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          {!adding && (
            <button
              onClick={() => {
                setEditingName(null);
                setTargetName("");
                setFields({});
                setAdding(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold rounded-lg text-xs shadow-sm transition-all cursor-pointer"
            >
              <Plus size={13} />
              Add Target
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="glass-panel rounded-2xl p-6 border border-border shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40 mb-2">
            <Settings size={14} className="text-primary" />
            <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
              {editingName ? `Edit Target: ${editingName}` : "URI Connection Builder"}
            </h4>
          </div>
          {editingName && (
            <p className="text-[10px] text-muted-foreground -mt-2">
              Password is hidden — re-enter it only if you want to change it.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                Target Key (Name)
              </label>
              <input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g., dev, staging, prod"
                className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                SQL Database Engine
              </label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as EngineType)}
                className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              >
                <option value="pg">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
                <option value="cockroach">CockroachDB</option>
                <option value="yugabyte">YugabyteDB</option>
              </select>
            </div>
          </div>

          {engine === "sqlite" ? (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                Database File Path
              </label>
              <div className="flex gap-2">
                <input
                  value={fields.path || ""}
                  onChange={(e) => updateField("path", e.target.value)}
                  placeholder="/path/to/db.sqlite"
                  className="flex-1 border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const r = await ipc.dialogOpenFile();
                    if (!r.canceled && r.path) updateField("path", r.path);
                  }}
                  className="px-3 py-2 border border-border hover:bg-accent text-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  Browse…
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Host address
                  </label>
                  <input
                    value={fields.host || ""}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="localhost"
                    className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Port number
                  </label>
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
                    className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                  Database Schema Name
                </label>
                <input
                  value={fields.database || ""}
                  onChange={(e) => updateField("database", e.target.value)}
                  placeholder="mydb"
                  className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Username
                  </label>
                  <input
                    value={fields.user || ""}
                    onChange={(e) => updateField("user", e.target.value)}
                    placeholder="user"
                    className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={fields.password || ""}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                  />
                </div>
              </div>
              <p className="text-[10px] text-amber-400/90 font-medium leading-relaxed flex items-start gap-1.5">
                <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                Avoid embedding passwords in URIs. Prefer .pgpass, environment variables, or
                engine-specific auth files — sqitch stores target URIs in sqitch.conf.
              </p>
            </>
          )}

          <div className="p-3 bg-black/30 border border-border/60 rounded-xl">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
              Generated Connection URI
            </span>
            <div className="text-xs font-mono text-primary/95 break-all select-all font-semibold">
              {uri}
            </div>
          </div>

          {showCommands && (
            <div className="p-2.5 bg-black/40 border border-border/60 rounded-lg text-[10px] font-mono text-muted-foreground">
              sqitch target add {targetName || "<name>"} {uri}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!targetName}
              className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-lg text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {editingName ? "Update Target" : "Add Target"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 border border-border hover:bg-accent text-foreground font-medium rounded-lg text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.length === 0 ? (
          <div className="glass-panel border border-dashed border-border/60 rounded-2xl p-8 text-center text-xs text-muted-foreground font-medium">
            No targets configured for this project. Setup a target to route deployments.
          </div>
        ) : (
          targets.map((t) => (
            <div
              key={t.name}
              className="glass-card rounded-xl p-4 border border-border/70 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-muted/10 transition-all duration-200"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-foreground/90 bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                    {t.name}
                  </span>
                  {targetLabels[t.name] === "production" && (
                    <span className="flex items-center gap-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      <ShieldAlert size={10} />
                      Production Target
                    </span>
                  )}
                </div>
                <div
                  className="text-[10px] font-mono text-muted-foreground mt-2 truncate max-w-md"
                  title={t.uri}
                >
                  {t.uri}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center">
                <button
                  onClick={() => startEdit(t)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
                  title="Edit Target"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleToggleProduction(t.name)}
                  className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    targetLabels[t.name] === "production"
                      ? "border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
                      : "border-border/60 hover:bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {targetLabels[t.name] === "production" ? "Unmark Prod" : "Mark Prod"}
                </button>
                <button
                  onClick={() => handleRemove(t.name)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  title="Remove Target"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
