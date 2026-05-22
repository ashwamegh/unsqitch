import { describe, it, expect } from 'vitest';
import { parseLogOutput } from '../../src/lib/log-parser';

const LOG_OUTPUT = `On database mydb
Change: appschema
  ID: abc123def456
  Action: deploy
  Committed by Marge <marge@example.com>
  Date: 2024-01-15T10:00:00Z
  Note: Add schema for all flipr objects
  Tags: @v1.0.0
  Requires:
  Conflicts:

Change: users
  ID: def789ghi012
  Action: deploy
  Committed by Marge <marge@example.com>
  Date: 2024-01-15T10:30:00Z
  Note: Creates table to track our users
  Tags:
  Requires: appschema
  Conflicts:

Change: users
  ID: def789ghi012
  Action: revert
  Committed by Marge <marge@example.com>
  Date: 2024-01-16T08:00:00Z
  Note: Reverting users
  Tags:
  Requires: appschema
  Conflicts:`;

describe('parseLogOutput', () => {
  it('parses all log entries', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result).toHaveLength(3);
  });

  it('parses deploy action', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].change).toBe('appschema');
    expect(result[0].action).toBe('deploy');
  });

  it('parses revert action', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[2].change).toBe('users');
    expect(result[2].action).toBe('revert');
  });

  it('parses change ID', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].changeId).toBe('abc123def456');
  });

  it('parses committer', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].committer).toEqual({
      name: 'Marge',
      email: 'marge@example.com',
    });
  });

  it('parses timestamp', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].timestamp).toBe('2024-01-15T10:00:00Z');
  });

  it('parses note', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].note).toBe('Add schema for all flipr objects');
  });

  it('parses tags', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[0].tags).toEqual(['v1.0.0']);
  });

  it('parses empty tags', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[1].tags).toEqual([]);
  });

  it('parses requires', () => {
    const result = parseLogOutput(LOG_OUTPUT);
    expect(result[1].requires).toEqual(['appschema']);
  });

  it('handles empty output', () => {
    const result = parseLogOutput('');
    expect(result).toEqual([]);
  });
});
