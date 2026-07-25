import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CommandErrorPanel } from "../../components/progress/CommandErrorPanel";
import { CommandPreview } from "../../components/shared/CommandPreview";
import { TargetPicker } from "../../components/shared/TargetPicker";
import { showToast } from "../../components/shared/Toast";
import { useIpc } from "../../hooks/useIpc";
import { useNavigationStore } from "../../store/navigation";
import { useProjectStore } from "../../store/project";
import type { DeployedChange, DeploymentStatus, LogEntry } from "../../types/deployment";
import { type AppError, parseIpcError } from "../../types/error";
import type { PlanFile } from "../../types/plan";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function StatusView() {
  const {
    status,
    plan,
    currentProjectId,
    projects,
    verifyResults,
    setStatus,
    setPlan,
    setLastStatusRefresh,
  } = useProjectStore();
  const ipc = useIpc();
  const requestRevertTo = useNavigationStore((s) => s.requestRevertTo);
  const showCommands = useNavigationStore((s) => s.showCommands);
  const setSection = useNavigationStore((s) => s.setSection);
  const [target, setTarget] = useState(() => useProjectStore.getState().lastTarget);
  const [confirmedTarget, setConfirmedTarget] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [revertedCount, setRevertedCount] = useState(0);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<AppError | null>(null);
  const project = projects.find((p) => p.id === currentProjectId);

  const planByName = new Map((plan?.changes ?? []).map((c) => [c.name, c]));
  // sqitch status does not report dependencies, so merge them from the plan.
  const deployed = (status?.deployed ?? []).map((c) => {
    const planned = planByName.get(c.name);
    return planned ? { ...c, requires: planned.requires, conflicts: planned.conflicts } : c;
  });
  const pending = status?.pending ?? [];
  const deployedNames = new Set(deployed.map((c) => c.name));
  const verifiedCount = verifyResults.filter((r) => r.status === "ok").length;

  const totalPages = Math.max(1, Math.ceil(deployed.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const paged = deployed.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize);
  const selectedChange = deployed.find((c) => c.changeId === selectedChangeId) ?? null;

  const changesWithDeps = deployed.filter((c) => c.requires.length > 0);
  // Spec ("Error Handling" / Status view): deployed but not at head is a distinct
  // "partially deployed" state, with Deploy Remaining / Revert All offered.
  const partiallyDeployed = deployed.length > 0 && pending.length > 0;

  const handleRefresh = async () => {
    if (!project || !target) return;
    setConfirmedTarget(target);
    useProjectStore.getState().setLastTarget(target);
    setStatusError(null);
    setLoading(true);
    try {
      const result = (await ipc.sqitchStatus(project.path, target)) as DeploymentStatus;
      setStatus(result);
      setLastStatusRefresh(Date.now());
      // Reverted count comes from the deployment log, not status output.
      try {
        const log = (await ipc.sqitchLog(project.path, target)) as LogEntry[];
        setRevertedCount(log.filter((e) => e.action === "revert").length);
      } catch {
        setRevertedCount(0);
      }
      showToast("Database status refreshed!");
    } catch (err: any) {
      console.error("Status refresh failed:", err);
      // Show the classified error with recovery actions rather than a raw toast.
      setStatusError(parseIpcError(err, "Failed to inspect database status"));
      showToast("Could not read database status", "error");
    } finally {
      setLoading(false);
    }
  };

  // Load the plan so dependencies can be cross-referenced, and refresh once when
  // a target is already known. handleRefresh is deliberately not a dependency —
  // it is recreated every render and would loop.
  useEffect(() => {
    if (!project) return;
    ipc
      .sqitchPlan(project.path)
      .then((r) => setPlan(r as PlanFile))
      .catch(() => {});
    if (target && !confirmedTarget) handleRefresh();
  }, [project]);

  const stats = [
    {
      label: "Deployed",
      value: deployed.length,
      hint: "changes active",
      icon: CheckCircle2,
      tone: "text-emerald-400",
    },
    {
      label: "Reverted",
      value: revertedCount,
      hint: "in history",
      icon: RotateCcw,
      tone: "text-rose-400",
    },
    {
      label: "Verified",
      value: verifiedCount,
      hint: "last verify run",
      icon: ShieldCheck,
      tone: "text-sky-400",
    },
    {
      label: "Pending",
      value: pending.length,
      hint: "changes waiting",
      icon: Clock,
      tone: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Target input card */}
      <div className="glass-panel rounded-2xl p-6 border border-border/80 relative overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wider">
            Inspect Connection
          </h3>
        </div>
        <div className="flex gap-3">
          <TargetPicker value={target} onChange={setTarget} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !target}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-muted font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Inspect Status
          </button>
        </div>
        {showCommands && target && (
          <CommandPreview command={`sqitch status ${target}`} className="mt-4" />
        )}
      </div>

      {statusError && (
        <CommandErrorPanel
          error={statusError}
          onRetry={handleRefresh}
          onDismiss={() => setStatusError(null)}
        />
      )}

      {status && (
        <>
          {/* Dashboard cards: deployed / reverted / verified / pending */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="glass-panel rounded-xl p-5 border border-border shadow-sm flex flex-col justify-between h-28"
                >
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Icon size={12} className={s.tone} />
                    {s.label}
                  </span>
                  <div className="text-3xl font-extrabold tracking-tight mt-1">{s.value}</div>
                  <span className="text-[10px] text-muted-foreground font-semibold mt-1">
                    {s.hint}
                  </span>
                </div>
              );
            })}
          </div>

          {partiallyDeployed && (
            <div className="glass-panel rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-400">Partially deployed</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {deployed.length} of {deployed.length + pending.length} changes are deployed on
                    "{confirmedTarget}" — {pending.length} still pending.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    useProjectStore.getState().setLastTarget(confirmedTarget || target);
                    setSection("deploy");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                >
                  <Play size={11} />
                  Deploy Remaining
                </button>
                <button
                  type="button"
                  onClick={() => {
                    useProjectStore.getState().setLastTarget(confirmedTarget || target);
                    requestRevertTo(deployed[0].name);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent text-foreground font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Review Revert
                </button>
              </div>
            </div>
          )}

          {/* Dependencies section */}
          {changesWithDeps.length > 0 && (
            <div className="glass-panel rounded-2xl border border-border shadow-md overflow-hidden">
              <div className="p-4 border-b border-border bg-card/30 flex items-center gap-2">
                <GitBranch size={14} className="text-primary" />
                <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                  Dependencies
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {changesWithDeps.map((c) =>
                  c.requires.map((dep) => {
                    const satisfied = deployedNames.has(dep);
                    return (
                      <div
                        key={`${c.name}-${dep}`}
                        className="flex items-center gap-2 text-[11px] font-mono"
                      >
                        <span className="font-bold text-foreground/90">{c.name}</span>
                        <ArrowRight size={11} className="text-muted-foreground" />
                        <span className="text-muted-foreground">depends on</span>
                        <ArrowRight size={11} className="text-muted-foreground" />
                        <span className="font-bold text-foreground/90">{dep}</span>
                        {satisfied ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-sans font-semibold ml-1">
                            <CheckCircle2 size={11} /> satisfied
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive font-sans font-semibold ml-1">
                            <X size={11} /> missing
                          </span>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          )}

          {/* Changes list */}
          <div className="glass-panel rounded-2xl border border-border shadow-md overflow-hidden">
            <div className="p-5 border-b border-border bg-card/30 flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Deployment Log (Target: {confirmedTarget})
              </h3>
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                  Per page
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="bg-card border border-border rounded-lg px-2 py-1 text-[10px] text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {paged.length} of {deployed.length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {deployed.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                  No deployed changes found on target "{confirmedTarget}".
                </div>
              ) : (
                paged.map((change) => (
                  <button
                    type="button"
                    key={change.changeId}
                    onClick={() =>
                      setSelectedChangeId(
                        selectedChangeId === change.changeId ? null : change.changeId,
                      )
                    }
                    className={`w-full text-left p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-colors cursor-pointer ${
                      selectedChangeId === change.changeId ? "bg-primary/5" : "hover:bg-muted/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Deployed
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground/90 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                        {change.name}
                      </span>
                      {change.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full"
                        >
                          @{t}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                      <span>{change.deployedAt}</span>
                      <span>•</span>
                      <span className="text-foreground/80">{change.deployedBy}</span>
                      <button
                        type="button"
                        title={`Revert to ${change.name} — it stays deployed, later changes are reverted`}
                        onClick={(e) => {
                          e.stopPropagation();
                          useProjectStore.getState().setLastTarget(confirmedTarget || target);
                          requestRevertTo(change.name);
                        }}
                        className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all cursor-pointer"
                      >
                        <RotateCcw size={10} />
                        Revert to here
                      </button>
                    </div>
                  </button>
                ))
              )}
              {pending.map((name) => (
                <div key={`pending-${name}`} className="p-4 flex items-center gap-3 opacity-70">
                  <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Pending
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground/70 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
                    {name}
                  </span>
                </div>
              ))}
            </div>

            {/* Pagination with page-number input */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border bg-card/20 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  className="px-3 py-1.5 border border-border hover:bg-accent disabled:bg-muted/20 text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                  Page
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={clampedPage + 1}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) setPage(Math.min(totalPages - 1, Math.max(0, n - 1)));
                    }}
                    className="w-14 bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold text-center outline-none focus:ring-1 focus:ring-primary"
                  />
                  of {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={clampedPage >= totalPages - 1}
                  className="px-3 py-1.5 border border-border hover:bg-accent disabled:bg-muted/20 text-foreground font-semibold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Change detail panel */}
          {selectedChange && (
            <ChangeDetail
              change={selectedChange}
              projectName={project?.name ?? "—"}
              deployedNames={deployedNames}
              onClose={() => setSelectedChangeId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ChangeDetail({
  change,
  projectName,
  deployedNames,
  onClose,
}: {
  change: DeployedChange;
  projectName: string;
  deployedNames: Set<string>;
  onClose: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Change", change.name],
    ["Change ID", change.changeId || "—"],
    ["Project", projectName],
    ["Deployed by", change.deployedBy || "—"],
    ["Deployed at", change.deployedAt || "—"],
    ["Tags", change.tags.length ? change.tags.map((t) => `@${t}`).join(", ") : "—"],
    ["Note", change.note || "—"],
    ["Conflicts", change.conflicts.length ? change.conflicts.join(", ") : "—"],
  ];
  return (
    <div className="glass-panel rounded-2xl border border-primary/30 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-border bg-primary/5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
          Change Detail — {change.name}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md hover:bg-accent/40"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {label}
            </span>
            <span className="text-xs font-medium text-foreground/90 font-mono break-words">
              {value}
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Dependencies
          </span>
          {change.requires.length === 0 ? (
            <span className="text-xs font-medium text-foreground/60 font-mono">none</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {change.requires.map((dep) => (
                <span
                  key={dep}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    deployedNames.has(dep)
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                      : "bg-destructive/10 text-destructive border-destructive/15"
                  }`}
                >
                  {dep} {deployedNames.has(dep) ? "✔" : "✖"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
