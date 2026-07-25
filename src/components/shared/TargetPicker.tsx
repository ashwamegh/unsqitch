import { Database } from "lucide-react";
import { useProjectStore } from "../../store/project";

interface TargetPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Target input with the project's configured targets offered as choices.
 *
 * Targets are discovered from the project's sqitch config on open, so a new user
 * does not have to know what to type here.
 */
export function TargetPicker({ value, onChange, placeholder, className }: TargetPickerProps) {
  const knownTargets = useProjectStore((s) => s.knownTargets);
  const listId = "unsqitch-known-targets";

  return (
    <div className={`flex-1 ${className ?? ""}`}>
      <div className="relative">
        <Database
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          list={knownTargets.length > 0 ? listId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Target database"}
          className="w-full border border-border bg-card/65 focus:bg-background rounded-xl pl-9 pr-4 py-2.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
        />
        {knownTargets.length > 0 && (
          <datalist id={listId}>
            {knownTargets.map((t) => (
              <option key={t.name} value={t.name}>
                {t.uri && t.uri !== t.name ? t.uri : ""}
              </option>
            ))}
          </datalist>
        )}
      </div>
      {knownTargets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="text-[10px] text-muted-foreground font-semibold">From config:</span>
          {knownTargets.slice(0, 4).map((t) => (
            <button
              type="button"
              key={t.name}
              onClick={() => onChange(t.name)}
              title={t.uri}
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                value === t.name
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
