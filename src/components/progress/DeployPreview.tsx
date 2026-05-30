interface DeployPreviewProps {
  pendingChanges: string[];
  target: string;
  showCommand: boolean;
  toChange?: string;
}

export function DeployPreview({ pendingChanges, target, showCommand, toChange }: DeployPreviewProps) {
  const count = pendingChanges.length;
  const summary = toChange
    ? `You're about to deploy ${count} changes to ${target}, up to "${toChange}".`
    : `You're about to deploy ${count} new change${count > 1 ? 's' : ''} to ${target}.`;

  return (
    <div className="border rounded-lg p-4 mb-4 bg-muted/30">
      <p className="text-sm mb-3">{summary}</p>
      <div className="space-y-1">
        {pendingChanges.map((change, i) => (
          <div key={i} className="text-xs font-mono flex items-center gap-2">
            <span className="text-green-500">+ {change}</span>
          </div>
        ))}
      </div>
      {showCommand && (
        <div className="mt-3 p-2 bg-background rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
          <span>sqitch deploy {target}{toChange ? ` --to ${toChange}` : ''} --verify</span>
          <button type="button" onClick={() => navigator.clipboard.writeText(`sqitch deploy ${target}${toChange ? ` --to ${toChange}` : ''} --verify`)} className="ml-2 text-xs hover:text-foreground">Copy</button>
        </div>
      )}
    </div>
  );
}
