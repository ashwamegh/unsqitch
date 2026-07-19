import { create } from "zustand";
import { useProjectStore } from "./project";

export type View = "home" | "project";
export type Section =
  | "plan"
  | "deploy"
  | "revert"
  | "status"
  | "verify"
  | "log"
  | "engine"
  | "target"
  | "config";

interface NavigationState {
  view: View;
  projectId: string | null;
  section: Section | null;
  showCommands: boolean;
  commandTooltipDismissed: boolean;
  sidebarCollapsed: boolean;
  // Sections that received new data from the file watcher (show a pulse dot).
  pulsedSections: Section[];
}

interface NavigationActions {
  goHome: () => void;
  openProject: (projectId: string) => void;
  setSection: (section: Section) => void;
  toggleShowCommands: () => void;
  setShowCommands: (value: boolean) => void;
  dismissCommandTooltip: () => void;
  setCommandTooltipDismissed: (value: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  pulseSection: (section: Section) => void;
  clearPulse: (section: Section) => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => ({
  view: "home",
  projectId: null,
  section: null,
  showCommands: false,
  commandTooltipDismissed: false,
  sidebarCollapsed: true,
  pulsedSections: [],

  goHome: () => {
    // Keep the project store's active project in sync with navigation.
    useProjectStore.getState().setCurrentProject(null);
    set({ view: "home", projectId: null, section: null, sidebarCollapsed: true });
  },

  openProject: (projectId) => {
    useProjectStore.getState().setCurrentProject(projectId);
    set({ view: "project", projectId, section: "plan", sidebarCollapsed: false });
  },

  // Opening a section clears its pending "new data" pulse.
  setSection: (section) =>
    set((state) => ({
      section,
      pulsedSections: state.pulsedSections.filter((s) => s !== section),
    })),

  pulseSection: (section) =>
    set((state) =>
      state.pulsedSections.includes(section)
        ? {}
        : { pulsedSections: [...state.pulsedSections, section] },
    ),

  clearPulse: (section) =>
    set((state) => ({ pulsedSections: state.pulsedSections.filter((s) => s !== section) })),

  toggleShowCommands: () => set((state) => ({ showCommands: !state.showCommands })),

  setShowCommands: (showCommands) => set({ showCommands }),

  dismissCommandTooltip: () => set({ commandTooltipDismissed: true }),

  setCommandTooltipDismissed: (commandTooltipDismissed) => set({ commandTooltipDismissed }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
