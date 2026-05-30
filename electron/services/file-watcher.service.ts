import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import type { WatchEventPayload } from '../shared/ipc-types';

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private onEvent: (event: WatchEventPayload) => void;

  constructor(onEvent: (event: WatchEventPayload) => void) {
    this.onEvent = onEvent;
  }

  start(projectPath: string): void {
    if (this.watchers.has(projectPath)) return;

    const watchPaths = [
      path.join(projectPath, 'sqitch.plan'),
      path.join(projectPath, 'deploy'),
      path.join(projectPath, 'revert'),
      path.join(projectPath, 'verify'),
    ];

    const watcher = watch(watchPaths, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
      },
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/*.tmp',
      ],
    });

    watcher.on('change', (filePath: string) => {
      this.emitEvent(projectPath, filePath, 'change');
    });

    watcher.on('add', (filePath: string) => {
      this.emitEvent(projectPath, filePath, 'add');
    });

    watcher.on('unlink', (filePath: string) => {
      this.emitEvent(projectPath, filePath, 'unlink');
    });

    this.watchers.set(projectPath, watcher);
  }

  stop(projectPath: string): void {
    const watcher = this.watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectPath);
    }
  }

  stopAll(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }

  private emitEvent(projectPath: string, filePath: string, action: WatchEventPayload['action']): void {
    const type: WatchEventPayload['type'] = filePath.endsWith('sqitch.plan') ? 'plan' : 'script';
    this.onEvent({ projectPath, type, filePath, action });
  }
}
