import { AlertTriangle } from "lucide-react";
import { useProjectStore } from "../../store/project";

export function StaleBanner() {
  const { statusStale } = useProjectStore();

  if (!statusStale) return null;

  return (
    <div className="bg-amber-500/5 border-b border-amber-500/10 px-6 py-2.5 flex items-center gap-2.5 animate-in slide-in-from-top duration-300">
      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
      <span className="text-xs text-amber-400 font-semibold leading-none">
        State may be stale. Select a section or click Inspect Status/Refresh to fetch latest
        database details.
      </span>
    </div>
  );
}
