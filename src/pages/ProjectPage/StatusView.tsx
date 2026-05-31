import { Activity, CheckCircle2, Clock, Database, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useProjectStore } from "../../store/project";

export function StatusView() {
  const { status, currentProjectId, projects, setStatus, setLastStatusRefresh } = useProjectStore();
  const ipc = useIpc();
  const [target, setTarget] = useState("");
  const [confirmedTarget, setConfirmedTarget] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 15;
  const project = projects.find((p) => p.id === currentProjectId);

  const deployed = status?.deployed ?? [];
  const pending = status?.pending ?? [];
  const paged = deployed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(deployed.length / PAGE_SIZE);

  const handleRefresh = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    setLoading(true);
    try {
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
      setLastStatusRefresh(Date.now());
      showToast("Database status refreshed!");
    } catch (err: any) {
      console.error("Status refresh failed:", err);
      showToast(err.message || "Failed to inspect database status", "error");
    } finally {
      setLoading(false);
    }
  };

  // Automatically refresh when target changes
  useEffect(() => {
    if (project && confirmedTarget) {
      handleRefresh();
    }
  }, [confirmedTarget, project, handleRefresh]);

  return (
    <div className="space-y-6">
      {/* Target input card */}
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Inspect Connection
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
            onClick={handleRefresh}
            disabled={loading || !target}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Inspect Status
          </button>
        </div>
      </div>

      {status && (
        <>
          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between h-28">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" />
                Deployed
              </span>
              <div className="text-3xl font-extrabold tracking-tight mt-1">{deployed.length}</div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1">
                changes active
              </span>
            </div>

            <div className="glass-panel rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between h-28">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} className="text-amber-400" />
                Pending
              </span>
              <div className="text-3xl font-extrabold tracking-tight mt-1">{pending.length}</div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1">
                changes waiting
              </span>
            </div>

            <div className="glass-panel rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between h-28">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={12} className="text-primary" />
                Last Change
              </span>
              <div
                className="text-sm font-mono font-bold tracking-tight text-foreground/90 mt-2 truncate w-full"
                title={status.lastChange || "None"}
              >
                {status.lastChange || "—"}
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1">
                latest update
              </span>
            </div>

            <div className="glass-panel rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between h-28">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database size={12} className="text-indigo-400" />
                Engine Target
              </span>
              <div className="text-base font-extrabold tracking-tight text-foreground/90 mt-2 truncate">
                {confirmedTarget}
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold mt-1">
                selected database
              </span>
            </div>
          </div>

          {/* List of changes */}
          <div className="glass-panel rounded-2xl border border-border shadow-md overflow-hidden">
            <div className="p-5 border-b border-border bg-card/30 flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Deployment Log (Target: {confirmedTarget})
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium">
                Showing {paged.length} of {deployed.length} changes
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {paged.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                  No deployed changes found on target "{confirmedTarget}".
                </div>
              ) : (
                paged.map((change) => (
                  <div
                    key={change.changeId}
                    className="p-4 hover:bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-foreground/90 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                        {change.name}
                      </span>
                      {change.tags.length > 0 && (
                        <div className="flex gap-1">
                          {change.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full"
                            >
                              @{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                      <span>{change.deployedAt}</span>
                      <span>•</span>
                      <span className="text-foreground/80">{change.deployedBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border bg-card/20 flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 border border-border hover:bg-accent disabled:bg-muted/20 text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground font-semibold">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-border hover:bg-accent disabled:bg-muted/20 text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
