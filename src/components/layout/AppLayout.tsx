import { ToastContainer } from "../shared/Toast";
import { MainPanel } from "./MainPanel";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <MainPanel />
      <ToastContainer />
    </div>
  );
}
