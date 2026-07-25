import { ChevronDown, ChevronRight, Database, Info, Plus } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "../../store/project";
import type { PlanFile } from "../../types/plan";
import { AddChangeForm } from "./AddChangeForm";
import { PlanEntry } from "./PlanEntry";
import { UnparseableWarning } from "./UnparseableWarning";

interface PlanTimelineProps {
  plan: PlanFile;
  showCommand: boolean;
  projectPath: string;
}

export function PlanTimeline({ plan, showCommand, projectPath }: PlanTimelineProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { status, lastTarget, projects, currentProjectId } = useProjectStore();

  const project = projects.find((p) => p.id === currentProjectId);
  const deployedNames = new Set((status?.deployed ?? []).map((c) => c.name));
  const haveStatus = (status?.deployed?.length ?? 0) > 0 || (status?.pending?.length ?? 0) > 0;
  const deployedCount = plan.changes.filter((c) => deployedNames.has(c.name)).length;

  const pragmaEntries = (plan.entries ?? []).filter((e) => e.type === "pragma");
  const timelineEntries = (plan.entries ?? []).filter((e) => e.type !== "pragma");

  let changeNumber = 0;

  return (
    <div>
      <UnparseableWarning lines={plan.unparseableLines} />

      {/* Orientation header — answers "what is this and what's live?" */}
      <div className="glass-panel rounded-2xl border border-border/80 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight text-foreground/90">
              {plan.pragmas.project ?? project?.name ?? "Project"}
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {plan.changes.length} change{plan.changes.length === 1 ? "" : "s"} in the plan
              {plan.tags.length > 0 &&
                ` · ${plan.tags.length} tag${plan.tags.length === 1 ? "" : "s"}`}
              {haveStatus
                ? ` · ${deployedCount} of ${plan.changes.length} deployed`
                : " · deployment state unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {project?.engine && project.engine !== "unknown" && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                <Database size={11} />
                {project.engine}
              </span>
            )}
            {lastTarget && (
              <span
                className="text-[10px] font-mono bg-muted/50 border border-border/50 text-muted-foreground px-2.5 py-1 rounded-full truncate max-w-[220px]"
                title={lastTarget}
              >
                {lastTarget}
              </span>
            )}
          </div>
        </div>

        {!haveStatus && (
          <p className="text-[11px] text-muted-foreground/80 mt-3 leading-relaxed">
            Run <span className="font-semibold text-foreground/80">Status</span> to see which of
            these changes are already deployed.
          </p>
        )}

        {/* Pragmas are file metadata — available, but not the first thing you read. */}
        {pragmaEntries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {detailsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Info size={11} />
              Plan file details
            </button>
            {detailsOpen && (
              <div className="mt-2 space-y-0.5">
                {pragmaEntries.map((entry) => (
                  <PlanEntry
                    key={entry.index}
                    entry={entry}
                    showCommand={showCommand}
                    projectPath={projectPath}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        {timelineEntries.map((entry) => {
          const n = entry.type === "change" ? ++changeNumber : undefined;
          return (
            <PlanEntry
              key={entry.index}
              entry={entry}
              showCommand={showCommand}
              projectPath={projectPath}
              changeNumber={n}
              deployState={
                entry.type === "change"
                  ? !haveStatus
                    ? "unknown"
                    : deployedNames.has(entry.change?.name ?? "")
                      ? "deployed"
                      : "pending"
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Secondary entry point; the sidebar button is the primary action. */}
      <div className="ml-4 mt-2 pl-6 border-l-2 border-dashed border-border/50 py-3">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <Plus size={13} />
          Add a change
        </button>
      </div>

      <AddChangeForm open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
