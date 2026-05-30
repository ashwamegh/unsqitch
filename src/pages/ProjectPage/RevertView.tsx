import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';
import type { DeploymentStatus } from '../../types/deployment';

export function RevertView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [confirmedTarget, setConfirmedTarget] = useState('');
  const [revertTo, setRevertTo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [productionLabel, setProductionLabel] = useState<string | undefined>(undefined);

  const project = projects.find((p) => p.id === currentProjectId);
  const deployed = status?.deployed ?? [];
  const LARGE_REVERT_THRESHOLD = 5;

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc.targetGetLabel(project.id, confirmedTarget).then((r: any) => {
        setProductionLabel(r.label ?? undefined);
      }).catch(() => setProductionLabel(undefined));
    }
  }, [project, confirmedTarget]);

  const isProduction = productionLabel === 'production';

  const revertToIndex = deployed.findIndex((c) => c.name === revertTo);
  const changesToRevert = revertToIndex >= 0
    ? deployed.slice(revertToIndex + 1)
    : revertTo
      ? deployed
      : deployed.length > 1
        ? [deployed[deployed.length - 1]]
        : deployed;

  const remainingCount = deployed.length - changesToRevert.length;
  const requiresConfirm = changesToRevert.length >= LARGE_REVERT_THRESHOLD;

  const remainingChanges = revertToIndex >= 0 ? deployed.slice(0, revertToIndex + 1) : [];
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
      ipc.sqitchStatus(project.path, confirmedTarget).then((result) => {
        setStatus(result as DeploymentStatus);
      }).catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleRevert = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    if (isProduction && confirmText !== 'REVERT PRODUCTION') return;
    if (!isProduction && requiresConfirm && confirmText !== String(changesToRevert.length)) return;

    try {
      useProjectStore.getState().setRunning(true);
      const toChangeArg = revertTo || (deployed.length <= 1 ? undefined : deployed[deployed.length - 2]?.name);
      await ipc.sqitchRevert(project.path, target, toChangeArg);
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as DeploymentStatus);
      setConfirming(false);
      setConfirmText('');
    } catch (err) {
      console.error('Revert failed:', err);
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Target</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g., mydb"
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      {deployed.length > 0 && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30">
          <p className="text-sm font-medium mb-2">Deployed changes</p>
          <div className="space-y-1">
            {deployed.map((change) => (
              <div key={change.changeId} className="flex items-center gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setRevertTo(change.name)}
                  className={`text-left hover:underline ${revertTo === change.name ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  {change.name}
                </button>
                {change.tags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({change.tags.map(t => `@${t}`).join(', ')})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {revertTo && (
        <div className={`border rounded p-4 mb-4 ${isProduction ? 'border-red-600 bg-red-600/10' : 'border-red-500/50 bg-red-500/10'}`}>
          <p className={`text-sm mb-2 ${isProduction ? 'text-red-700 font-semibold' : 'text-red-600'}`}>
            This will undo {changesToRevert.length} change{changesToRevert.length > 1 ? 's' : ''}.
            {remainingCount} change{remainingCount !== 1 ? 's' : ''} will remain deployed, including "{revertTo}".
          </p>
          {isProduction && (
            <p className="text-sm text-red-700 font-bold mb-2">
              WARNING: "{target}" is a PRODUCTION target. Destructive actions require extra confirmation.
            </p>
          )}
          {hasDepBlockers && (
            <div className="mb-2 p-2 border border-yellow-500 bg-yellow-500/10 rounded">
              <p className="text-sm text-yellow-700 font-medium">Blocked by dependencies</p>
              <p className="text-xs text-yellow-600">
                The following remaining changes depend on changes being reverted: {blockedByDeps.join(', ')}.
                Revert these dependent changes first, or revert all at once.
              </p>
            </div>
          )}
          {changesToRevert.map((c) => (
            <div key={c.changeId} className="text-xs font-mono text-red-500">✕ {c.name}</div>
          ))}
          {showCommands && (
            <div className="mt-2 p-2 bg-background rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>sqitch revert {target} --to {revertTo} -y</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(`sqitch revert ${target} --to ${revertTo} -y`)} className="ml-2 text-xs hover:text-foreground">Copy</button>
            </div>
          )}
        </div>
      )}

      {confirming && requiresConfirm && !isProduction && (
        <div className="mb-4">
          <label className="text-sm block mb-1">
            Type <strong>{changesToRevert.length}</strong> to confirm revert:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-background w-32"
          />
        </div>
      )}

      {confirming && isProduction && (
        <div className="mb-4">
          <label className="text-sm block mb-1 text-red-700 font-semibold">
            Type <strong>REVERT PRODUCTION</strong> to confirm revert on production target:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="border border-red-600 rounded px-3 py-1.5 text-sm bg-background w-64"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isRunning || !target || !revertTo || hasDepBlockers}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
        >
          Preview Revert
        </button>
        {confirming && (
          <button
            type="button"
            onClick={handleRevert}
            disabled={isRunning || (requiresConfirm && confirmText !== String(changesToRevert.length)) || (isProduction && confirmText !== 'REVERT PRODUCTION')}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
          >
            Confirm Revert
          </button>
        )}
      </div>
    </div>
  );
}
