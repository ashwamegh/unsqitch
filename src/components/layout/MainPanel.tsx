import { HomePage } from "../../pages/HomePage/HomePage";
import { ProjectPage } from "../../pages/ProjectPage/ProjectPage";
import { useNavigationStore } from "../../store/navigation";
import { SqitchPreflight } from "../shared/SqitchPreflight";

export function MainPanel() {
  const view = useNavigationStore((s) => s.view);

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      {/* Surfaces a missing/outdated Sqitch CLI before the first command fails. */}
      <SqitchPreflight />
      {view === "home" ? <HomePage /> : <ProjectPage />}
    </main>
  );
}
