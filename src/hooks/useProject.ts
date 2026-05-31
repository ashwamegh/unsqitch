import { useProjectStore } from "../store/project";
import { useIpc } from "./useIpc";

export function useProject() {
  const {
    currentProjectId,
    projects,
    status,
    plan,
    isRunning,
    statusStale,
    setStatus,
    setPlan,
    setRunning,
    setLastStatusRefresh,
  } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId) ?? null;
  const ipc = useIpc();

  const refreshStatus = async (target: string) => {
    if (!project || !target) return;
    const result = await ipc.sqitchStatus(project.path, target);
    setStatus(result as any);
    setLastStatusRefresh(Date.now());
  };

  const refreshPlan = async () => {
    if (!project) return;
    const result = await ipc.sqitchPlan(project.path);
    setPlan(result as any);
  };

  return {
    project,
    status,
    plan,
    isRunning,
    statusStale,
    refreshStatus,
    refreshPlan,
    setRunning,
  };
}
