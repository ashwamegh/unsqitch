import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '../../electron/services/config.service';
import { EngineService } from '../../electron/services/engine.service';
import { TargetService } from '../../electron/services/target.service';
import type { SqitchService } from '../../electron/services/sqitch.service';

function mockSqitch(stdout: string, stderr = '') {
  return {
    runCommand: vi.fn().mockResolvedValue({ stdout, stderr, exitCode: 0 }),
  } as unknown as SqitchService;
}

describe('ConfigService', () => {
  it('lists config entries', async () => {
    const sqitch = mockSqitch('core.engine=pg\nengine.pg.client=psql\n');
    const service = new ConfigService(sqitch);
    const entries = await service.list('/project');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ section: 'core', key: 'engine', value: 'pg' });
  });

  it('sets a config value', async () => {
    const sqitch = mockSqitch('');
    const service = new ConfigService(sqitch);
    await service.set('/project', 'core.engine', 'pg');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['config', 'core.engine', 'pg'], '/project');
  });

  it('unsets a config value', async () => {
    const sqitch = mockSqitch('');
    const service = new ConfigService(sqitch);
    await service.unset('/project', 'core.engine');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['config', '--unset', 'core.engine'], '/project');
  });
});

describe('EngineService', () => {
  it('adds an engine', async () => {
    const sqitch = mockSqitch('');
    const service = new EngineService(sqitch);
    await service.add('/project', 'pg', 'db:pg://localhost/mydb', 'psql');
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ['engine', 'add', 'pg', '--target', 'db:pg://localhost/mydb', '--client', 'psql'],
      '/project'
    );
  });

  it('removes an engine', async () => {
    const sqitch = mockSqitch('');
    const service = new EngineService(sqitch);
    await service.remove('/project', 'pg');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['engine', 'remove', 'pg'], '/project');
  });
});

describe('TargetService', () => {
  it('adds a target', async () => {
    const sqitch = mockSqitch('');
    const service = new TargetService(sqitch);
    await service.add('/project', 'mydb', 'db:pg://localhost/mydb');
    expect(sqitch.runCommand).toHaveBeenCalledWith(
      ['target', 'add', 'mydb', '--uri', 'db:pg://localhost/mydb'],
      '/project'
    );
  });

  it('removes a target', async () => {
    const sqitch = mockSqitch('');
    const service = new TargetService(sqitch);
    await service.remove('/project', 'mydb');
    expect(sqitch.runCommand).toHaveBeenCalledWith(['target', 'remove', 'mydb'], '/project');
  });
});
