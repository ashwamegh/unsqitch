import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';
import { ToastContainer } from '../shared/Toast';

export function AppLayout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <MainPanel />
      <ToastContainer />
    </div>
  );
}
