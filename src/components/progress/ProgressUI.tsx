import { useProjectStore } from '../../store/project';
import { useIpc } from '../../hooks/useIpc';

export function ProgressUI() {
  const { events, isRunning } = useProjectStore();
  const ipc = useIpc();

  if (events.length === 0 && !isRunning) return null;

  const completed = events.filter((e) => e.status === 'ok' || e.status === 'not_ok' || e.status === 'failed').length;
  const total = events.length || 1;
  const progress = (completed / total) * 100;
  const hasFailed = events.some((e) => e.status === 'failed');

  return (
    <div className="border-b bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {isRunning ? 'Running...' : hasFailed ? 'Failed' : 'Completed'}
        </span>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} changes
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${hasFailed ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-0.5">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span>
              {event.status === 'ok' ? '✔' : event.status === 'failed' ? '✕' : event.status === 'not_ok' ? '✕' : '⟳'}
            </span>
            <span className="font-mono">{event.change}</span>
            {event.target && <span className="text-muted-foreground">→ {event.target}</span>}
          </div>
        ))}
      </div>

      {isRunning && (
        <button
          type="button"
          onClick={() => {
            ipc.sqitchCancel();
            useProjectStore.getState().setRunning(false);
          }}
          className="mt-2 px-3 py-1 border border-destructive text-destructive rounded text-xs hover:bg-destructive/10"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
