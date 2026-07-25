import { type FSWatcher, watch } from "chokidar";
import type { WatchEventPayload } from "../shared/ipc-types";
import { resolveProjectLayout } from "./project-layout";

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  /** Resolved plan-file path per project, used to classify watch events. */
  private planFiles: Map<string, string> = new Map();
  private onEvent: (event: WatchEventPayload) => void;

  constructor(onEvent: (event: WatchEventPayload) => void) {
    this.onEvent = onEvent;
  }

  start(projectPath: string): void {
    if (this.watchers.has(projectPath)) return;

    // Honor core.top_dir / core.plan_file — scripts and the plan may live in a
    // subdirectory (e.g. top_dir = sql).
    const layout = resolveProjectLayout(projectPath);
    this.planFiles.set(projectPath, layout.planFile);
    const watchPaths = [layout.planFile, layout.deployDir, layout.revertDir, layout.verifyDir];

    const watcher = watch(watchPaths, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
      },
      ignored: ["**/.git/**", "**/node_modules/**", "**/*.tmp"],
    });

    watcher.on("change", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "change");
    });

    watcher.on("add", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "add");
    });

    watcher.on("unlink", (filePath: string) => {
      this.emitEvent(projectPath, filePath, "unlink");
    });

    this.watchers.set(projectPath, watcher);
  }

  stop(projectPath: string): void {
    const watcher = this.watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectPath);
    }
    this.planFiles.delete(projectPath);
  }

  stopAll(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    this.planFiles.clear();
  }

  private emitEvent(
    projectPath: string,
    filePath: string,
    action: WatchEventPayload["action"],
  ): void {
    // The plan file is not always named sqitch.plan (core.plan_file), so compare
    // against the resolved path and fall back to the conventional name.
    const planFile = this.planFiles.get(projectPath);
    const isPlan = planFile ? filePath === planFile : filePath.endsWith("sqitch.plan");
    const type: WatchEventPayload["type"] = isPlan ? "plan" : "script";
    this.onEvent({ projectPath, type, filePath, action });
  }
}
