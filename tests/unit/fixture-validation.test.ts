import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parsePlanFile } from '../../src/lib/plan-parser';
import { parseConfigList } from '../../src/lib/config-parser';
import { parseSqitchOutput } from '../../src/lib/sqitch-parser';
import { parseStatusOutput } from '../../src/lib/status-parser';
import { parseLogOutput } from '../../src/lib/log-parser';

const fixturesDir = resolve(__dirname, '../fixtures');

function readFixture(...parts: string[]): string {
  return readFileSync(resolve(fixturesDir, ...parts), 'utf-8');
}

describe('fixture validation', () => {
  describe('plan parser', () => {
    it('parses sqitch.plan fixture', () => {
      const content = readFixture('test-project', 'sqitch.plan');
      const result = parsePlanFile(content);

      expect(result.pragmas['syntax-version']).toBe('1.0.0');
      expect(result.pragmas['project']).toBe('test-project');
      expect(result.pragmas['uri']).toBe('https://github.com/example/test-project');

      expect(result.changes).toHaveLength(2);
      expect(result.changes[0].name).toBe('appschema');
      expect(result.changes[0].requires).toEqual([]);
      expect(result.changes[1].name).toBe('users');
      expect(result.changes[1].requires).toEqual(['appschema']);

      expect(result.unparseableLines).toHaveLength(0);
    });

    it('parses plan.txt fixture with tag', () => {
      const content = readFixture('sqitch-output', 'plan.txt');
      const result = parsePlanFile(content);

      expect(result.changes).toHaveLength(2);
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].name).toBe('v1.0.0');
      expect(result.unparseableLines).toHaveLength(0);
    });
  });

  describe('config parser', () => {
    it('parses config.txt fixture', () => {
      const content = readFixture('sqitch-output', 'config.txt');
      const result = parseConfigList(content);

      expect(result).toContainEqual({ section: 'core', key: 'engine', value: 'pg' });
      expect(result).toContainEqual({ section: 'core', key: 'top_dir', value: '.' });
      expect(result).toContainEqual({ section: 'core', key: 'plan_file', value: 'sqitch.plan' });
      expect(result).toContainEqual({ section: 'engine', subsection: 'pg', key: 'target', value: 'db:pg://localhost/sqitch_test' });
      expect(result).toContainEqual({ section: 'engine', subsection: 'pg', key: 'client', value: 'psql' });
    });
  });

  describe('sqitch output parser', () => {
    it('parses deploy.txt fixture', () => {
      const content = readFixture('sqitch-output', 'deploy.txt');
      const result = parseSqitchOutput(content);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('deploy');
      expect(result.events[0].change).toBe('appschema');
      expect(result.events[0].status).toBe('ok');
      expect(result.events[1].change).toBe('users');
      expect(result.events[1].status).toBe('ok');
    });

    it('parses revert.txt fixture', () => {
      const content = readFixture('sqitch-output', 'revert.txt');
      const result = parseSqitchOutput(content);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('revert');
      expect(result.events[0].change).toBe('users');
      expect(result.events[0].status).toBe('ok');
      expect(result.events[1].type).toBe('revert');
      expect(result.events[1].change).toBe('appschema');
    });

    it('parses verify.txt fixture', () => {
      const content = readFixture('sqitch-output', 'verify.txt');
      const result = parseSqitchOutput(content);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('verify');
      expect(result.events[0].change).toBe('appschema');
      expect(result.events[0].status).toBe('ok');
      expect(result.events[1].type).toBe('verify');
      expect(result.events[1].change).toBe('users');
    });
  });

  describe('status parser', () => {
    it('parses status.txt fixture', () => {
      const content = readFixture('sqitch-output', 'status.txt');
      const result = parseStatusOutput(content);

      expect(result.target).toBe('sqitch_test');
      expect(result.engine).toBe('pg');
      expect(result.deployed).toHaveLength(2);
      expect(result.deployed[0].name).toBe('appschema');
      expect(result.deployed[0].changeId).toBe('a1b2c3d4e5f6');
      expect(result.deployed[0].tags).toEqual(['v1.0.0']);
      expect(result.deployed[1].name).toBe('users');
      expect(result.deployed[1].requires).toEqual(['appschema']);
      expect(result.pending).toEqual(['orders']);
      expect(result.lastDeployTime).toBe('2024-01-15T10:30:00Z');
    });
  });

  describe('log parser', () => {
    it('parses log.txt fixture', () => {
      const content = readFixture('sqitch-output', 'log.txt');
      const result = parseLogOutput(content);

      expect(result).toHaveLength(2);
      expect(result[0].change).toBe('appschema');
      expect(result[0].changeId).toBe('a1b2c3d4e5f6');
      expect(result[0].action).toBe('deploy');
      expect(result[0].committer.name).toBe('Test User');
      expect(result[0].committer.email).toBe('test@example.com');
      expect(result[0].tags).toEqual(['v1.0.0']);
      expect(result[1].change).toBe('users');
      expect(result[1].requires).toEqual(['appschema']);
    });
  });
});
