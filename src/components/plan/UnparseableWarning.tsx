import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface UnparseableWarningProps {
  lines: Array<{ line: string; index: number }>;
}

export function UnparseableWarning({ lines }: UnparseableWarningProps) {
  const [expanded, setExpanded] = useState(false);

  if (lines.length === 0) return null;

  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 mb-6 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full text-left text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
      >
        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
        <span className="flex-1">
          {lines.length} line{lines.length > 1 ? "s" : ""} in sqitch.plan could not be parsed
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && (
        <div className="mt-3 text-[11px] font-mono bg-black/40 border border-amber-500/10 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
          {lines.map((l) => (
            <div key={l.index} className="text-amber-200/70 flex items-start gap-2">
              <span className="text-amber-500/50 select-none">Line {l.index + 1}:</span>
              <span className="text-amber-200/90 whitespace-pre">{l.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
