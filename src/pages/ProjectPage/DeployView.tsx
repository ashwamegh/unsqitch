import { Play, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { DeployPreview } from "../../components/progress/DeployPreview";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";

export function DeployView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState("");
  const [confirmedTarget, setConfirmedTarget] = useState("");
  const [toChange, setToChange] = useState("");

  const project = projects.find((p) => p.id === currentProjectId);
  const pending = status?.pending ?? [];

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc
        .sqitchStatus(project.path, confirmedTarget)
        .then((result) => {
          setStatus(result as any);
        })
        .catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleDeploy = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    try {
      useProjectStore.getState().setRunning(true);
      showToast("Starting deployment...");
      await ipc.sqitchDeploy(project.path, target, toChange || undefined);
      // Refresh status after deploy
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
      showToast("Deployment completed successfully!", "success");
    } catch (err: any) {
      console.error("Deploy failed:", err);
      showToast(err.message || "Deployment failed", "error");
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Zap size={18} className="text-primary animate-pulse" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Deploy Settings
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
              Target Database
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g., mydb"
              className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-4 py-2.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
              Deploy Up To (Optional)
            </label>
            <input
              type="text"
              value={toChange}
              onChange={(e) => setToChange(e.target.value)}
              placeholder="e.g., change_name"
              className="w-full border border-border bg-card/65 focus:bg-background rounded-xl px-4 py-2.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            />
          </div>
        </div>

        {pending.length > 0 && target && (
          <DeployPreview
            pendingChanges={pending}
            target={target}
            showCommand={showCommands}
            toChange={toChange || undefined}
          />
        )}

        <button
          onClick={handleDeploy}
          disabled={isRunning || !target}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 disabled:from-muted disabled:to-muted text-primary-foreground font-bold rounded-xl text-xs shadow-md shadow-primary/10 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Play size={13} className="fill-current" />
              Start Deployment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
