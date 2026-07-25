import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useIpc } from "./hooks/useIpc";
import { useNavigationStore } from "./store/navigation";
import { useThemeStore } from "./store/theme";

export default function App() {
  const ipc = useIpc();
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme(ipc);
    // Apply persisted preferences: Show-Commands default + one-time tooltip state.
    ipc
      .settingsGet("showCommandsDefault")
      .then((r) => {
        if (r.value === "true") useNavigationStore.getState().setShowCommands(true);
      })
      .catch(() => {});
    ipc
      .settingsGet("commandTooltipDismissed")
      .then((r) => {
        if (r.value === "true") useNavigationStore.getState().setCommandTooltipDismissed(true);
      })
      .catch(() => {});
  }, [initTheme, ipc]);

  return <AppLayout />;
}
