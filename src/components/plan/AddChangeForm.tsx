import { useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';

export function AddChangeForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentProjectId, projects, setPlan } = useProjectStore();
  const showCommands = useNavigationStore((s) => s.showCommands);
  const ipc = useIpc();
  const project = projects.find((p) => p.id === currentProjectId);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [requiresInput, setRequiresInput] = useState('');
  const [conflictsInput, setConflictsInput] = useState('');
  const [loading, setLoading] = useState(false);

  const requires = requiresInput.split(/[\s,]+/).filter(Boolean);
  const conflicts = conflictsInput.split(/[\s,]+/).filter(Boolean);

  const handleAdd = async () => {
    if (!project || !name) return;
    setLoading(true);
    try {
      await ipc.sqitchAdd(project.path, name, note, requires, conflicts);
      const planResult = await ipc.sqitchPlan(project.path);
      setPlan(planResult as any);
      setName(''); setNote(''); setRequiresInput(''); setConflictsInput('');
      onClose();
    } catch (err) {
      console.error('Add change failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border rounded-lg p-6 w-[450px]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add Change</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Change Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., users" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Add users table" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Requires (space-separated)</label>
            <input value={requiresInput} onChange={(e) => setRequiresInput(e.target.value)} placeholder="e.g., appschema roles" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Conflicts (space-separated)</label>
            <input value={conflictsInput} onChange={(e) => setConflictsInput(e.target.value)} placeholder="e.g., legacy_auth" className="w-full border rounded px-3 py-1.5 text-sm bg-background" />
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
              sqitch add {name} -n "{note}"
              {requires.map(r => ` -r ${r}`).join('')}
              {conflicts.map(c => ` -x ${c}`).join('')}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
          <button onClick={handleAdd} disabled={loading || !name} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Change'}
          </button>
        </div>
      </div>
    </div>
  );
}
