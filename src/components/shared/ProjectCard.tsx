import { Database, Folder, Trash2 } from "lucide-react";

interface ProjectCardProps {
  name: string;
  engine: string;
  changeCount: number;
  lastDeployment?: string;
  onClick: () => void;
  onRemove: () => void;
}

export function ProjectCard({
  name,
  engine,
  changeCount,
  lastDeployment,
  onClick,
  onRemove,
}: ProjectCardProps) {
  // Get database engine color badges
  const getEngineBadgeStyles = (eng: string) => {
    switch (eng.toLowerCase()) {
      case "pg":
      case "postgres":
      case "postgresql":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/25";
      case "mysql":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/25";
      case "sqlite":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25";
      default:
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25";
    }
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        // Spec: right-click a project card to remove it from the recent list.
        e.preventDefault();
        onRemove();
      }}
      className="glass-card rounded-xl p-5 cursor-pointer relative overflow-hidden group flex flex-col justify-between h-40 shadow-sm"
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Folder size={18} className="stroke-[2.2]" />
            </div>
            <h3 className="font-semibold text-base tracking-tight text-foreground/90 group-hover:text-primary transition-colors duration-250 truncate max-w-[150px]">
              {name}
            </h3>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getEngineBadgeStyles(engine)} flex items-center gap-1`}
          >
            <Database size={10} />
            {engine}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-2">
          <span>{changeCount} changes</span>
          {lastDeployment && (
            <>
              <span className="text-border">•</span>
              <span className="truncate">
                Deployed {new Date(lastDeployment).toLocaleDateString()}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex justify-end pt-3 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove from recent"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
