import type { PlanFile } from "../../types/plan";
import { PlanEntry } from "./PlanEntry";
import { UnparseableWarning } from "./UnparseableWarning";

interface PlanTimelineProps {
  plan: PlanFile;
  showCommand: boolean;
  projectPath: string;
}

export function PlanTimeline({ plan, showCommand, projectPath }: PlanTimelineProps) {
  return (
    <div>
      <UnparseableWarning lines={plan.unparseableLines} />
      <div className="space-y-0.5">
        {plan.entries.map((entry) => (
          <PlanEntry
            key={entry.index}
            entry={entry}
            showCommand={showCommand}
            projectPath={projectPath}
          />
        ))}
      </div>
    </div>
  );
}
