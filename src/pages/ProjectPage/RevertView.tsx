import { AlertOctagon, AlertTriangle, Check, History, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { DeploymentStatus } from "../../types/deployment";

export function RevertView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState(() => useProjectStore.getState().lastTarget);
  const [confirmedTarget, setConfirmedTarget] = useState("");
  const [revertTo, setRevertTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [productionLabel, setProductionLabel] = useState<string | undefined>(undefined);

  const [revertThreshold, setRevertThreshold] = useState(5);
  const [revertAll, setRevertAll] = useState(false);

  const project = projects.find((p) => p.id === currentProjectId);
  const deployed = status?.deployed ?? [];

  // Large-revert threshold is user-configurable (Settings > Large revert warning).
  useEffect(() => {
    ipc
      .settingsGet("revertThreshold")
      .then((r: any) => {
        const n = Number.parseInt(r?.value ?? "", 10);
        if (!Number.isNaN(n)) setRevertThreshold(n);
      })
      .catch(() => {});
  }, [ipc]);

  // Check if target is labeled production
  useEffect(() => {
    if (project && confirmedTarget) {
      ipc
        .targetGetLabel(project.id, confirmedTarget)
        .then((r: any) => {
          setProductionLabel(r.label ?? undefined);
        })
        .catch(() => setProductionLabel(undefined));
    }
  }, [project, confirmedTarget, ipc.targetGetLabel]);

  const isProduction = productionLabel === "production";

  // Determine what would be reverted
  const revertToIndex = deployed.findIndex((c) => c.name === revertTo);
  const changesToRevert = revertAll
    ? deployed
    : revertToIndex >= 0
      ? deployed.slice(revertToIndex + 1)
      : revertTo
        ? deployed
        : deployed.length > 1
          ? [deployed[deployed.length - 1]]
          : deployed;

  const remainingCount = deployed.length - changesToRevert.length;
  // Spec: reverting MORE THAN the (configurable) threshold requires typed confirmation.
  const requiresConfirm = changesToRevert.length > revertThreshold;

  // Dependency-aware blocking
  const remainingChanges = revertAll
    ? []
    : revertToIndex >= 0
      ? deployed.slice(0, revertToIndex + 1)
      : [];
  const blockedByDeps: string[] = [];
  for (const remaining of remainingChanges) {
    for (const req of remaining.requires) {
      if (changesToRevert.some((c) => c.name === req)) {
        blockedByDeps.push(remaining.name);
        break;
      }
    }
  }
  const hasDepBlockers = blockedByDeps.length > 0;

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc
        .sqitchStatus(project.path, confirmedTarget)
        .then((result) => {
          setStatus(result as DeploymentStatus);
        })
        .catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleRevert = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    useProjectStore.getState().setLastTarget(target);
    if (isProduction && confirmText !== "REVERT PRODUCTION") return;
    if (!isProduction && requiresConfirm && confirmText !== String(changesToRevert.length)) return;

    try {
      useProjectStore.getState().startRun(changesToRevert.map((c) => c.name));
      showToast("Reverting changes...");
      const toChangeArg = revertAll
        ? undefined
        : revertTo || (deployed.length <= 1 ? undefined : deployed[deployed.length - 2]?.name);
      await ipc.sqitchRevert(project.path, target, toChangeArg);
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as DeploymentStatus);
      setConfirming(false);
      setConfirmText("");
      showToast("Revert completed successfully!", "success");
    } catch (err: any) {
      console.error("Revert failed:", err);
      showToast(err.message || "Revert failed", "error");
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  const handlePreview = () => {
    if (!target) return;
    setConfirmedTarget(target);
    setConfirming(true);
  };

  // Pull the blocking dependents into the revert set by moving the target earlier
  // than the earliest blocker (or reverting everything if it is the first change).
  const handleRevertDependents = () => {
    const earliest = Math.min(
      ...blockedByDeps.map((name) => deployed.findIndex((c) => c.name === name)),
    );
    if (earliest <= 0) {
      setRevertAll(true);
      setRevertTo("");
    } else {
      setRevertAll(false);
      setRevertTo(deployed[earliest - 1].name);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <RotateCcw size={18} className="text-destructive" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Revert Settings
          </h3>
        </div>

        <div className="mb-6">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
            Target Database
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g., mydb"
              className="flex-1 border border-border bg-card/65 focus:bg-background rounded-xl px-4 py-2.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            />
            {target && (
              <button
                onClick={() => setConfirmedTarget(target)}
                className="px-4 py-2 border border-border bg-card hover:bg-accent text-foreground font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Inspect Deployed
              </button>
            )}
          </div>
        </div>

        {deployed.length > 0 && (
          <div className="border border-border/60 bg-black/10 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground/80 uppercase tracking-wider">
                <History size={14} className="text-muted-foreground" />
                <span>Select Revert Target (it stays deployed, later changes are reverted)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRevertAll(true);
                  setRevertTo("");
                }}
                className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  revertAll
                    ? "bg-destructive/15 border-destructive/40 text-destructive"
                    : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
              >
                Revert Everything
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {deployed.map((change) => (
                <div
                  key={change.changeId}
                  onClick={() => {
                    setRevertAll(false);
                    setRevertTo(change.name);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-all border ${
                    revertTo === change.name
                      ? "bg-destructive/10 border-destructive/40 text-destructive-foreground font-bold shadow-sm"
                      : "border-transparent bg-transparent hover:bg-accent/40 text-foreground/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{change.name}</span>
                    {change.tags.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-sans font-semibold">
                        {change.tags.map((t) => `@${t}`).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{change.deployedBy}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(revertTo || revertAll || deployed.length === 1) && (
          <div
            className={`border rounded-xl p-5 mb-6 ${
              isProduction ? "border-red-500/30 bg-red-500/5" : "border-amber-500/25 bg-amber-500/5"
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              {isProduction ? (
                <AlertOctagon size={20} className="text-red-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${isProduction ? "text-red-400" : "text-amber-400"}`}
                >
                  Revert Impact Analysis
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This action will undo {changesToRevert.length} change
                  {changesToRevert.length === 1 ? "" : "s"}.{" "}
                  {revertAll
                    ? "No changes will remain deployed."
                    : `${remainingCount} change${remainingCount === 1 ? "" : "s"} will remain deployed${
                        revertTo ? `, including "${revertTo}"` : ""
                      }.`}
                </p>
              </div>
            </div>

            {isProduction && (
              <div className="mb-4 p-3 border border-red-500/20 bg-red-950/20 text-red-300 rounded-lg text-xs font-semibold leading-relaxed">
                WARNING: target "{target}" is labeled as PRODUCTION. Reverts on production can cause
                data loss and requires manual override confirmation.
              </div>
            )}

            {hasDepBlockers && (
              <div className="mb-4 p-3 border border-amber-500/20 bg-amber-950/15 rounded-lg text-xs leading-relaxed">
                <p className="text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                  <AlertOctagon size={13} />
                  Blocked by Dependencies
                </p>
                <p className="text-muted-foreground">
                  The following active changes depend on the changes you are reverting:{" "}
                  <strong className="text-foreground">{blockedByDeps.join(", ")}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleRevertDependents}
                  className="mt-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-all cursor-pointer"
                >
                  Revert dependents too
                </button>
              </div>
            )}

            <div className="space-y-1 bg-black/25 rounded-lg p-3 border border-border/40 mb-3 max-h-36 overflow-y-auto">
              {changesToRevert.map((c) => (
                <div
                  key={c.changeId}
                  className="text-[11px] font-mono text-destructive flex items-center gap-2"
                >
                  <span className="font-bold">✕</span>
                  <span>{c.name}</span>
                </div>
              ))}
            </div>

            {showCommands && (
              <div className="p-2.5 bg-black/40 border border-border/60 rounded-lg text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-3">
                <span className="truncate">
                  sqitch revert {target}
                  {revertAll
                    ? ""
                    : ` --to ${revertTo || deployed[deployed.length - 2]?.name || ""}`}{" "}
                  -y
                </span>
              </div>
            )}
          </div>
        )}

        {confirming && requiresConfirm && !isProduction && (
          <div className="mb-6 p-4 border border-border bg-black/15 rounded-xl">
            <label className="text-xs text-foreground/80 block mb-2 font-medium">
              Type <strong className="text-destructive font-mono">{changesToRevert.length}</strong>{" "}
              to confirm revert of {changesToRevert.length} changes:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border border-border bg-card focus:bg-background rounded-lg px-3 py-1.5 text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary w-32 font-mono"
            />
          </div>
        )}

        {confirming && isProduction && (
          <div className="mb-6 p-4 border border-red-500/20 bg-red-950/5 rounded-xl">
            <label className="text-xs text-red-400 block mb-2 font-bold uppercase tracking-wider">
              Type <strong className="text-red-500 font-mono">REVERT PRODUCTION</strong> to confirm
              destructive revert on production target:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border border-red-500/35 bg-card focus:bg-background rounded-lg px-4 py-2 text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-red-500 w-full max-w-md font-mono"
            />
          </div>
        )}

        <div className="flex gap-3">
          {!confirming ? (
            <button
              onClick={handlePreview}
              disabled={
                isRunning ||
                !target ||
                (!revertTo && !revertAll && deployed.length !== 1) ||
                hasDepBlockers
              }
              className="flex items-center justify-center gap-2 px-5 py-3 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-bold rounded-xl text-xs shadow-md shadow-destructive/10 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              Preview Revert
            </button>
          ) : (
            <>
              <button
                onClick={handleRevert}
                disabled={
                  isRunning ||
                  (requiresConfirm && confirmText !== String(changesToRevert.length)) ||
                  (isProduction && confirmText !== "REVERT PRODUCTION")
                }
                className="flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 disabled:bg-muted text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={13} />
                Confirm and Execute Revert
              </button>
              <button
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                className="px-5 py-3 border border-border hover:bg-accent text-foreground font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
