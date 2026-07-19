import { Database, FolderOpen, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectCard } from "../../components/shared/ProjectCard";
import { SettingsDialog } from "../../components/shared/SettingsDialog";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import { InitProjectDialog } from "./InitProjectDialog";

export function HomePage() {
  const { projects, setProjects } = useProjectStore();
  const openProject = useNavigationStore((s) => s.openProject);
  const ipc = useIpc();
  const [initOpen, setInitOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    ipc.projectList().then((result) => {
      setProjects(result.projects);
    });
  }, [setProjects, ipc]);

  const handleOpenProject = async () => {
    const result = await ipc.dialogOpenDirectory();
    if (result.canceled || !result.path) return;
    try {
      const response = await ipc.projectOpen(result.path);
      if (response.error) {
        alert(response.error);
        return;
      }
      openProject(response.project.id);
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const handleRemoveProject = async (id: string) => {
    await ipc.projectRemove(id);
    const result = await ipc.projectList();
    setProjects(result.projects);
  };
  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50 p-6 relative">
        <button
          onClick={() => setSettingsOpen(true)}
          className="absolute top-6 right-6 p-2.5 border border-border bg-card hover:bg-accent text-foreground rounded-xl transition-all cursor-pointer active:scale-[0.98]"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <div className="glass-panel max-w-md w-full rounded-2xl p-8 text-center shadow-xl border border-border/80 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>

          <div className="inline-flex p-4 bg-primary/10 rounded-2xl text-primary mb-6 shadow-inner">
            <Database size={36} className="stroke-[1.8]" />
          </div>

          <h2 className="text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-white to-foreground/70 bg-clip-text text-transparent">
            Welcome to UnSqitch
          </h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-[280px] mx-auto font-medium">
            Open a directory containing a Sqitch project to get started.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleOpenProject}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-250 cursor-pointer active:scale-[0.98]"
            >
              <FolderOpen size={16} />
              Open a Project
            </button>
            <button
              onClick={() => setInitOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-border bg-card/40 hover:bg-accent/50 text-foreground font-medium rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <Plus size={16} />
              Create New Project
            </button>
          </div>
        </div>
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto relative">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recent Projects</h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Select a database project to manage status, plans and schema migrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center w-9 h-9 border border-border bg-card hover:bg-accent text-foreground rounded-xl transition-all cursor-pointer active:scale-[0.98]"
            title="Settings"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={() => setInitOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border bg-card hover:bg-accent text-foreground font-medium rounded-xl text-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            <Plus size={15} />
            New Project
          </button>
          <button
            onClick={handleOpenProject}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground font-semibold rounded-xl text-sm shadow-md shadow-primary/10 transition-all cursor-pointer active:scale-[0.98]"
          >
            <FolderOpen size={15} />
            Open Project
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            name={p.name}
            engine={p.engine}
            changeCount={p.changeCount}
            lastDeployment={p.lastDeployment}
            onClick={() => openProject(p.id)}
            onRemove={() => handleRemoveProject(p.id)}
          />
        ))}
      </div>
      <InitProjectDialog open={initOpen} onClose={() => setInitOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
