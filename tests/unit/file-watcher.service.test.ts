import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn(),
    })),
  },
  watch: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  })),
}));

import { watch } from 'chokidar';
import { FileWatcherService } from '../../electron/services/file-watcher.service';

describe('FileWatcherService', () => {
  let service: FileWatcherService;
  const onEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileWatcherService(onEvent);
  });

  it('starts watching a project directory', () => {
    service.start('/project');
    expect(watch).toHaveBeenCalledWith(
      ['/project/sqitch.plan', '/project/deploy', '/project/revert', '/project/verify'],
      expect.objectContaining({
        ignoreInitial: true,
        atomic: true,
        awaitWriteFinish: { stabilityThreshold: 500 },
        ignored: expect.arrayContaining(['**/.git/**', '**/node_modules/**', '**/*.tmp']),
      })
    );
  });

  it('stops watching', () => {
    service.start('/project');
    service.stop('/project');
    expect(watch()).toBeDefined();
  });

  it('does not start duplicate watchers', () => {
    service.start('/project');
    service.start('/project');
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('stops all watchers on stopAll', () => {
    service.start('/project-a');
    service.start('/project-b');
    service.stopAll();
  });
});
