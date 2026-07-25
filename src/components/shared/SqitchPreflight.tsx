import { AlertTriangle, Check, Clipboard, ExternalLink, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useIpc } from "../../hooks/useIpc";
import { showToast } from "./Toast";

interface DetectResult {
  found: boolean;
  path: string | null;
  version: string | null;
  meetsMinimum: boolean;
}

const INSTALL_HINTS: Record<string, { label: string; command: string }> = {
  darwin: { label: "macOS", command: "cpanm App::Sqitch" },
  linux: { label: "Linux", command: "sudo apt install sqitch  # or: cpanm App::Sqitch" },
  win32: { label: "Windows", command: "choco install sqitch" },
};

/**
 * First-run guard: detect the Sqitch CLI and explain what to do when it is
 * missing or too old, instead of letting the first command fail cryptically.
 * The user can dismiss it for the session and keep browsing file-based views.
 */
export function SqitchPreflight() {
  const ipc = useIpc();
  const [result, setResult] = useState<DetectResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [checking, setChecking] = useState(false);

  const detect = async () => {
    setChecking(true);
    try {
      const r = (await ipc.sqitchDetect()) as DetectResult;
      setResult(r);
      return r;
    } catch {
      setResult({ found: false, path: null, version: null, meetsMinimum: false });
      return null;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    detect();
  }, []);

  const saveManualPath = async () => {
    if (!manualPath) return;
    await ipc.settingsSet("sqitchPath", manualPath);
    const r = await detect();
    if (r?.found) {
      showToast(`Using sqitch at ${r.path}`, "success");
      setDismissed(true);
    } else {
      showToast("No sqitch binary at that path", "error");
    }
  };

  // Nothing to say while detecting, when all is well, or once dismissed.
  if (!result || dismissed) return null;
  if (result.found && result.meetsMinimum) return null;

  const platform =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
      ? "darwin"
      : /Win/i.test(navigator?.platform ?? "")
        ? "win32"
        : "linux";
  const hint = INSTALL_HINTS[platform];

  const outdated = result.found && !result.meetsMinimum;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/5 px-6 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-400">
            {outdated
              ? `Sqitch ${result.version} is too old — v1.0.0 or later is required`
              : "Sqitch CLI not found"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {outdated
              ? "Upgrade Sqitch to run deploy, revert, verify, status and log."
              : "You can browse the plan and scripts without it, but deploying, reverting, verifying and status need the Sqitch CLI installed."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="px-2.5 py-1.5 bg-black/40 border border-border/60 rounded-lg text-[11px] font-mono text-foreground/90 select-all">
              {hint.command}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(hint.command);
                showToast("Install command copied");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
            >
              <Clipboard size={11} />
              Copy
            </button>
            <a
              href="https://sqitch.org/download/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
            >
              <ExternalLink size={11} />
              Install guide ({hint.label})
            </a>
            <button
              type="button"
              onClick={detect}
              disabled={checking}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-card hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={checking ? "animate-spin" : ""} />
              Re-check
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Or set the path
            </span>
            <input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="/usr/local/bin/sqitch"
              className="flex-1 min-w-[200px] max-w-sm border border-border bg-card/65 focus:bg-background rounded-lg px-3 py-1.5 text-[11px] font-mono text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={saveManualPath}
              disabled={!manualPath}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 font-bold rounded-lg text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <Check size={11} />
              Use this
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Dismiss for this session"
          className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md hover:bg-accent/40 shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
