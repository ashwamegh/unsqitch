import { AppWindow, Cpu, Sliders, Sparkles, Terminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIpc } from "../../hooks/useIpc";
import { type ThemeMode, useThemeStore } from "../../store/theme";
import { showToast } from "./Toast";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const [sqitchPath, setSqitchPath] = useState("");
  const [editor, setEditor] = useState("");
  const [theme, setTheme] = useState("system");
  const [showCommandsDefault, setShowCommandsDefault] = useState(false);
  const [timeout, setTimeout_] = useState("300000");
  const [scrollback, setScrollback] = useState("10000");
  const [revertThreshold, setRevertThreshold] = useState("5");

  useEffect(() => {
    if (!open) return;
    ipc.settingsGet("sqitchPath").then((r: any) => setSqitchPath(r.value || ""));
    ipc.settingsGet("editor").then((r: any) => setEditor(r.value || ""));
    ipc.settingsGet("theme").then((r: any) => setTheme(r.value || "system"));
    ipc
      .settingsGet("showCommandsDefault")
      .then((r: any) => setShowCommandsDefault(r.value === "true"));
    ipc.settingsGet("commandTimeout").then((r: any) => setTimeout_(r.value || "300000"));
    ipc.settingsGet("scrollbackBuffer").then((r: any) => setScrollback(r.value || "10000"));
    ipc.settingsGet("revertThreshold").then((r: any) => setRevertThreshold(r.value || "5"));
  }, [open, ipc]);

  const setThemeStore = useThemeStore((s) => s.setTheme);

  const handleSave = async () => {
    try {
      await ipc.settingsSet("sqitchPath", sqitchPath);
      await ipc.settingsSet("editor", editor);
      await setThemeStore(ipc, theme as ThemeMode);
      await ipc.settingsSet("showCommandsDefault", String(showCommandsDefault));
      await ipc.settingsSet("commandTimeout", timeout);
      await ipc.settingsSet("scrollbackBuffer", scrollback);
      await ipc.settingsSet("revertThreshold", revertThreshold);
      showToast("Settings saved successfully", "success");
      onClose();
    } catch (err) {
      console.error("Failed to save settings:", err);
      showToast("Failed to save settings", "error");
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 overflow-y-auto max-h-[90vh] flex flex-col relative text-foreground animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-6">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-primary" />
            <h2 className="text-base font-bold tracking-tight">System Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-6 flex-1 pr-1">
          {/* Section: Executables */}
          <div>
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Cpu size={12} /> Environment & Executables
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                  Sqitch Binary Path
                </label>
                <input
                  type="text"
                  value={sqitchPath}
                  onChange={(e) => setSqitchPath(e.target.value)}
                  placeholder="Auto-detected"
                  className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3.5 py-2.5 text-xs text-foreground font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium">
                  Leave empty for default path auto-detection.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                  External Editor
                </label>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  placeholder="code (auto-detected from $EDITOR)"
                  className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3.5 py-2.5 text-xs text-foreground font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: UI & Terminal */}
          <div>
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <AppWindow size={12} /> Interface & Shell defaults
            </h4>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                    Theme Mode
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3 py-2.5 text-xs text-foreground font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="system">System Preference</option>
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                  </select>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={showCommandsDefault}
                      onChange={(e) => setShowCommandsDefault(e.target.checked)}
                      className="accent-primary rounded h-4 w-4 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground/80">
                      Show Commands by Default
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                    Command Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout_(e.target.value)}
                    className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3.5 py-2.5 text-xs text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                    Scrollback Buffer Lines
                  </label>
                  <input
                    type="number"
                    value={scrollback}
                    onChange={(e) => setScrollback(e.target.value)}
                    className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3.5 py-2.5 text-xs text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Operational Safety */}
          <div>
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Terminal size={12} /> Safety Guidelines
            </h4>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                Large Revert Warning Threshold
              </label>
              <input
                type="number"
                value={revertThreshold}
                onChange={(e) => setRevertThreshold(e.target.value)}
                className="w-full border border-border bg-muted/40 focus:bg-background rounded-xl px-3.5 py-2.5 text-xs text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium">
                Warns before reverting more than this number of changes at once.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border hover:bg-muted text-foreground font-medium rounded-xl text-xs transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground font-semibold rounded-xl text-xs shadow-md shadow-primary/10 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Sparkles size={13} />
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
