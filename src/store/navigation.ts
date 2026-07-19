import { create } from "zustand";

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
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => ({
  view: "home",
  projectId: null,
  section: null,
  showCommands: false,
  commandTooltipDismissed: false,
  sidebarCollapsed: true,

  goHome: () => set({ view: "home", projectId: null, section: null, sidebarCollapsed: true }),

  openProject: (projectId) =>
    set({ view: "project", projectId, section: "plan", sidebarCollapsed: false }),

  setSection: (section) => set({ section }),

  toggleShowCommands: () => set((state) => ({ showCommands: !state.showCommands })),

  setShowCommands: (showCommands) => set({ showCommands }),

  dismissCommandTooltip: () => set({ commandTooltipDismissed: true }),

  setCommandTooltipDismissed: (commandTooltipDismissed) => set({ commandTooltipDismissed }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
