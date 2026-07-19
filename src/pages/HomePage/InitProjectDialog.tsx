import { useState } from "react";
import { useIpc } from "../../hooks/useIpc";
import {
  buildUri,
  ENGINE_OPTIONS,
  type EngineType,
  sqitchEngine,
  type UriFields,
} from "../../lib/uri-builder";
import { useNavigationStore } from "../../store/navigation";

function basename(p: string): string {
  return (
    p
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() ?? ""
  );
}

export function InitProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ipc = useIpc();
  const openProject = useNavigationStore((s) => s.openProject);
  const showCommands = useNavigationStore((s) => s.showCommands);
  const [directory, setDirectory] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [engine, setEngine] = useState<EngineType>("pg");
  const [fields, setFields] = useState<UriFields>({});
  const [topDir, setTopDir] = useState(".");
  const [planFile, setPlanFile] = useState("sqitch.plan");
  const [loading, setLoading] = useState(false);

  // Project name defaults to the directory name until the user edits it.
  const effectiveName = nameEdited ? name : basename(directory);
  const uri = buildUri(engine, fields);
  const updateField = (key: keyof UriFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const pickDirectory = async () => {
    const r = await ipc.dialogOpenDirectory();
    if (!r.canceled && r.path) setDirectory(r.path);
  };

  const pickSqliteFile = async () => {
    const r = await ipc.dialogOpenFile();
    if (!r.canceled && r.path) updateField("path", r.path);
  };

  const handleInit = async () => {
    if (!directory || !effectiveName) return;
    setLoading(true);
    try {
      await ipc.sqitchInit(directory, effectiveName, sqitchEngine(engine), uri, topDir, planFile);
      const response = await ipc.projectOpen(directory);
      if (response.error) {
        console.error("Open after init failed:", response.error);
        return;
      }
      openProject(response.project.id);
      onClose();
    } catch (err) {
      console.error("Init failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-lg p-6 w-[520px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Project Directory</label>
            <div className="flex gap-2">
              <input
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/path/to/new/project"
                className="flex-1 border rounded px-3 py-1.5 text-sm bg-background"
              />
              <button
                type="button"
                onClick={pickDirectory}
                className="px-3 py-1.5 border rounded text-sm hover:bg-accent cursor-pointer whitespace-nowrap"
              >
                Browse…
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project Name</label>
            <input
              value={effectiveName}
              onChange={(e) => {
                setNameEdited(true);
                setName(e.target.value);
              }}
              placeholder="my-app"
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            />
            {!nameEdited && directory && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Defaults to the directory name
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Engine</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as EngineType)}
              className="w-full border rounded px-3 py-1.5 text-sm bg-background"
            >
              {ENGINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* URI builder — adapts per engine (file path for SQLite) */}
          {engine === "sqlite" ? (
            <div>
              <label className="text-sm font-medium block mb-1">Database File Path</label>
              <div className="flex gap-2">
                <input
                  value={fields.path || ""}
                  onChange={(e) => updateField("path", e.target.value)}
                  placeholder="/path/to/db.sqlite"
                  className="flex-1 border rounded px-3 py-1.5 text-sm bg-background"
                />
                <button
                  type="button"
                  onClick={pickSqliteFile}
                  className="px-3 py-1.5 border rounded text-sm hover:bg-accent cursor-pointer whitespace-nowrap"
                >
                  Browse…
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Host</label>
                <input
                  value={fields.host || ""}
                  onChange={(e) => updateField("host", e.target.value)}
                  placeholder="localhost"
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Database</label>
                <input
                  value={fields.database || ""}
                  onChange={(e) => updateField("database", e.target.value)}
                  placeholder="mydb"
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">User</label>
                <input
                  value={fields.user || ""}
                  onChange={(e) => updateField("user", e.target.value)}
                  placeholder="user"
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Password</label>
                <input
                  type="password"
                  value={fields.password || ""}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="••••••••"
                  className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Connection URI</label>
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground break-all select-all">
              {uri}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Top Directory</label>
              <input
                value={topDir}
                onChange={(e) => setTopDir(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Plan File</label>
              <input
                value={planFile}
                onChange={(e) => setPlanFile(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
              />
            </div>
          </div>
          {showCommands && (
            <div className="p-2 bg-muted rounded text-xs font-mono text-muted-foreground break-all">
              sqitch init {effectiveName || "<name>"} --engine {sqitchEngine(engine)} --uri {uri}{" "}
              --top-dir {topDir}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInit}
            disabled={loading || !directory || !effectiveName}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
          >
            {loading ? "Initializing..." : "Initialize"}
          </button>
        </div>
      </div>
    </div>
  );
}
