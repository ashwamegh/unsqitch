import { useState } from 'react';
import { useIpc } from '../../hooks/useIpc';
import { useNavigationStore } from '../../store/navigation';

type EngineType = 'pg' | 'mysql' | 'sqlite' | 'cockroach' | 'yugabyte';

export function InitProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const openProject = useNavigationStore((s) => s.openProject);
  const [directory, setDirectory] = useState('');
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<EngineType>('pg');
  const [uri, setUri] = useState('');
  const [topDir, setTopDir] = useState('.');
  const [planFile, setPlanFile] = useState('sqitch.plan');
  const [loading, setLoading] = useState(false);
  const showCommands = useNavigationStore((s) => s.showCommands);

  const handleInit = async () => {
    if (!directory || !name) return;
    setLoading(true);
    try {
      await ipc.sqitchInit(directory, name, engine, uri, topDir, planFile);
      const response = await ipc.projectOpen(directory);
      if (response.error) {
        console.error('Open after init failed:', response.error);
        return;
      }
      openProject(response.project.id);
      onClose();
    } catch (err) {
      console.error('Init failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Project Directory</label>
            <input value={directory} onChange={(e) => setDirectory(e.target.value)} placeholder="/path/to/new/project" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Engine</label>
            <select value={engine} onChange={(e) => setEngine(e.target.value as EngineType)} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="pg">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="cockroach">CockroachDB</option>
              <option value="yugabyte">YugabyteDB</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">URI</label>
            <input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="db:pg://localhost/mydb" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium block mb-1">Top Directory</label><input value={topDir} onChange={(e) => setTopDir(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
            <div><label className="text-sm font-medium block mb-1">Plan File</label><input value={planFile} onChange={(e) => setPlanFile(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
              sqitch init {name} --engine {engine} --uri {uri || '...'} --top-dir {topDir}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="button" onClick={handleInit} disabled={loading || !directory || !name} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50">
            {loading ? 'Initializing...' : 'Initialize'}
          </button>
        </div>
      </div>
    </div>
  );
}
