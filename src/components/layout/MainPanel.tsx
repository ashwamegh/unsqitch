import { useNavigationStore } from '../../store/navigation';
import { HomePage } from '../../pages/HomePage/HomePage';
import { ProjectPage } from '../../pages/ProjectPage/ProjectPage';

export function MainPanel() {
  const view = useNavigationStore((s) => s.view);

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      {view === 'home' ? <HomePage /> : <ProjectPage />}
    </main>
  );
}
