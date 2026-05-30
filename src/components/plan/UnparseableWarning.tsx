import { useState } from 'react';

interface UnparseableWarningProps {
  lines: Array<{ line: string; index: number }>;
}

export function UnparseableWarning({ lines }: UnparseableWarningProps) {
  const [expanded, setExpanded] = useState(false);

  if (lines.length === 0) return null;

  return (
    <div className="border border-yellow-500/50 bg-yellow-500/10 rounded p-3 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-yellow-600 hover:text-yellow-500"
      >
        {lines.length} line{lines.length > 1 ? 's' : ''} in sqitch.plan could not be parsed
        <span className="ml-1">{expanded ? 'V' : '>'}</span>
      </button>
      {expanded && (
        <div className="mt-2 text-xs font-mono bg-background/50 rounded p-2 max-h-40 overflow-y-auto">
          {lines.map((l) => (
            <div key={l.index} className="text-yellow-700">
              Line {l.index + 1}: {l.line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
