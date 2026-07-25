import { Check, Clipboard, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { showToast } from "../shared/Toast";

interface DeployPreviewProps {
  pendingChanges: string[];
  target: string;
  showCommand: boolean;
  toChange?: string;
  /** False when no status for this target is known yet, so the diff is a guess. */
  stateKnown?: boolean;
}

export function DeployPreview({
  pendingChanges,
  target,
  showCommand,
  toChange,
  stateKnown = true,
}: DeployPreviewProps) {
  const [copied, setCopied] = useState(false);

  // With --to, sqitch stops at that change, so only list/count up to it.
  const stopAt = toChange ? pendingChanges.indexOf(toChange) : -1;
  const changes = stopAt >= 0 ? pendingChanges.slice(0, stopAt + 1) : pendingChanges;
  const count = changes.length;
  const plural = count === 1 ? "" : "s";

  const summary =
    toChange && stopAt >= 0
      ? `You're about to deploy ${count} change${plural} to "${target}", up to and including "${toChange}".`
      : toChange
        ? `You're about to deploy up to change "${toChange}" on "${target}". It is not in the pending list — sqitch will decide what to apply.`
        : `You're about to deploy ${count} pending change${plural} to target "${target}".`;

  const command = `sqitch deploy ${target}${toChange ? ` --to ${toChange}` : ""} --verify`;

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    showToast("Deploy command copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-xl p-5 mb-6 shadow-md border border-border/80">
      <div className="flex items-center gap-2.5 mb-4 text-emerald-400 font-semibold text-sm">
        <Layers size={16} />
        <span>Deployment Plan Preview</span>
      </div>

      <p className="text-xs text-foreground/80 mb-2 leading-relaxed font-medium">{summary}</p>

      <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">
        {stateKnown
          ? "Informational — computed from your plan and the last known status; verified against the database before execution."
          : "Informational — no status has been read from this target yet, so changes already deployed may be listed. It is verified against the database before execution."}
      </p>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 bg-black/20 rounded-lg p-3 border border-border/40">
        {changes.map((change, i) => (
          <div key={i} className="text-[11px] font-mono flex items-center gap-2 text-emerald-300">
            <Plus size={10} className="stroke-[3]" />
            <span>{change}</span>
          </div>
        ))}
      </div>

      {showCommand && (
        <div className="mt-4 p-2.5 bg-black/40 border border-border/60 rounded-lg text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-3">
          <span className="truncate select-all">{command}</span>
          <button
            onClick={handleCopy}
            className="p-1 rounded bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
            title="Copy command"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Clipboard size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}
