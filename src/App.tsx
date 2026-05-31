import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useIpc } from "./hooks/useIpc";
import { useThemeStore } from "./store/theme";

export default function App() {
  const ipc = useIpc();
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme(ipc);
  }, [initTheme, ipc]);

  return <AppLayout />;
}
