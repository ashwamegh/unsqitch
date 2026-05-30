import { useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';

type EngineType = 'pg' | 'mysql' | 'sqlite' | 'cockroach' | 'yugabyte';

function buildUri(engine: EngineType, fields: Record<string, string>): string {
  switch (engine) {
    case 'pg': return `db:pg://${fields.user || 'user'}${fields.password ? ':' + fields.password : ''}@${fields.host || 'localhost'}:${fields.port || '5432'}/${fields.database || 'mydb'}`;
    case 'mysql': return `db:mysql://${fields.user || 'user'}${fields.password ? ':' + fields.password : ''}@${fields.host || 'localhost'}:${fields.port || '3306'}/${fields.database || 'mydb'}`;
    case 'sqlite': return `db:sqlite:${fields.path || '/path/to/db.sqlite'}`;
    case 'cockroach': return `db:pg://${fields.user || 'user'}${fields.password ? ':' + fields.password : ''}@${fields.host || 'localhost'}:${fields.port || '26257'}/${fields.database || 'mydb'}`;
    case 'yugabyte': return `db:pg://${fields.user || 'user'}${fields.password ? ':' + fields.password : ''}@${fields.host || 'localhost'}:${fields.port || '5433'}/${fields.database || 'mydb'}`;
  }
}

export function TargetView() {
  const { currentProjectId, projects } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [targets, setTargets] = useState<Array<{ name: string; uri: string }>>([]);
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [engine, setEngine] = useState<EngineType>('pg');
  const [fields, setFields] = useState<Record<string, string>>({});

  const uri = buildUri(engine, fields);

  const handleList = async () => {
    if (!project) return;
    const result = await ipc.targetList(project.path);
    setTargets(result as any);
    const labelMap: Record<string, string> = {};
    for (const t of result as Array<{ name: string }>) {
      const r = await ipc.targetGetLabel(project.id, t.name);
      if ((r as any).label) labelMap[t.name] = (r as any).label;
    }
    setTargetLabels(labelMap);
  };

  const handleToggleProduction = async (name: string) => {
    if (!project) return;
    const currentLabel = targetLabels[name];
    const newLabel = currentLabel === 'production' ? '' : 'production';
    await ipc.targetSetLabel(project.id, name, newLabel);
    await handleList();
  };

  const handleAdd = async () => {
    if (!project || !targetName) return;
    await ipc.targetAdd(project.path, targetName, uri);
    setAdding(false);
    setTargetName('');
    setFields({});
    await handleList();
  };

  const handleRemove = async (name: string) => {
    if (!project) return;
    await ipc.targetRemove(project.path, name);
    await handleList();
  };

  const updateField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Targets</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleList} className="px-3 py-1.5 border rounded text-sm hover:bg-muted">Refresh</button>
          <button type="button" onClick={() => setAdding(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90">Add Target</button>
        </div>
      </div>

      {adding && (
        <div className="border rounded p-4 mb-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Target Name</label>
            <input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g., mydb" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Engine Type</label>
            <select value={engine} onChange={(e) => setEngine(e.target.value as EngineType)} className="w-full border rounded px-3 py-1.5 text-sm bg-background">
              <option value="pg">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="cockroach">CockroachDB</option>
              <option value="yugabyte">YugabyteDB</option>
            </select>
          </div>
          {engine === 'sqlite' ? (
            <div>
              <label className="text-sm font-medium block mb-1">Database File Path</label>
              <input value={fields.path || ''} onChange={(e) => updateField('path', e.target.value)} placeholder="/path/to/db.sqlite" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium block mb-1">Host</label><input value={fields.host || ''} onChange={(e) => updateField('host', e.target.value)} placeholder="localhost" className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
                <div><label className="text-sm font-medium block mb-1">Port</label><input value={fields.port || ''} onChange={(e) => updateField('port', e.target.value)} placeholder={engine === 'mysql' ? '3306' : engine === 'cockroach' ? '26257' : engine === 'yugabyte' ? '5433' : '5432'} className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
              </div>
              <div><label className="text-sm font-medium block mb-1">Database</label><input value={fields.database || ''} onChange={(e) => updateField('database', e.target.value)} placeholder="mydb" className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium block mb-1">User</label><input value={fields.user || ''} onChange={(e) => updateField('user', e.target.value)} placeholder="user" className="w-full border rounded px-3 py-1.5 text-sm bg-background" /></div>
                <div><label className="text-sm font-medium block mb-1">Password</label><input type="password" value={fields.password || ''} onChange={(e) => updateField('password', e.target.value)} placeholder="•••••" className="w-full border rounded px-3 py-1.5 text-sm bg-background" /><span className="text-xs text-muted-foreground">Avoid embedding passwords in URIs</span></div>
              </div>
            </>
          )}
          <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">Constructed URI: {uri}</div>
          {showCommands && <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground flex items-center justify-between"><span>sqitch target add {targetName} --uri {uri}</span><button type="button" onClick={() => navigator.clipboard.writeText(`sqitch target add ${targetName} --uri ${uri}`)} className="ml-2 text-xs hover:text-foreground">Copy</button></div>}
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {targets.map((t) => (
          <div key={t.name} className="border rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.uri}</span>
              {targetLabels[t.name] === 'production' && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Production</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleToggleProduction(t.name)} className={`text-xs ${targetLabels[t.name] === 'production' ? 'text-muted-foreground hover:text-foreground' : 'text-red-600 hover:underline'}`}>
                {targetLabels[t.name] === 'production' ? 'Unmark Production' : 'Mark as Production'}
              </button>
              <button type="button" onClick={() => handleRemove(t.name)} className="text-xs text-destructive hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
