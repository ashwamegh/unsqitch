interface ProjectCardProps {
  name: string;
  engine: string;
  changeCount: number;
  lastDeployment?: string;
  onClick: () => void;
  onRemove: () => void;
}

export function ProjectCard({ name, engine, changeCount, lastDeployment, onClick, onRemove }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors group relative"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">{name}</h3>
        <span className="text-xs bg-muted px-2 py-0.5 rounded">{engine}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {changeCount} changes
        {lastDeployment && ` · Last deployed ${new Date(lastDeployment).toLocaleDateString()}`}
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition-opacity"
        title="Remove from recent"
      >
        X
      </button>
    </div>
  );
}
