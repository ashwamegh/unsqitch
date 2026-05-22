import { describe, it, expect } from 'vitest';
import { parseConfigList } from '../../src/lib/config-parser';

describe('parseConfigList', () => {
  it('parses simple key=value', () => {
    const result = parseConfigList('core.engine=pg');
    expect(result).toEqual([
      { section: 'core', key: 'engine', value: 'pg' },
    ]);
  });

  it('parses key with subsection', () => {
    const result = parseConfigList('engine.pg.client=psql');
    expect(result).toEqual([
      { section: 'engine', subsection: 'pg', key: 'client', value: 'psql' },
    ]);
  });

  it('parses value containing equals sign', () => {
    const result = parseConfigList('core.uri=db:pg://user=me@host/db');
    expect(result).toEqual([
      { section: 'core', key: 'uri', value: 'db:pg://user=me@host/db' },
    ]);
  });

  it('parses multiple lines', () => {
    const input = `core.engine=pg
core.top_dir=.
engine.pg.client=psql
engine.pg.target=db:pg://localhost/mydb`;
    const result = parseConfigList(input);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ section: 'core', key: 'engine', value: 'pg' });
    expect(result[2]).toEqual({ section: 'engine', subsection: 'pg', key: 'client', value: 'psql' });
  });

  it('handles empty input', () => {
    const result = parseConfigList('');
    expect(result).toEqual([]);
  });

  it('skips blank lines', () => {
    const input = `core.engine=pg

core.top_dir=.`;
    const result = parseConfigList(input);
    expect(result).toHaveLength(2);
  });

  it('handles subsection with deep nesting', () => {
    const result = parseConfigList('target.mydb.uri=db:pg://localhost/mydb');
    expect(result[0]).toEqual({
      section: 'target',
      subsection: 'mydb',
      key: 'uri',
      value: 'db:pg://localhost/mydb',
    });
  });

  it('handles empty value', () => {
    const result = parseConfigList('core.plan_file=');
    expect(result[0].value).toBe('');
  });

  it('handles literal \\n in multiline values', () => {
    const result = parseConfigList('core.note=Line 1\\nLine 2');
    expect(result[0].value).toBe('Line 1\\nLine 2');
  });
});