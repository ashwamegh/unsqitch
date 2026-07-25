import { Check, Play, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { CommandErrorPanel } from "../../components/progress/CommandErrorPanel";
import { DeployPreview } from "../../components/progress/DeployPreview";
import { TargetPicker } from "../../components/shared/TargetPicker";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { pendingChanges } from "../../lib/plan-status-diff";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { DeploymentStatus } from "../../types/deployment";
import { type AppError, createAppError, type ErrorType, parseIpcError } from "../../types/error";
import type { PlanFile } from "../../types/plan";

export function DeployView() {
  const { status, plan, currentProjectId, projects, isRunning, setStatus, setPlan } =
    useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState(() => useProjectStore.getState().lastTarget);
  const [confirmedTarget, setConfirmedTarget] = useState("");
  const [toChange, setToChange] = useState("");
  const [deployError, setDeployError] = useState<AppError | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // The target the cached status was actually fetched for. Sqitch echoes the URI
  // with credentials stripped, so the reported target cannot be compared to what
  // the user typed — we record the request instead.
  const [statusFor, setStatusFor] = useState<string | null>(null);

  const project = projects.find((p) => p.id === currentProjectId);
  // The cached status only describes the target it was fetched for; using it for a
  // different target would report deployed changes as pending.
  const knownStatus = status && statusFor && statusFor === target ? status : null;
  // Preview is a LOCAL plan-vs-status diff (no DB call).
  const pending = pendingChanges(plan, knownStatus);
  const upToDate = !!knownStatus && pending.length === 0;

  // Load the plan (for the local diff) once a project is active.
  useEffect(() => {
    if (project) {
      ipc
        .sqitchPlan(project.path)
        .then((result) => setPlan(result as PlanFile))
        .catch(() => {});
    }
  }, [project, ipc, setPlan]);

  // Fetch status for whichever target is entered so the preview reflects reality
  // as soon as the view is opened, not only after a deploy.
  useEffect(() => {
    if (!project || !target) return;
    let cancelled = false;
    setPreviewLoading(true);
    ipc
      .sqitchStatus(project.path, target)
      .then((result) => {
        if (cancelled) return;
        setStatus(result as DeploymentStatus);
        setStatusFor(target);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, target, ipc, setStatus]);

  // Capture structured errors (with type + raw output) for the recovery panel.
  useEffect(() => {
    const unsubscribe = ipc.onSqitchError((evt) => {
      if (!project || evt.projectPath === project.path) {
        setDeployError(createAppError(evt.type as ErrorType, evt.error, evt.sqitchOutput));
      }
    });
    return () => {
      unsubscribe();
    };
  }, [ipc, project]);

  const handleDeploy = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    setDeployError(null);
    useProjectStore.getState().setLastTarget(target);
    try {
      // Spec: force a fresh status against the target before a destructive action,
      // and use it (not a cached preview) to decide what will be deployed.
      let expected = pending;
      try {
        const fresh = (await ipc.sqitchStatus(project.path, target)) as DeploymentStatus;
        setStatus(fresh);
        setStatusFor(target);
        expected = pendingChanges(plan, fresh);
      } catch {
        // Status is advisory here; the deploy itself re-checks state atomically.
      }
      useProjectStore.getState().startRun(expected);
      showToast("Starting deployment...");
      await ipc.sqitchDeploy(project.path, target, toChange || undefined);
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as DeploymentStatus);
      setStatusFor(target);
      showToast("Deployment completed successfully!", "success");
    } catch (err: any) {
      console.error("Deploy failed:", err);
      showToast(err.message || "Deployment failed", "error");
      // Fallback in case the stream error event did not arrive.
      setDeployError((prev) => prev ?? parseIpcError(err, "Deploy failed"));
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  const handleRevertDeployed = async () => {
    if (!project || !confirmedTarget) return;
    try {
      useProjectStore.getState().startRun();
      showToast("Reverting deployed changes...");
      await ipc.sqitchRevert(project.path, confirmedTarget);
      const result = await ipc.sqitchStatus(project.path, confirmedTarget);
      setStatus(result as DeploymentStatus);
      setDeployError(null);
      showToast("Reverted", "success");
    } catch (err: any) {
      showToast(err.message || "Revert failed", "error");
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
            <TargetPicker value={target} onChange={setTarget} />
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

        {target && previewLoading && !knownStatus && (
          <p className="text-xs text-muted-foreground font-medium mb-6">
            Checking what is deployed on "{target}"…
          </p>
        )}

        {target && !previewLoading && upToDate && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300 font-medium">
              "{target}" is already up to date — nothing to deploy.
            </p>
          </div>
        )}

        {pending.length > 0 && target && (
          <DeployPreview
            pendingChanges={pending}
            target={target}
            showCommand={showCommands}
            toChange={toChange || undefined}
            // Without a status for this target the diff cannot know what is
            // already deployed, so say so rather than implying it is verified.
            stateKnown={!!knownStatus}
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

      {deployError && (
        <CommandErrorPanel
          error={deployError}
          onRetry={handleDeploy}
          onRevert={handleRevertDeployed}
          onDismiss={() => setDeployError(null)}
        />
      )}
    </div>
  );
}
