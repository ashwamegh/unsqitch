import { Check, Clipboard } from "lucide-react";
import { useState } from "react";
import { showToast } from "./Toast";

/**
 * The exact sqitch command a form will run, with a Copy Command button.
 *
 * Spec ("Show Commands Toggle"): every section shows the command it will execute
 * and offers to copy it, so a senior developer can lift it into a terminal.
 */
export function CommandPreview({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    showToast("Command copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`p-2.5 bg-black/40 border border-border/60 rounded-lg text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-3 ${className ?? ""}`}
    >
      <span className="truncate select-all">{command}</span>
      <button
        type="button"
        onClick={copy}
        title="Copy command"
        className="p-1 rounded bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
      >
        {copied ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
      </button>
    </div>
  );
}
