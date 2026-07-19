import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  HelpCircle,
  History,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Settings,
  Sliders,
  Target,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { useIpc } from "../../hooks/useIpc";
import { type Section, useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import { AddChangeForm } from "../plan/AddChangeForm";
import { SettingsDialog } from "../shared/SettingsDialog";

interface SectionConfig {
  id: Section;
  label: string;
  icon: any;
}

const devSections: SectionConfig[] = [
  { id: "plan", label: "Plan", icon: FileText },
  { id: "deploy", label: "Deploy", icon: Layers },
  { id: "revert", label: "Revert", icon: RotateCcw },
  { id: "status", label: "Status", icon: Activity },
  { id: "verify", label: "Verify", icon: CheckCircle2 },
  { id: "log", label: "Log", icon: History },
];

const setupSections: SectionConfig[] = [
  { id: "engine", label: "Engine", icon: Database },
  { id: "target", label: "Target", icon: Target },
  { id: "config", label: "Config", icon: Sliders },
];

export function Sidebar() {
  const {
    view,
    section,
    setSection,
    goHome,
    showCommands,
    toggleShowCommands,
    commandTooltipDismissed,
    dismissCommandTooltip,
    setCommandTooltipDismissed,
    sidebarCollapsed,
    toggleSidebar,
    pulsedSections,
  } = useNavigationStore();

  const currentProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId),
  );
  const ipc = useIpc();
  const [addChangeOpen, setAddChangeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Turning Show-Commands on for the first time permanently dismisses the tooltip
  // (persisted), so it never reappears after a restart (spec).
  const handleToggleShowCommands = () => {
    const turningOn = !showCommands;
    toggleShowCommands();
    if (turningOn && !commandTooltipDismissed) {
      setCommandTooltipDismissed(true);
      ipc.settingsSet("commandTooltipDismissed", "true").catch(() => {});
    }
  };

  const handleDismissTooltip = () => {
    dismissCommandTooltip();
    ipc.settingsSet("commandTooltipDismissed", "true").catch(() => {});
  };

  // --- Render for Home Page (Project Selector) ---
  if (view === "home") {
    return (
      <aside
        className={`border-r border-border bg-card/60 flex flex-col glass-panel transition-all duration-300 ${
          sidebarCollapsed ? "w-16 px-2 py-4 items-center" : "w-64 p-6"
        }`}
      >
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center gap-3 mb-6 w-full">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Layers className="stroke-[2.2]" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground/90">UnSqitch</h1>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  migration manager
                </p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center text-center p-4 rounded-xl border border-dashed border-border bg-muted/10 w-full mb-6">
              <HelpCircle className="mx-auto text-muted-foreground/60 mb-2" size={24} />
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Select or open a project to display migration operations
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-6 w-full">
            <div className="p-2 bg-primary/10 rounded-xl text-primary" title="UnSqitch">
              <Layers className="stroke-[2.2]" size={22} />
            </div>
          </div>
        )}

        <div className={`flex flex-col gap-2.5 w-full ${sidebarCollapsed ? "items-center" : ""}`}>
          {/* Toggle Sidebar */}
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`flex items-center transition-all cursor-pointer ${
              sidebarCollapsed
                ? "w-10 h-10 justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30"
                : "w-full gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-accent/30"
            }`}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!sidebarCollapsed && "Collapse Sidebar"}
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            title={sidebarCollapsed ? "Settings" : undefined}
            className={`flex items-center transition-all cursor-pointer ${
              sidebarCollapsed
                ? "w-10 h-10 justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30"
                : "w-full gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-accent/30"
            }`}
          >
            <Settings size={14} />
            {!sidebarCollapsed && "Settings"}
          </button>
        </div>

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </aside>
    );
  }

  // --- Render for Project Page ---
  return (
    <aside
      className={`border-r border-border bg-card/60 flex flex-col glass-panel transition-all duration-300 ${
        sidebarCollapsed ? "w-16 px-2 py-4" : "w-64"
      }`}
    >
      {/* Brand Header */}
      {!sidebarCollapsed ? (
        <div className="p-5 border-b border-border flex flex-col gap-4">
          <button
            onClick={goHome}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer w-max"
          >
            <ArrowLeft size={14} className="stroke-[2.5]" />
            Back to Projects
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Layers className="stroke-[2.2]" size={16} />
            </div>
            <h2
              className="text-sm font-bold text-foreground/90 truncate flex-1"
              title={currentProject?.name}
            >
              {currentProject?.name ?? "Project"}
            </h2>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 items-center pb-4 border-b border-border w-full">
          <button
            onClick={goHome}
            title="Back to Projects"
            className="p-2 hover:bg-accent/40 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <ArrowLeft size={16} className="stroke-[2.5]" />
          </button>
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary" title={currentProject?.name}>
            <Layers className="stroke-[2.2]" size={16} />
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <div
        className={`flex-1 flex flex-col ${sidebarCollapsed ? "gap-4 py-4 w-full" : "overflow-y-auto p-3 gap-5"}`}
      >
        {/* Development Section */}
        <div className="w-full">
          {!sidebarCollapsed && (
            <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-widest px-3 mb-2">
              Development
            </p>
          )}
          <div className={`flex flex-col gap-0.5 ${sidebarCollapsed ? "items-center" : ""}`}>
            {devSections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  title={sidebarCollapsed ? s.label : undefined}
                  className={`relative flex items-center transition-all cursor-pointer ${
                    sidebarCollapsed
                      ? `w-10 h-10 justify-center rounded-xl ${
                          section === s.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        }`
                      : `w-full gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                          section === s.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        }`
                  }`}
                >
                  <Icon size={16} className={section === s.id ? "stroke-[2.2]" : "stroke-[1.8]"} />
                  {!sidebarCollapsed && s.label}
                  {pulsedSections.includes(s.id) && section !== s.id && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Setup Section */}
        <div className="w-full">
          {!sidebarCollapsed && (
            <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-widest px-3 mb-2">
              Setup
            </p>
          )}
          <div className={`flex flex-col gap-0.5 ${sidebarCollapsed ? "items-center" : ""}`}>
            {setupSections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  title={sidebarCollapsed ? s.label : undefined}
                  className={`relative flex items-center transition-all cursor-pointer ${
                    sidebarCollapsed
                      ? `w-10 h-10 justify-center rounded-xl ${
                          section === s.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        }`
                      : `w-full gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                          section === s.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        }`
                  }`}
                >
                  <Icon size={16} className={section === s.id ? "stroke-[2.2]" : "stroke-[1.8]"} />
                  {!sidebarCollapsed && s.label}
                  {pulsedSections.includes(s.id) && section !== s.id && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Change Button */}
        <div className={sidebarCollapsed ? "flex justify-center w-full" : "px-1"}>
          <button
            onClick={() => setAddChangeOpen(true)}
            title={sidebarCollapsed ? "Add Change" : undefined}
            className={`flex items-center justify-center transition-all cursor-pointer active:scale-[0.98] ${
              sidebarCollapsed
                ? "w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground shadow-md shadow-primary/10"
                : "w-full gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-primary-foreground shadow-md shadow-primary/10 mt-2"
            }`}
          >
            <Plus size={15} />
            {!sidebarCollapsed && "Add Change"}
          </button>
        </div>

        <AddChangeForm open={addChangeOpen} onClose={() => setAddChangeOpen(false)} />
      </div>

      {/* Footer Settings & Tooltip */}
      <div
        className={`border-t border-border flex flex-col gap-2.5 ${
          sidebarCollapsed ? "w-full items-center py-4 px-1" : "p-4"
        }`}
      >
        {/* CLI Inspector Toggle */}
        <div className={sidebarCollapsed ? "w-full flex justify-center" : "relative"}>
          <button
            onClick={handleToggleShowCommands}
            title={sidebarCollapsed ? "Show Commands" : undefined}
            className={`flex items-center justify-center transition-all cursor-pointer ${
              sidebarCollapsed
                ? `w-10 h-10 rounded-xl border ${
                    showCommands
                      ? "bg-accent/80 text-foreground border-border/80"
                      : "text-muted-foreground border-border/40 hover:bg-accent/30 hover:border-border/80"
                  }`
                : `w-full gap-2 text-[11px] font-bold px-3 py-2 rounded-xl border ${
                    showCommands
                      ? "bg-accent/80 text-foreground border-border/80"
                      : "text-muted-foreground border-border/40 hover:bg-accent/30 hover:border-border/80"
                  }`
            }`}
          >
            <Terminal size={13} />
            {!sidebarCollapsed && "Show Commands"}
          </button>
          {!sidebarCollapsed && !commandTooltipDismissed && !showCommands && (
            <div className="absolute bottom-full left-0 right-0 mb-3 bg-popover text-popover-foreground border border-border/85 rounded-xl p-3 text-xs shadow-xl glass-panel flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Info size={13} className="text-primary" />
                  CLI Inspector
                </span>
                <button
                  onClick={handleDismissTooltip}
                  className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-bold p-0.5 rounded-md hover:bg-accent/40"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground font-medium">
                Toggle this to display the exact Sqitch CLI commands being run in the background.
              </p>
            </div>
          )}
        </div>

        {/* Toggle Collapse/Expand Button */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className={`flex items-center transition-all cursor-pointer ${
            sidebarCollapsed
              ? "w-10 h-10 justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30"
              : "w-full gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-accent/30"
          }`}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!sidebarCollapsed && "Collapse Sidebar"}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          title={sidebarCollapsed ? "Settings" : undefined}
          className={`flex items-center transition-all cursor-pointer ${
            sidebarCollapsed
              ? "w-10 h-10 justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/30"
              : "w-full gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-accent/30"
          }`}
        >
          <Settings size={14} />
          {!sidebarCollapsed && "Settings"}
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
