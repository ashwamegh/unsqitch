import { useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';

export function EngineView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [engines, setEngines] = useState<Array<{ name: string; target: string }>>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [uri, setUri] = useState('');
  const [client, setClient] = useState('');

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.engineList(project.path);
    setEngines(result as any);
  };

  const handleAdd = async () => {
    if (!project || !name || !uri) return;
    await ipc.engineAdd(project.path, name, uri, client || undefined);
    setAdding(false);
    setName(''); setUri(''); setClient('');
    await handleList();
  };

  const handleRemove = async (engineName: string) => {
    if (!project) return;
    await ipc.engineRemove(project.path, engineName);
    await handleList();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Engines</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleList} className="px-3 py-1.5 border rounded text-sm hover:bg-muted">Refresh</button>
          <button type="button" onClick={() => setAdding(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90">Add Engine</button>
        </div>
      </div>

      {adding && (
        <div className="border rounded p-4 mb-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Engine Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., pg" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">URI</label>
            <input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="e.g., db:pg://localhost/mydb" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Client Path (optional)</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g., /usr/bin/psql" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground flex items-center justify-between">
              <span>sqitch engine add {name} --target {uri}{client ? ` --client ${client}` : ''}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(`sqitch engine add ${name} --target ${uri}${client ? ` --client ${client}` : ''}`)} className="ml-2 text-xs hover:text-foreground">Copy</button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {engines.map((e) => (
          <div key={e.name} className="border rounded p-3 flex items-center justify-between">
            <div>
              <span className="font-mono text-sm font-medium">{e.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{e.target}</span>
            </div>
            <button type="button" onClick={() => handleRemove(e.name)} className="text-xs text-destructive hover:underline">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
