import { useState, useMemo } from 'react';
import { useProjectStore } from '../../store/project';
import { useIpc } from '../../hooks/useIpc';
import type { ConfigEntry } from '../../types/config';

export function ConfigView() {
  const { currentProjectId, projects } = useProjectStore();
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [activeSection, setActiveSection] = useState<string>('all');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const sections = useMemo(() => {
    const s = new Set(entries.map((e) => e.section));
    return ['all', ...Array.from(s).sort()];
  }, [entries]);

  const filtered = activeSection === 'all'
    ? entries
    : entries.filter((e) => e.section === activeSection);

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.configList(project.path);
    setEntries(result as any);
  };

  const handleSet = async () => {
    if (!project || !newKey || !newValue) return;
    await ipc.configSet(project.path, newKey, newValue);
    setNewKey(''); setNewValue('');
    await handleList();
  };

  const handleUnset = async (key: string) => {
    if (!project) return;
    await ipc.configUnset(project.path, key);
    await handleList();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Configuration</h3>
        <button type="button" onClick={handleList} className="px-3 py-1.5 border rounded text-sm hover:bg-muted">Refresh</button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {sections.map((s) => (
          <button key={s} type="button" onClick={() => setActiveSection(s)} className={`px-2 py-1 rounded text-xs whitespace-nowrap ${activeSection === s ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 border rounded p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Set a config value</p>
        <div className="flex gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="section.key or section.sub.key" className="flex-1 border rounded px-3 py-1.5 text-sm bg-background" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="value" className="flex-1 border rounded px-3 py-1.5 text-sm bg-background" />
          <button type="button" onClick={handleSet} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm">Set</button>
        </div>
      </div>

      <div className="space-y-1">
        {filtered.map((entry, i) => (
          <div key={i} className="flex items-center justify-between border rounded px-3 py-2 text-xs">
            <div className="font-mono">
              <span className="text-foreground">{entry.section}{entry.subsection ? `.${entry.subsection}` : ''}.{entry.key}</span>
              <span className="text-muted-foreground">={entry.value}</span>
            </div>
            <button type="button" onClick={() => handleUnset(`${entry.section}${entry.subsection ? `.${entry.subsection}` : ''}.${entry.key}`)} className="text-destructive hover:underline">Unset</button>
          </div>
        ))}
      </div>
    </div>
  );
}
