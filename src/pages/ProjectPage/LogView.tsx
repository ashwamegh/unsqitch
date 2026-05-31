import { Clock, History, MessageSquare, Tag, User } from "lucide-react";
import { useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { LogEntry } from "../../types/deployment";

export function LogView() {
  const { currentProjectId, projects, isRunning } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const project = projects.find((p) => p.id === currentProjectId);

  const handleFetchLog = async () => {
    if (!project || !target) return;
    setLoading(true);
    try {
      useProjectStore.getState().setRunning(true);
      const result = await ipc.sqitchLog(project.path, target);
      setEntries(result as any);
      showToast("Changelog fetched");
    } catch (err: any) {
      console.error("Log fetch failed:", err);
      showToast(err.message || "Failed to fetch deployment log", "error");
    } finally {
      useProjectStore.getState().setRunning(false);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Target card */}
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Inspect Change Log
          </h3>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target Database (e.g. pg, my_target)"
            className="flex-1 border border-border bg-card/65 focus:bg-background rounded-xl px-4 py-2.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
          />
          <button
            onClick={handleFetchLog}
            disabled={isRunning || !target}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Loading Log...
              </>
            ) : (
              "Fetch Log"
            )}
          </button>
        </div>

        {showCommands && target && (
          <div className="mt-4 p-2 bg-black/40 border border-border/50 rounded-lg text-[10px] font-mono text-muted-foreground">
            sqitch log {target}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-6 before:w-0.5 before:bg-border/60">
          {entries.map((entry, i) => (
            <div key={i} className="relative pl-12 group">
              {/* Timeline marker */}
              <div
                className={`absolute left-4 top-1.5 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${
                  entry.action === "deploy" ? "bg-emerald-500" : "bg-destructive"
                }`}
              />

              <div className="glass-card rounded-xl p-5 border border-border/70 shadow-sm relative overflow-hidden transition-all duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        entry.action === "deploy"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                          : "bg-destructive/10 text-destructive border border-destructive/15"
                      }`}
                    >
                      {entry.action}
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground/90">
                      {entry.change}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                    <Clock size={11} />
                    <span>{entry.timestamp}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
                  {/* Committer */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold bg-muted/40 px-2 py-1 rounded-lg border border-border/40">
                    <User size={12} className="text-muted-foreground" />
                    <span>
                      {entry.committer.name} &lt;{entry.committer.email}&gt;
                    </span>
                  </div>

                  {/* Tags */}
                  {entry.tags.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Tag size={12} className="text-primary" />
                      <div className="flex gap-1">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full"
                          >
                            @{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Note */}
                {entry.note && (
                  <div className="mt-3.5 flex items-start gap-2 p-3 bg-black/15 border border-border/55 rounded-lg text-xs leading-relaxed text-foreground/80 font-medium">
                    <MessageSquare size={13} className="text-muted-foreground shrink-0 mt-0.5" />
                    <p className="italic">{entry.note}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
