import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';
import { DeployPreview } from '../../components/progress/DeployPreview';

export function DeployView() {
  const { status, currentProjectId, projects, isRunning, setStatus } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [confirmedTarget, setConfirmedTarget] = useState('');
  const [toChange, setToChange] = useState('');

  const project = projects.find((p) => p.id === currentProjectId);
  const pending = status?.pending ?? [];

  useEffect(() => {
    if (project && confirmedTarget) {
      ipc.sqitchStatus(project.path, confirmedTarget).then((result) => {
        setStatus(result as any);
      }).catch(console.error);
    }
  }, [project, confirmedTarget, ipc, setStatus]);

  const handleDeploy = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    try {
      useProjectStore.getState().setRunning(true);
      await ipc.sqitchDeploy(project.path, target, toChange || undefined);
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
    } catch (err) {
      console.error('Deploy failed:', err);
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
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Deploy to (optional)</label>
          <input
            type="text"
            value={toChange}
            onChange={(e) => setToChange(e.target.value)}
            placeholder="Leave empty for all pending"
            className="w-full border rounded px-3 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      {pending.length > 0 && (
        <DeployPreview
          pendingChanges={pending}
          target={target}
          showCommand={showCommands}
          toChange={toChange || undefined}
        />
      )}

      <button
        type="button"
        onClick={handleDeploy}
        disabled={isRunning || !target}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {isRunning ? 'Deploying...' : 'Deploy'}
      </button>
    </div>
  );
}
