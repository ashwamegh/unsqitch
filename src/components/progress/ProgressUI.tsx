import { Ban, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useIpc } from "../../hooks/useIpc";
import { useProjectStore } from "../../store/project";
import { showToast } from "../shared/Toast";

export function ProgressUI() {
  const { events, isRunning } = useProjectStore();
  const ipc = useIpc();

  if (events.length === 0 && !isRunning) return null;

  const completed = events.filter(
    (e) => e.status === "ok" || e.status === "not_ok" || e.status === "failed",
  ).length;
  const total = events.length || 1;
  const progress = (completed / total) * 100;
  const hasFailed = events.some((e) => e.status === "failed");

  const handleCancel = () => {
    ipc.sqitchCancel();
    useProjectStore.getState().setRunning(false);
    showToast("Operation cancelled by user", "warning");
  };

  return (
    <div className="border-t border-border bg-card/40 backdrop-blur-md p-4 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 size={14} className="text-primary animate-spin" />
          ) : hasFailed ? (
            <XCircle size={14} className="text-destructive" />
          ) : (
            <CheckCircle2 size={14} className="text-emerald-500" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            {isRunning
              ? "Running Sqitch Script..."
              : hasFailed
                ? "Execution Failed"
                : "Execution Completed"}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-bold font-mono bg-muted/40 px-2 py-0.5 rounded border border-border/40">
          {completed} / {total} changes
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full bg-black/30 border border-border/40 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            hasFailed ? "bg-destructive" : "bg-gradient-to-r from-primary to-indigo-500"
          } ${isRunning ? "animate-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timeline entries list */}
      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 bg-black/15 border border-border/40 rounded-lg p-2.5">
        {events.map((event, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[10px] font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">
                {event.status === "ok" ? (
                  <CheckCircle2 size={11} className="text-emerald-500" />
                ) : event.status === "failed" || event.status === "not_ok" ? (
                  <XCircle size={11} className="text-destructive" />
                ) : (
                  <Loader2 size={11} className="text-primary animate-spin" />
                )}
              </span>
              <span className="font-bold text-foreground/80 truncate">{event.change}</span>
            </div>
            {event.target && (
              <span className="text-muted-foreground shrink-0 text-[9px] bg-muted/30 px-1.5 py-0.5 rounded">
                → {event.target}
              </span>
            )}
          </div>
        ))}
      </div>

      {isRunning && (
        <button
          type="button"
          onClick={handleCancel}
          className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-destructive/30 hover:border-destructive text-destructive hover:bg-destructive/10 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <Ban size={11} />
          Cancel Exec
        </button>
      )}
    </div>
  );
}
