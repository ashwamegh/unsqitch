import { useNavigationStore, type Section } from '../../store/navigation';
import { useProjectStore } from '../../store/project';

const devSections: { id: Section; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'revert', label: 'Revert' },
  { id: 'status', label: 'Status' },
  { id: 'verify', label: 'Verify' },
  { id: 'log', label: 'Log' },
];

const setupSections: { id: Section; label: string }[] = [
  { id: 'engine', label: 'Engine' },
  { id: 'target', label: 'Target' },
  { id: 'config', label: 'Config' },
];

export function Sidebar() {
  const { view, section, setSection, goHome, showCommands, toggleShowCommands, commandTooltipDismissed, dismissCommandTooltip } = useNavigationStore();
  const currentProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId)
  );

  if (view === 'home') {
    return (
      <aside className="w-56 border-r bg-muted/30 flex flex-col p-4">
        <h1 className="text-lg font-semibold mb-4">UnSqitch</h1>
        <p className="text-sm text-muted-foreground">Select or open a project</p>
      </aside>
    );
  }

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <button
          onClick={goHome}
          className="text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          Back
        </button>
        <h2 className="text-sm font-semibold truncate">{currentProject?.name ?? 'Project'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-1">Development</p>
        {devSections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              section === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}

        <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-4 mb-1">Setup</p>
        {setupSections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              section === s.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-3 border-t">
        <div className="relative">
          <button
            onClick={toggleShowCommands}
            className={`text-xs px-2 py-1 rounded border ${
              showCommands ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            }`}
          >
            Show Commands
          </button>
          {!commandTooltipDismissed && !showCommands && (
            <div className="absolute bottom-full left-0 mb-2 bg-popover text-popover-foreground border rounded px-2 py-1 text-xs w-48 shadow-md">
              Toggle this to see the exact sqitch CLI commands behind each action.
              <button onClick={dismissCommandTooltip} className="ml-1 text-muted-foreground hover:text-foreground">X</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
