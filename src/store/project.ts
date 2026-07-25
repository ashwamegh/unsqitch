import { create } from "zustand";
import { coalesceEvents, parseSqitchOutput } from "../lib/sqitch-parser";
import type { ConfigEntry } from "../types/config";
import type { DeploymentStatus, LogEntry } from "../types/deployment";
import type { AppError } from "../types/error";
import type { PlanFile } from "../types/plan";
import type { SqitchEvent } from "../types/sqitch-event";

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
  // Change names expected in the active run, so the progress UI can show
  // not-yet-started changes in a "queued" state.
  expectedChanges: string[];
  verifyResults: Array<{ change: string; status: string }>;
  error: AppError | null;
  isRunning: boolean;
  statusStale: boolean;
  lastStatusRefresh: number | null;
  // Last target the user acted on, shared across the target-based views.
  lastTarget: string;
  // Targets discovered from the project's sqitch config (no CLI required).
  knownTargets: Array<{ name: string; uri?: string }>;
}

interface ProjectActions {
  setProjects: (projects: ProjectState["projects"]) => void;
  setCurrentProject: (id: string | null) => void;
  setPlan: (plan: PlanFile | null) => void;
  setStatus: (status: DeploymentStatus | null) => void;
  setLog: (log: LogEntry[]) => void;
  setConfig: (config: ConfigEntry[]) => void;
  addEvent: (event: SqitchEvent) => void;
  clearEvents: () => void;
  startRun: (expectedChanges?: string[]) => void;
  ingestStream: (data: string) => void;
  setVerifyResults: (results: Array<{ change: string; status: string }>) => void;
  setError: (error: AppError | null) => void;
  setRunning: (running: boolean) => void;
  setStatusStale: (stale: boolean) => void;
  markStatusStale: () => void;
  setLastStatusRefresh: (timestamp: number) => void;
  setLastTarget: (target: string) => void;
  setKnownTargets: (targets: Array<{ name: string; uri?: string }>) => void;
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
  expectedChanges: [],
  verifyResults: [],
  error: null,
  isRunning: false,
  statusStale: false,
  lastStatusRefresh: null,
  lastTarget: "",
  knownTargets: [],
};

// Accumulates raw sqitch stdout across stream chunks for the active command so
// each chunk can be re-parsed into an up-to-date coalesced event list. Timings
// track per-change wall-clock so the progress UI can show elapsed durations.
let streamBuffer = "";
let changeTimings: Record<string, { startedAt: number; endedAt?: number }> = {};

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
  startRun: (expectedChanges = []) => {
    streamBuffer = "";
    changeTimings = {};
    set({ events: [], error: null, isRunning: true, expectedChanges });
  },
  ingestStream: (data) => {
    streamBuffer += data;
    const events = coalesceEvents(parseSqitchOutput(streamBuffer).events);
    const now = Date.now();
    const timed = events.map((e) => {
      let t = changeTimings[e.change];
      if (!t) {
        t = { startedAt: now };
        changeTimings[e.change] = t;
      }
      if (e.status !== "running" && t.endedAt === undefined) t.endedAt = now;
      return { ...e, durationMs: (t.endedAt ?? now) - t.startedAt };
    });
    set({ events: timed });
  },
  setVerifyResults: (verifyResults) => set({ verifyResults }),
  setError: (error) => set({ error }),
  setRunning: (running) => set({ isRunning: running }),
  setStatusStale: (stale) => set({ statusStale: stale }),
  markStatusStale: () => set({ statusStale: true }),
  setLastStatusRefresh: (timestamp) => set({ lastStatusRefresh: timestamp, statusStale: false }),
  setLastTarget: (lastTarget) => set({ lastTarget }),
  setKnownTargets: (knownTargets) => set({ knownTargets }),
  reset: () => set(initialState),
}));
