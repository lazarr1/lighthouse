import { describe, expect, it } from 'vitest';
import type { Field } from '@/api/contract';
import { displayText, editText, parseInput, sameValue } from './fieldValues';

const field = (type: Field['type'], extra: Partial<Field> = {}): Field => ({
  id: 'f',
  name: 'Field',
  type,
  description: '',
  required: false,
  status: 'active',
  config: {
    choices: [
      { id: 'c1', label: 'Won', color: 'green' },
      { id: 'c2', label: 'Lost', color: 'red' },
    ],
    currency: 'USD',
  },
  ...extra,
});

describe('parseInput', () => {
  it('parses numbers, money and percentages', () => {
    expect(parseInput(field('number'), '1,234.5')).toEqual({ ok: true, value: 1234.5 });
    expect(parseInput(field('money'), '$18,400')).toEqual({ ok: true, value: 18400 });
    expect(parseInput(field('percent'), '25%')).toEqual({ ok: true, value: 0.25 });
    expect(parseInput(field('number'), 'abc')).toMatchObject({ ok: false });
  });

  it('parses choices by label, booleans, dates and urls', () => {
    expect(parseInput(field('singleSelect'), 'won')).toEqual({ ok: true, value: 'c1' });
    expect(parseInput(field('singleSelect'), 'Maybe')).toMatchObject({ ok: false });
    expect(parseInput(field('multiSelect'), 'Won, Lost')).toEqual({ ok: true, value: ['c1', 'c2'] });
    expect(parseInput(field('boolean'), 'yes')).toEqual({ ok: true, value: true });
    expect(parseInput(field('date'), '2026-01-31')).toEqual({ ok: true, value: '2026-01-31' });
    expect(parseInput(field('url'), 'example.com')).toEqual({ ok: true, value: 'https://example.com' });
  });

  it('treats blank as null unless required', () => {
    expect(parseInput(field('text'), '  ')).toEqual({ ok: true, value: null });
    expect(parseInput(field('text', { required: true }), '')).toMatchObject({ ok: false });
  });

  it('round-trips through editText', () => {
    const percent = field('percent');
    expect(parseInput(percent, editText(percent, 0.125))).toEqual({ ok: true, value: 0.125 });
    const select = field('singleSelect');
    expect(parseInput(select, editText(select, 'c2'))).toEqual({ ok: true, value: 'c2' });
    const datetime = field('datetime');
    expect(parseInput(datetime, editText(datetime, '2026-10-15T09:30:00.000Z'))).toEqual({
      ok: true,
      value: '2026-10-15T09:30:00.000Z',
    });
  });
});

describe('displayText', () => {
  it('renders by type', () => {
    expect(displayText(field('singleSelect'), 'c1')).toBe('Won');
    expect(displayText(field('boolean'), false)).toBe('No');
    expect(displayText(field('percent'), 0.256)).toBe('25.6%');
    expect(displayText(field('text'), null)).toBe('');
    expect(sameValue(['a'], ['a'])).toBe(true);
  });
});
