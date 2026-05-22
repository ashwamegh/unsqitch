import { create } from 'zustand';
import type { DeploymentStatus, LogEntry } from '../types/deployment';
import type { PlanFile } from '../types/plan';
import type { ConfigEntry } from '../types/config';
import type { SqitchEvent } from '../types/sqitch-event';
import type { AppError } from '../types/error';

interface ProjectState {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    engine: string;
    changeCount: number;
    lastDeployment?: string;
    lastOpened: string;
  }>;
  currentProjectId: string | null;
  plan: PlanFile | null;
  status: DeploymentStatus | null;
  log: LogEntry[];
  config: ConfigEntry[];
  events: SqitchEvent[];
  error: AppError | null;
  isRunning: boolean;
  statusStale: boolean;
  lastStatusRefresh: number | null;
}

interface ProjectActions {
  setProjects: (projects: ProjectState['projects']) => void;
  setCurrentProject: (id: string | null) => void;
  setPlan: (plan: PlanFile | null) => void;
  setStatus: (status: DeploymentStatus | null) => void;
  setLog: (log: LogEntry[]) => void;
  setConfig: (config: ConfigEntry[]) => void;
  addEvent: (event: SqitchEvent) => void;
  clearEvents: () => void;
  setError: (error: AppError | null) => void;
  setRunning: (running: boolean) => void;
  setStatusStale: (stale: boolean) => void;
  markStatusStale: () => void;
  setLastStatusRefresh: (timestamp: number) => void;
  reset: () => void;
}

const initialState: ProjectState = {
  projects: [],
  currentProjectId: null,
  plan: null,
  status: null,
  log: [],
  config: [],
  events: [],
  error: null,
  isRunning: false,
  statusStale: false,
  lastStatusRefresh: null,
};

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  ...initialState,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (id) => set({ currentProjectId: id }),
  setPlan: (plan) => set({ plan }),
  setStatus: (status) => set({ status, statusStale: false }),
  setLog: (log) => set({ log }),
  setConfig: (config) => set({ config }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  clearEvents: () => set({ events: [] }),
  setError: (error) => set({ error }),
  setRunning: (running) => set({ isRunning: running }),
  setStatusStale: (stale) => set({ statusStale: stale }),
  markStatusStale: () => set({ statusStale: true }),
  setLastStatusRefresh: (timestamp) => set({ lastStatusRefresh: timestamp, statusStale: false }),
  reset: () => set(initialState),
}));
