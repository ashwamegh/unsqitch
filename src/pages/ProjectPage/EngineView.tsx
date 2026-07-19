import { Cpu, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";

export function EngineView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [engines, setEngines] = useState<Array<{ name: string; target: string }>>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [client, setClient] = useState("");
  const [registry, setRegistry] = useState("");
  const [loading, setLoading] = useState(false);

  const handleList = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const result = await ipc.engineList(project.path);
      setEngines(result as any);
    } catch (err: any) {
      console.error("List engines failed:", err);
      showToast(err.message || "Failed to load engines", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!project || !name || !uri) return;
    try {
      await ipc.engineAdd(project.path, name, uri, client || undefined, registry || undefined);
      setAdding(false);
      setName("");
      setUri("");
      setClient("");
      setRegistry("");
      await handleList();
      showToast("Engine configured successfully!", "success");
    } catch (err: any) {
      console.error("Add engine failed:", err);
      showToast(err.message || "Failed to add engine", "error");
    }
  };

  const handleRemove = async (engineName: string) => {
    if (!project) return;
    try {
      await ipc.engineRemove(project.path, engineName);
      await handleList();
      showToast("Engine removed", "success");
    } catch (err: any) {
      console.error("Remove engine failed:", err);
      showToast(err.message || "Failed to remove engine", "error");
    }
  };

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
          <Cpu size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Configure Engines
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
              Add Engine
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="glass-panel rounded-2xl p-6 border border-border shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40 mb-2">
            <Settings size={14} className="text-primary" />
            <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
              New Engine Config
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                Engine Key
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., pg, mysql, sqlite"
                className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                URI Connection Target
              </label>
              <input
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="e.g., db:pg://localhost/mydb"
                className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
              Client Command Executable Path (Optional)
            </label>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g., /usr/bin/psql"
              className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
              Registry Schema (Optional)
            </label>
            <input
              value={registry}
              onChange={(e) => setRegistry(e.target.value)}
              placeholder="e.g., sqitch"
              className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            />
          </div>

          {showCommands && (
            <div className="p-2.5 bg-black/40 border border-border/60 rounded-lg text-[10px] font-mono text-muted-foreground">
              sqitch engine add {name || "<key>"} --target {uri || "<uri>"}
              {client ? ` --client ${client}` : ""}
              {registry ? ` --registry ${registry}` : ""}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              disabled={!name || !uri}
              className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-lg text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              Configure Engine
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
        {engines.length === 0 ? (
          <div className="glass-panel border border-dashed border-border/60 rounded-2xl p-8 text-center text-xs text-muted-foreground font-medium">
            No engines configured for this project. Configure one to link database drivers.
          </div>
        ) : (
          engines.map((e) => (
            <div
              key={e.name}
              className="glass-card rounded-xl p-4 border border-border/70 shadow-sm flex items-center justify-between hover:bg-muted/10 transition-all duration-200"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground/90 bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                    {e.name}
                  </span>
                </div>
                <div
                  className="text-[10px] font-mono text-muted-foreground mt-2 truncate max-w-md"
                  title={e.target}
                >
                  {e.target}
                </div>
              </div>
              <button
                onClick={() => handleRemove(e.name)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                title="Remove Engine"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
