import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  initTheme: (ipc: any) => Promise<void>;
  setTheme: (ipc: any, theme: ThemeMode) => Promise<void>;
}

let listenerAttached = false;

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "system",

  initTheme: async (ipc) => {
    try {
      const res = await ipc.settingsGet("theme");
      const savedTheme = (res?.value as ThemeMode) || "system";
      set({ theme: savedTheme });
      applyTheme(savedTheme);
    } catch (e) {
      console.error("Failed to load theme:", e);
    }
  },

  setTheme: async (ipc, theme) => {
    try {
      await ipc.settingsSet("theme", theme);
      set({ theme });
      applyTheme(theme);
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  },
}));

function applyTheme(theme: ThemeMode) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleSystemChange = () => {
    if (useThemeStore.getState().theme !== "system") return;
    root.classList.remove("light", "dark");
    root.classList.add(mediaQuery.matches ? "dark" : "light");
  };

  if (!listenerAttached) {
    mediaQuery.addEventListener("change", handleSystemChange);
    listenerAttached = true;
  }

  if (theme === "system") {
    root.classList.add(mediaQuery.matches ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}
