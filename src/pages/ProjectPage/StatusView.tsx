import { useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useIpc } from '../../hooks/useIpc';

export function StatusView() {
  const { status, currentProjectId, projects, setStatus, setLastStatusRefresh } = useProjectStore();
  const ipc = useIpc();
  const [target, setTarget] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const project = projects.find((p) => p.id === currentProjectId);

  const deployed = status?.deployed ?? [];
  const pending = status?.pending ?? [];
  const paged = deployed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(deployed.length / PAGE_SIZE);

  const handleRefresh = async () => {
    if (!project || !target) return;
    try {
      const result = await ipc.sqitchStatus(project.path, target);
      setStatus(result as any);
      setLastStatusRefresh(Date.now());
    } catch (err) {
      console.error('Status refresh failed:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
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
          onClick={handleRefresh}
          className="px-3 py-1.5 border rounded text-sm hover:bg-muted mt-5"
        >
          Refresh
        </button>
      </div>

      {status && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{deployed.length}</div>
              <div className="text-xs text-muted-foreground">Deployed</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{pending.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{status.lastChange || '—'}</div>
              <div className="text-xs text-muted-foreground">Last Change</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{deployed.length > 0 ? deployed[0].name : '—'}</div>
              <div className="text-xs text-muted-foreground">First Deployed</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-2">Deployed Changes</h3>
          <div className="space-y-1">
            {paged.map((change) => (
              <div key={change.changeId} className="flex items-center justify-between border rounded px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{change.name}</span>
                  {change.tags.length > 0 && (
                    <span className="text-muted-foreground">
                      {change.tags.map(t => `@${t}`).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {change.deployedAt} · {change.deployedBy}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
