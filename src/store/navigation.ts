import { create } from 'zustand';

export type View = 'home' | 'project';
export type Section =
  | 'plan'
  | 'deploy'
  | 'revert'
  | 'status'
  | 'verify'
  | 'log'
  | 'engine'
  | 'target'
  | 'config';

interface NavigationState {
  view: View;
  projectId: string | null;
  section: Section | null;
  showCommands: boolean;
  commandTooltipDismissed: boolean;
}

interface NavigationActions {
  goHome: () => void;
  openProject: (projectId: string) => void;
  setSection: (section: Section) => void;
  toggleShowCommands: () => void;
  dismissCommandTooltip: () => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => ({
  view: 'home',
  projectId: null,
  section: null,
  showCommands: false,
  commandTooltipDismissed: false,

  goHome: () => set({ view: 'home', projectId: null, section: null }),

  openProject: (projectId) => set({ view: 'project', projectId, section: 'plan' }),

  setSection: (section) => set({ section }),

  toggleShowCommands: () => set((state) => ({ showCommands: !state.showCommands })),

  dismissCommandTooltip: () => set({ commandTooltipDismissed: true }),
}));
