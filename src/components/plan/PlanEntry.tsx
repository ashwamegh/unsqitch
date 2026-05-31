import { AlertTriangle, Check, Copy, ExternalLink, FileCode, Layers, Tag } from "lucide-react";
import { useState } from "react";
import { useIpc } from "../../hooks/useIpc";
import type { PlanEntry as PlanEntryType } from "../../types/plan";
import { showToast } from "../shared/Toast";

interface PlanEntryProps {
  entry: PlanEntryType;
  showCommand: boolean;
  projectPath: string;
}

export function PlanEntry({ entry, showCommand, projectPath }: PlanEntryProps) {
  const ipc = useIpc();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Command copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (entry.type === "pragma") {
    return (
      <div className="flex items-center gap-2 py-1 px-4 text-[11px] font-mono text-muted-foreground bg-muted/5 border-l-2 border-border/30 ml-4 my-1">
        <span className="text-primary/70">%</span>
        <span className="font-semibold text-foreground/75">{entry.pragma?.key}</span>
        <span>=</span>
        <span>{entry.pragma?.value}</span>
      </div>
    );
  }

  if (entry.type === "tag") {
    return (
      <div className="relative flex items-center gap-3 py-3 pl-4 border-l-2 border-primary/30 ml-4 my-2">
        <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full shadow-sm">
          <Tag size={12} className="stroke-[2.2]" />
          <span>@{entry.tag?.name}</span>
        </div>
        {entry.tag?.note && (
          <span className="text-xs text-muted-foreground font-medium italic">
            — {entry.tag?.note}
          </span>
        )}
        {showCommand && (
          <span className="text-[10px] font-mono bg-muted/40 px-2 py-0.5 rounded border border-border/50 text-muted-foreground ml-auto">
            sqitch tag {entry.tag?.name}
          </span>
        )}
      </div>
    );
  }

  if (entry.type === "change") {
    const change = entry.change!;
    const scriptPath = `${projectPath}/deploy/${change.name}.sql`;

    const handleOpenInEditor = async () => {
      const result = await ipc.editorOpenFile(scriptPath);
      if (result.editorName) {
        showToast(`Opened in ${result.editorName}`);
      }
    };

    const cmdText = `sqitch add ${change.name}${change.requires.map((r) => ` -r ${r}`).join("")}${change.conflicts.map((c) => ` -x ${c}`).join("")}${change.note ? ` -n "${change.note}"` : ""}`;

    return (
      <div className="relative flex items-start gap-4 py-4 pl-6 border-l-2 border-border ml-4 hover:bg-muted/10 group transition-all duration-200 rounded-r-xl">
        {/* Timeline Node Dot */}
        <div className="absolute -left-[5px] top-6 w-2.5 h-2.5 rounded-full bg-border group-hover:bg-primary group-hover:scale-125 transition-all duration-200 border border-background" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors duration-250">
              <FileCode size={15} />
            </div>
            <span className="font-mono text-sm font-bold text-foreground/90 tracking-tight">
              {change.name}
            </span>
          </div>

          {/* Description */}
          {change.note && (
            <p className="text-xs text-muted-foreground font-medium mt-1.5 leading-relaxed max-w-2xl">
              {change.note}
            </p>
          )}

          {/* Dependency badges */}
          {(change.requires.length > 0 || change.conflicts.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {change.requires.map((req) => (
                <span
                  key={req}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-500/5 text-blue-400 border border-blue-500/10 px-2 py-0.5 rounded-full"
                >
                  <Layers size={10} />
                  requires: {req}
                </span>
              ))}
              {change.conflicts.map((conf) => (
                <span
                  key={conf}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-destructive/5 text-destructive border border-destructive/10 px-2 py-0.5 rounded-full"
                >
                  <AlertTriangle size={10} />
                  conflicts: {conf}
                </span>
              ))}
            </div>
          )}

          {/* Inline Command Display */}
          {showCommand && (
            <div className="mt-3 flex items-center justify-between gap-3 p-2 bg-black/35 rounded-lg border border-border/60 text-[10px] font-mono text-muted-foreground w-full max-w-2xl group/cmd">
              <span className="truncate select-all">{cmdText}</span>
              <button
                onClick={() => copyToClipboard(cmdText)}
                className="p-1 rounded bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Copy command"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 self-center pr-3">
          <button
            onClick={handleOpenInEditor}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-lg transition-all cursor-pointer active:scale-[0.97]"
            title="Open deploy script in editor"
          >
            <ExternalLink size={12} />
            Edit SQL
          </button>
        </div>
      </div>
    );
  }

  return null;
}
