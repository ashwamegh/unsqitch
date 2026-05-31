import { Network, Plus, RefreshCw, Settings, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";

type EngineType = "pg" | "mysql" | "sqlite" | "cockroach" | "yugabyte";

function buildUri(engine: EngineType, fields: Record<string, string>): string {
  switch (engine) {
    case "pg":
      return `db:pg://${fields.user || "user"}${fields.password ? `:${fields.password}` : ""}@${fields.host || "localhost"}:${fields.port || "5432"}/${fields.database || "mydb"}`;
    case "mysql":
      return `db:mysql://${fields.user || "user"}${fields.password ? `:${fields.password}` : ""}@${fields.host || "localhost"}:${fields.port || "3306"}/${fields.database || "mydb"}`;
    case "sqlite":
      return `db:sqlite:${fields.path || "/path/to/db.sqlite"}`;
    case "cockroach":
      return `db:pg://${fields.user || "user"}${fields.password ? `:${fields.password}` : ""}@${fields.host || "localhost"}:${fields.port || "26257"}/${fields.database || "mydb"}`;
    case "yugabyte":
      return `db:pg://${fields.user || "user"}${fields.password ? `:${fields.password}` : ""}@${fields.host || "localhost"}:${fields.port || "5433"}/${fields.database || "mydb"}`;
  }
}

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

  const handleAdd = async () => {
    if (!project || !targetName) return;
    try {
      await ipc.targetAdd(project.path, targetName, uri);
      setAdding(false);
      setTargetName("");
      setFields({});
      await handleList();
      showToast("Database target added successfully!", "success");
    } catch (err: any) {
      console.error("Add target failed:", err);
      showToast(err.message || "Failed to add target", "error");
    }
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

  // Auto load on mount
  useEffect(() => {
    if (project) {
      handleList();
    }
  }, [project, handleList]);

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
              onClick={() => setAdding(true)}
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
              URI Connection Builder
            </h4>
          </div>

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
              <input
                value={fields.path || ""}
                onChange={(e) => updateField("path", e.target.value)}
                placeholder="/path/to/db.sqlite"
                className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              />
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
              sqitch target add {targetName || "<name>"} --uri {uri}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              disabled={!targetName}
              className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-lg text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              Add Target
            </button>
            <button
              onClick={() => setAdding(false)}
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
