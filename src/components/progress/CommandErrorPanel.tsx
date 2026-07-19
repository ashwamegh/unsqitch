import {
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ExternalLink,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import type { AppError } from "../../types/error";
import { showToast } from "../shared/Toast";

interface CommandErrorPanelProps {
  error: AppError;
  onRetry?: () => void;
  onRevert?: () => void;
  onDismiss?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  sqitch_crash: "Command failed",
  db_connection: "Database connection error",
  file_permission: "File permission error",
  binary_not_found: "Sqitch not found",
  partial_deployment: "Partial deployment",
  command_timeout: "Command timed out",
  unknown: "Unexpected error",
};

const ISSUES_URL = "https://github.com/ashwamegh/unsqitch/issues/new";

export function CommandErrorPanel({ error, onRetry, onRevert, onDismiss }: CommandErrorPanelProps) {
  const [logOpen, setLogOpen] = useState(false);

  const handleAction = (action: string) => {
    switch (action) {
      case "retry":
        onRetry?.();
        break;
      case "revert":
        onRevert?.();
        break;
      case "view_log":
        setLogOpen((v) => !v);
        break;
      case "check_connection":
        showToast("Check the target database is reachable and credentials are correct", "warning");
        break;
      default:
        break;
    }
  };

  const copyDetails = () => {
    const details = `[${error.type}] ${error.message}\n\n${error.sqitchOutput ?? ""}`;
    navigator.clipboard.writeText(details);
    showToast("Error details copied");
  };

  return (
    <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-5 shadow-md space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertOctagon size={18} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-destructive">
              {TYPE_LABELS[error.type] ?? "Error"}
            </p>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{error.message}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground text-xs font-bold cursor-pointer p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Recovery actions from the AppError */}
      <div className="flex flex-wrap gap-2">
        {error.actions.map((a) => {
          const disabled =
            (a.action === "retry" && !onRetry) || (a.action === "revert" && !onRevert);
          if (disabled) return null;
          const Icon =
            a.action === "retry" ? RefreshCw : a.action === "revert" ? RotateCcw : ChevronRight;
          return (
            <button
              type="button"
              key={a.action + a.label}
              onClick={() => handleAction(a.action)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
            >
              <Icon size={11} />
              {a.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={copyDetails}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
        >
          <Clipboard size={11} />
          Copy Error Details
        </button>
        {error.type === "unknown" && (
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
          >
            <ExternalLink size={11} />
            Report Issue
          </a>
        )}
      </div>

      {/* Raw sqitch output (View Full Log) */}
      {error.sqitchOutput && (
        <div>
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {logOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            View Full Log
          </button>
          {logOpen && (
            <pre className="mt-2 max-h-48 overflow-auto bg-black/40 border border-border/60 rounded-lg p-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
              {error.sqitchOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
