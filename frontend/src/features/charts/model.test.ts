import { describe, expect, it } from 'vitest';
import type { ChartDefinition, QueryResult } from '@/api/contract';
import { compileChart, niceTicks, scale } from './model';

const base: ChartDefinition = {
  type: 'bar',
  title: 'Revenue by month',
  subtitle: '',
  query: {
    datasetId: 'd',
    select: [
      { as: 'month', fieldId: 'f', bucket: 'month' },
      { as: 'revenue', fieldId: 'v', aggregate: 'sum' },
    ],
    filters: [],
    groupBy: ['month'],
    orderBy: [],
    limit: 12,
  },
  encoding: { category: 'month', value: 'revenue' },
  format: { style: 'number', compact: false },
  accessibilitySummary: '',
  schemaVersion: 1,
  fieldDependencies: [],
};

const result = (rows: QueryResult['rows'], columns: QueryResult['columns']): QueryResult => ({
  columns,
  rows,
  meta: { datasetRevision: 1, generatedAt: '2026-10-15T00:00:00Z', truncated: false },
});

describe('niceTicks', () => {
  it('rounds the axis to friendly steps', () => {
    expect(niceTicks(52_300)).toEqual([0, 20_000, 40_000, 60_000]);
    expect(niceTicks(9)).toEqual([0, 5, 10]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(scale(30, [0, 60])).toBe(0.5);
    expect(scale(null, [0, 60])).toBe(0);
  });
});

describe('compileChart', () => {
  it('builds categories with bucket labels and an accessible summary', () => {
    const model = compileChart(
      base,
      result(
        [
          { month: '2026-05-01', revenue: 10 },
          { month: '2026-06-01', revenue: 30 },
        ],
        [
          { key: 'month', label: 'Close date', type: 'date' },
          { key: 'revenue', label: 'Value', type: 'number' },
        ],
      ),
    );
    expect(model.kind).toBe('categorical');
    if (model.kind !== 'categorical') return;
    expect(model.categories.map((c) => c.label)).toEqual([
      expect.stringMatching(/May/),
      expect.stringMatching(/Jun/),
    ]);
    expect(model.series[0]?.values).toEqual([10, 30]);
    expect(model.summary).toMatch(/Highest: Jun/);
  });

  it('pivots a series encoding into multiple series', () => {
    const model = compileChart(
      { ...base, encoding: { category: 'stage', value: 'n', series: 'owner' } },
      result(
        [
          { stage: 'A', owner: 'x', n: 1 },
          { stage: 'A', owner: 'y', n: 2 },
          { stage: 'B', owner: 'x', n: 3 },
        ],
        [
          { key: 'stage', label: 'Stage', type: 'string' },
          { key: 'owner', label: 'Owner', type: 'string' },
          { key: 'n', label: 'Records', type: 'number' },
        ],
      ),
    );
    if (model.kind !== 'categorical') throw new Error('expected categorical');
    expect(model.series).toEqual([
      { name: 'x', values: [1, 3] },
      { name: 'y', values: [2, null] },
    ]);
  });

  it('handles metrics, tables and empty results', () => {
    const metric = compileChart(
      { ...base, type: 'metric', encoding: { value: 'n' } },
      result([{ n: 1234 }], [{ key: 'n', label: 'n', type: 'number' }]),
    );
    expect(metric).toMatchObject({ kind: 'metric', value: 1234 });
    expect(compileChart(base, result([], []))).toMatchObject({ kind: 'empty' });
    expect(compileChart({ ...base, type: 'table' }, result([], []))).toMatchObject({ kind: 'table' });
  });
});
