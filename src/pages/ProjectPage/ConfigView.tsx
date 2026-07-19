import { RefreshCw, Sliders, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { ConfigEntry } from "../../types/config";

export function ConfigView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [activeSection, setActiveSection] = useState<string>("all");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(false);

  // Spec: fixed visual groupings of the flat key=value list, not derived tabs.
  const sections = ["all", "core", "engine", "target", "user"];

  const filtered =
    activeSection === "all" ? entries : entries.filter((e) => e.section === activeSection);

  const handleList = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const result = await ipc.configList(project.path);
      setEntries(result as any);
    } catch (err: any) {
      console.error("List config failed:", err);
      showToast(err.message || "Failed to load configs", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async () => {
    if (!project || !newKey || !newValue) return;
    try {
      await ipc.configSet(project.path, newKey, newValue);
      setNewKey("");
      setNewValue("");
      await handleList();
      showToast(`Config "${newKey}" updated`, "success");
    } catch (err: any) {
      console.error("Set config failed:", err);
      showToast(err.message || "Failed to set config value", "error");
    }
  };

  const handleUnset = async (key: string) => {
    if (!project) return;
    try {
      await ipc.configUnset(project.path, key);
      await handleList();
      showToast(`Config "${key}" unset`, "success");
    } catch (err: any) {
      console.error("Unset config failed:", err);
      showToast(err.message || "Failed to unset config value", "error");
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
          <Sliders size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Project Configuration
          </h3>
        </div>
        <button
          onClick={handleList}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tabs — fixed core/engine/target/user groupings */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer ${
              activeSection === s
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Set configuration card */}
      <div className="glass-panel rounded-2xl p-5 border border-border/80 shadow-md space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
          Update Config Variable
        </span>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="section.key (e.g. core.engine)"
            className="flex-1 border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="flex-1 border border-border bg-card/65 focus:bg-background rounded-xl px-3 py-2 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
          />
          <button
            onClick={handleSet}
            disabled={!newKey || !newValue}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Save Value
          </button>
        </div>
        {showCommands && (newKey || newValue) && (
          <div className="p-2 bg-black/40 border border-border/50 rounded-lg text-[10px] font-mono text-muted-foreground">
            sqitch config {newKey || "<key>"} {newValue || "<value>"}
          </div>
        )}
      </div>

      {/* Configuration values table */}
      <div className="glass-panel rounded-2xl border border-border shadow-md overflow-hidden">
        <div className="p-4 border-b border-border bg-card/30">
          <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            Active Variables
          </h3>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground font-medium">
              No configuration variables found in this section.
            </div>
          ) : (
            filtered.map((entry, i) => {
              const fullKey = `${entry.section}${entry.subsection ? `.${entry.subsection}` : ""}.${entry.key}`;
              return (
                <div
                  key={i}
                  className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors font-mono text-xs"
                >
                  <div className="min-w-0 pr-4">
                    <span className="font-bold text-foreground/80">{fullKey}</span>
                    <span className="text-muted-foreground select-none mx-2">=</span>
                    <span className="text-primary/90 break-all select-all font-semibold">
                      {entry.value}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnset(fullKey)}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Unset Config"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
