import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/project';
import { useNavigationStore } from '../../store/navigation';
import { useIpc } from '../../hooks/useIpc';
import { ProjectCard } from '../../components/shared/ProjectCard';
import { InitProjectDialog } from './InitProjectDialog';

export function HomePage() {
  const { projects, setProjects } = useProjectStore();
  const openProject = useNavigationStore((s) => s.openProject);
  const ipc = useIpc();
  const [initOpen, setInitOpen] = useState(false);

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
      console.error('Failed to open project:', err);
    }
  };

  const handleRemoveProject = async (id: string) => {
    await ipc.projectRemove(id);
    const result = await ipc.projectList();
    setProjects(result.projects);
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Welcome to UnSqitch</h2>
          <p className="text-muted-foreground mb-4">
            Open a directory containing a Sqitch project to get started.
          </p>
          <button
            onClick={handleOpenProject}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Open a Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          onClick={handleOpenProject}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
        >
          Open Project
        </button>
        <button
          onClick={() => setInitOpen(true)}
          className="px-3 py-1.5 border border-primary text-primary rounded text-sm hover:bg-primary/10"
        >
          New Project
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  );
}
