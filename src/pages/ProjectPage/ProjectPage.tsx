import { useEffect } from "react";
import { PlanTimeline } from "../../components/plan/PlanTimeline";
import { ProgressUI } from "../../components/progress/ProgressUI";
import { StaleBanner } from "../../components/shared/StaleBanner";
import { TerminalPanel } from "../../components/terminal/TerminalPanel";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { PlanFile } from "../../types/plan";
import { ConfigView } from "./ConfigView";
import { DeployView } from "./DeployView";
import { EngineView } from "./EngineView";
import { LogView } from "./LogView";
import { RevertView } from "./RevertView";
import { StatusView } from "./StatusView";
import { TargetView } from "./TargetView";
import { VerifyView } from "./VerifyView";

export function ProjectPage() {
  const section = useNavigationStore((s) => s.section);
  const showCommands = useNavigationStore((s) => s.showCommands);
  const { plan, currentProjectId, setPlan, projects, markStatusStale } = useProjectStore();
  const ipc = useIpc();

  useEffect(() => {
    if (currentProjectId && section === "plan") {
      const project = projects.find((p) => p.id === currentProjectId);
      if (project) {
        ipc
          .sqitchPlan(project.path)
          .then((result) => {
            setPlan(result as PlanFile);
          })
          .catch(console.error);
      }
    }
  }, [currentProjectId, section, projects, ipc, setPlan]);

  useEffect(() => {
    const unsubscribeStale = ipc.onStatusStale(() => {
      markStatusStale();
    });
    const unsubscribeWatch = ipc.onWatchEvent((event) => {
      const project = projects.find((p) => p.id === currentProjectId);
      if (project && event.projectPath === project.path) {
        markStatusStale();
      }
    });
    return () => {
      unsubscribeStale();
      unsubscribeWatch();
    };
  }, [ipc, markStatusStale, currentProjectId, projects]);

  const renderSection = () => {
    const project = projects.find((p) => p.id === currentProjectId);
    switch (section) {
      case "plan":
        return plan && project ? (
          <PlanTimeline plan={plan} showCommand={showCommands} projectPath={project.path} />
        ) : (
          <p className="text-muted-foreground">Loading plan...</p>
        );
      case "status":
        return <StatusView />;
      case "verify":
        return <VerifyView />;
      case "log":
        return <LogView />;
      case "deploy":
        return <DeployView />;
      case "revert":
        return <RevertView />;
      case "engine":
        return <EngineView />;
      case "target":
        return <TargetView />;
      case "config":
        return <ConfigView />;
      default:
        return <p className="text-muted-foreground">{section} view - coming soon</p>;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <StaleBanner />
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 capitalize">{section ?? "Select a section"}</h2>
        {renderSection()}
      </div>
      <ProgressUI />
      <TerminalPanel />
    </div>
  );
}
