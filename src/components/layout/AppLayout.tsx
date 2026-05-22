import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';

export function AppLayout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <MainPanel />
    </div>
  );
}
