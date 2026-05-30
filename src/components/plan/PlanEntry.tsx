import type { PlanEntry } from '../../types/plan';
import { useIpc } from '../../hooks/useIpc';
import { showToast } from '../shared/Toast';

interface PlanEntryProps {
  entry: PlanEntry;
  showCommand: boolean;
  projectPath: string;
}

export function PlanEntry({ entry, showCommand, projectPath }: PlanEntryProps) {
  const ipc = useIpc();
  if (entry.type === 'pragma') {
    return (
      <div className="text-xs text-muted-foreground py-0.5 pl-4">
        % {entry.pragma!.key}={entry.pragma!.value}
      </div>
    );
  }

  if (entry.type === 'tag') {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-4 border-l-2 border-primary/30 ml-2">
        <span className="bg-primary/20 text-primary text-xs font-mono px-2 py-0.5 rounded">
          @{entry.tag!.name}
        </span>
        <span className="text-xs text-muted-foreground">{entry.tag!.note}</span>
        {showCommand && (
          <span className="text-xs font-mono text-muted-foreground">
            sqitch tag {entry.tag!.name}
          </span>
        )}
      </div>
    );
  }

  if (entry.type === 'change') {
    const change = entry.change!;
    const scriptPath = `${projectPath}/deploy/${change.name}.sql`;

    const handleOpenInEditor = async () => {
      const result = await ipc.editorOpenFile(scriptPath);
      if (result.editorName) {
        showToast(`Opened in ${result.editorName}`);
      }
    };

    return (
      <div className="flex items-start gap-2 py-1.5 pl-2 border-l-2 border-border ml-2 hover:bg-muted/30">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{change.name}</span>
          </div>
          {change.requires.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              requires {change.requires.join(', ')}
            </div>
          )}
          {change.conflicts.length > 0 && (
            <div className="text-xs text-red-500 mt-0.5">
              conflicts with {change.conflicts.join(', ')}
            </div>
          )}
          {change.note && (
            <div className="text-xs text-muted-foreground mt-0.5">{change.note}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenInEditor}
            className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Open deploy script in editor"
          >
            Open in Editor
          </button>
          {showCommand && (
            <span className="text-xs font-mono text-muted-foreground">
              sqitch add {change.name}
              {change.requires.map(r => ` -r ${r}`).join('')}
              {change.conflicts.map(c => ` -x ${c}`).join('')}
              {change.note ? ` -n "${change.note}"` : ''}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
