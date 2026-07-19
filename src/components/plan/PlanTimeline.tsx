import { Plus } from "lucide-react";
import { useState } from "react";
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
  let changeNumber = 0;

  return (
    <div>
      <UnparseableWarning lines={plan.unparseableLines} />
      <div className="space-y-0.5">
        {(plan.entries ?? []).map((entry) => {
          const n = entry.type === "change" ? ++changeNumber : undefined;
          return (
            <PlanEntry
              key={entry.index}
              entry={entry}
              showCommand={showCommand}
              projectPath={projectPath}
              changeNumber={n}
            />
          );
        })}
      </div>

      {/* Add Change at the bottom of the timeline (spec: Plan View) */}
      <div className="ml-4 mt-2 pl-6 border-l-2 border-dashed border-border/50 py-3">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all cursor-pointer active:scale-[0.98]"
        >
          <Plus size={14} />
          Add Change
        </button>
      </div>

      <AddChangeForm open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
