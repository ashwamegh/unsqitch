import { describe, it, expect, beforeAll } from 'vitest';
import { SqitchService } from '../../electron/services/sqitch.service';
import { detectSqitchBinary } from '../../electron/services/binary-detector';

describe.skipIf(!process.env.RUN_INTEGRATION)('SqitchService integration', () => {
  let sqitch: SqitchService;
  const projectPath = process.env.TEST_PROJECT_PATH || '/tmp/unsqitch-test-project';

  beforeAll(() => {
    const binary = detectSqitchBinary();
    if (!binary) throw new Error('sqitch not found — install sqitch or set RUN_INTEGRATION=0');
    sqitch = new SqitchService(binary);
  });

  it('detects sqitch binary', () => {
    const binary = detectSqitchBinary();
    expect(binary).toBeTruthy();
  });

  it('runs sqitch status', async () => {
    const result = await sqitch.status(projectPath, 'db:pg:sqitch@localhost:54231/sqitch_test', 10000);
    expect(result.exitCode).toBe(0);
  }, 30000);

  it('runs sqitch plan', async () => {
    const result = await sqitch.plan(projectPath, 10000);
    expect(result.exitCode).toBe(0);
  }, 30000);
});
