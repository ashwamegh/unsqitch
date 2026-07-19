import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { ChevronDown, ChevronUp, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { useIpc } from "../../hooks/useIpc";
import { showToast } from "../shared/Toast";

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(200);
  const ipc = useIpc();

  const writeLine = useCallback((data: string, type: "stdout" | "stderr") => {
    if (!xtermRef.current) return;
    const prefix = type === "stderr" ? "\x1b[31m" : "";
    const suffix = type === "stderr" ? "\x1b[0m" : "";
    xtermRef.current.writeln(`${prefix}${data}${suffix}`);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new Terminal({
      scrollback: 10000,
      fontSize: 12,
      fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
      cursorBlink: false,
      disableStdin: true,
      theme: {
        background: "#0a0a0f",
        foreground: "#cbd5e1",
        cursor: "#6366f1",
        black: "#1e293b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#f8fafc",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    return () => {
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!xtermRef.current || !isOpen) return;
    // Delayed fit to ensure container layout settles
    const timer = setTimeout(() => {
      fitRef.current?.fit();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Listen for stream events
  useEffect(() => {
    const unsubStream = ipc.onSqitchStream((event) => {
      setIsOpen(true);
      const lines = event.data.split("\n");
      for (const line of lines) {
        if (line.trim()) writeLine(line, event.type);
      }
    });

    const unsubComplete = ipc.onSqitchComplete((event) => {
      if (xtermRef.current) {
        xtermRef.current.writeln("\x1b[32m✔ CLI Command Completed successfully ---\x1b[0m");
      }
      // Spec: terminal auto-closes on a successful command; stays open on failure.
      if (event.exitCode === 0) {
        setTimeout(() => setIsOpen(false), 1200);
      }
    });

    const unsubError = ipc.onSqitchError((event) => {
      setIsOpen(true);
      writeLine(`ERROR: ${event.error}`, "stderr");
    });

    return () => {
      unsubStream();
      unsubComplete();
      unsubError();
    };
  }, [ipc, writeLine]);

  const handleClear = () => {
    xtermRef.current?.clear();
    showToast("Terminal clear");
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(150, Math.min(window.innerHeight * 0.5, startHeight + delta));
        setHeight(newHeight);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        fitRef.current?.fit();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height],
  );

  return (
    <div
      className="border-t border-border/80 bg-[#0a0a0f] flex flex-col transition-all duration-200 relative"
      style={{ height: isOpen ? height : 36 }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 h-9 bg-card/60 backdrop-blur-md cursor-pointer select-none border-b border-border/50 shrink-0"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-primary" />
          <span className="text-xs font-bold text-foreground/80 uppercase tracking-widest">
            Console Logs
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40 cursor-pointer"
            >
              <Trash2 size={11} />
              Clear Console
            </button>
          )}
          <span className="text-muted-foreground p-0.5">
            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </div>
      </div>

      {/* Resize handle */}
      {isOpen && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/50 transition-colors z-20"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Terminal View Container */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden py-2 px-3 bg-[#0a0a0f]"
        style={{ display: isOpen ? "block" : "none" }}
      />
    </div>
  );
}
