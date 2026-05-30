import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useIpc } from '../../hooks/useIpc';

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(200);
  const ipc = useIpc();

  const writeLine = useCallback((data: string, type: 'stdout' | 'stderr') => {
    if (!xtermRef.current) return;
    const prefix = type === 'stderr' ? '\x1b[31m' : '';
    const suffix = type === 'stderr' ? '\x1b[0m' : '';
    xtermRef.current.writeln(`${prefix}${data}${suffix}`);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new Terminal({
      scrollback: 10000,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      cursorBlink: false,
      disableStdin: true,
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
    fitRef.current?.fit();
  }, [isOpen, height]);

  // Listen for stream events
  useEffect(() => {
    const unsubStream = ipc.onSqitchStream((event) => {
      setIsOpen(true);
      const lines = event.data.split('\n');
      for (const line of lines) {
        if (line.trim()) writeLine(line, event.type);
      }
    });

    const unsubComplete = ipc.onSqitchComplete(() => {
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[32m--- Command completed ---\x1b[0m');
      }
    });

    const unsubError = ipc.onSqitchError((event) => {
      setIsOpen(true);
      writeLine(`ERROR: ${event.error}`, 'stderr');
    });

    return () => {
      unsubStream();
      unsubComplete();
      unsubError();
    };
  }, [ipc, writeLine]);

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.5, startHeight + delta));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      fitRef.current?.fit();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height]);

  return (
    <div className="border-t bg-background flex flex-col" style={{ height: isOpen ? height : 32 }}>
      <div
        className="flex items-center justify-between px-3 py-1 bg-muted/50 cursor-pointer select-none border-b"
        onClick={handleToggle}
      >
        <span className="text-xs font-medium">Terminal</span>
        <div className="flex gap-2">
          {isOpen && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted-foreground">{isOpen ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* Resize handle */}
      {isOpen && (
        <div
          className="h-1 cursor-ns-resize bg-border hover:bg-primary/50"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      <div ref={terminalRef} className="flex-1 overflow-hidden px-1" style={{ display: isOpen ? 'block' : 'none' }} />
    </div>
  );
}
