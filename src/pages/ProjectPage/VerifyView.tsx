import { AlertCircle, AlertOctagon, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CommandPreview } from "../../components/shared/CommandPreview";
import { TargetPicker } from "../../components/shared/TargetPicker";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";

export function VerifyView() {
  const { currentProjectId, projects, isRunning } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState(() => useProjectStore.getState().lastTarget);
  const [results, setResults] = useState<Array<{ change: string; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === currentProjectId);

  const handleVerify = async () => {
    if (!project || !target) return;
    setError(null);
    useProjectStore.getState().setLastTarget(target);
    try {
      useProjectStore
        .getState()
        .startRun(useProjectStore.getState().status?.deployed.map((c) => c.name) ?? []);
      showToast("Running verification suite...");
      const result = await ipc.sqitchVerify(project.path, target);
      const events = ((result as any).events || []) as Array<{ change: string; status: string }>;
      setResults(events);
      useProjectStore.getState().setVerifyResults(events);
      showToast("Verification completed", "success");
    } catch (err: any) {
      setError(err.message || "Verify failed");
      showToast("Verification failed", "error");
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Target card */}
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Verify Integration
          </h3>
        </div>

        <div className="flex gap-3">
          <TargetPicker value={target} onChange={setTarget} />
          <button
            onClick={handleVerify}
            disabled={isRunning || !target}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              "Run Verify"
            )}
          </button>
        </div>

        {showCommands && target && (
          <CommandPreview command={`sqitch verify ${target}`} className="mt-4" />
        )}
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs font-semibold leading-relaxed shadow-sm">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="glass-panel rounded-2xl border border-border shadow-md overflow-hidden">
          <div className="p-4 border-b border-border bg-card/30">
            <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
              Verification Results
            </h3>
          </div>

          <div className="divide-y divide-border/60">
            {results.map((r, i) => (
              <div
                key={i}
                className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {r.status === "ok" ? (
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  ) : (
                    <AlertOctagon size={16} className="text-destructive shrink-0 animate-pulse" />
                  )}
                  <span className="font-mono text-xs font-bold text-foreground/90">{r.change}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.status === "ok"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                      : "bg-destructive/10 text-destructive border border-destructive/15"
                  }`}
                >
                  {r.status === "ok" ? "Verified" : "Verification Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
