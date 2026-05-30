import { useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';

export function VerifyView() {
  const { currentProjectId, projects, isRunning } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [results, setResults] = useState<Array<{ change: string; status: string; raw: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === currentProjectId);

  const handleVerify = async () => {
    if (!project || !target) return;
    setError(null);
    try {
      useProjectStore.getState().setRunning(true);
      const result = await ipc.sqitchVerify(project.path, target);
      setResults((result as any).events || []);
    } catch (err: any) {
      setError(err.message || 'Verify failed');
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
        <button
          type="button"
          onClick={handleVerify}
          disabled={isRunning || !target}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 mt-5"
        >
          {isRunning ? 'Verifying...' : 'Run Verify'}
        </button>
      </div>

      {showCommands && target && (
        <div className="mb-4 p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
          sqitch verify {target}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 border border-destructive rounded text-sm text-destructive">{error}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 border rounded px-3 py-2 text-xs">
              <span>{r.status === 'ok' ? '✔' : r.status === 'not_ok' ? '✕' : '⟳'}</span>
              <span className="font-mono">{r.change}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
