import { useState, useEffect } from 'react';
import { useIpc } from '../../hooks/useIpc';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const [sqitchPath, setSqitchPath] = useState('');
  const [editor, setEditor] = useState('');
  const [theme, setTheme] = useState('system');
  const [showCommandsDefault, setShowCommandsDefault] = useState(false);
  const [timeout, setTimeout_] = useState('300000');
  const [scrollback, setScrollback] = useState('10000');
  const [revertThreshold, setRevertThreshold] = useState('5');

  useEffect(() => {
    if (!open) return;
    ipc.settingsGet('sqitchPath').then((r: any) => setSqitchPath(r.value || ''));
    ipc.settingsGet('editor').then((r: any) => setEditor(r.value || ''));
    ipc.settingsGet('theme').then((r: any) => setTheme(r.value || 'system'));
    ipc.settingsGet('showCommandsDefault').then((r: any) => setShowCommandsDefault(r.value === 'true'));
    ipc.settingsGet('commandTimeout').then((r: any) => setTimeout_(r.value || '300000'));
    ipc.settingsGet('scrollbackBuffer').then((r: any) => setScrollback(r.value || '10000'));
    ipc.settingsGet('revertThreshold').then((r: any) => setRevertThreshold(r.value || '5'));
  }, [open]);

  const handleSave = async () => {
    try {
      await ipc.settingsSet('sqitchPath', sqitchPath);
      await ipc.settingsSet('editor', editor);
      await ipc.settingsSet('theme', theme);
      await ipc.settingsSet('showCommandsDefault', String(showCommandsDefault));
      await ipc.settingsSet('commandTimeout', timeout);
      await ipc.settingsSet('scrollbackBuffer', scrollback);
      await ipc.settingsSet('revertThreshold', revertThreshold);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Sqitch Binary Path</label>
            <input value={sqitchPath} onChange={(e) => setSqitchPath(e.target.value)} placeholder="Auto-detected" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
            <p className="text-xs text-muted-foreground mt-1">Leave empty for auto-detection via PATH</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">External Editor</label>
            <input value={editor} onChange={(e) => setEditor(e.target.value)} placeholder="code (auto-detected from $EDITOR)" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Show Commands Default</label>
            <input type="checkbox" checked={showCommandsDefault} onChange={(e) => setShowCommandsDefault(e.target.checked)} className="ml-2" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Command Timeout (ms)</label>
            <input type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Terminal Scrollback Buffer</label>
            <input type="number" value={scrollback} onChange={(e) => setScrollback(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Large Revert Warning Threshold</label>
            <input type="number" value={revertThreshold} onChange={(e) => setRevertThreshold(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
