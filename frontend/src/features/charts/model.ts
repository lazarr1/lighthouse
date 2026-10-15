import type { ChartDefinition, QueryResult, ValueFormat } from '@/api/contract';
import { formatBucket, formatValue } from '@/lib/format';

/**
 * Compiles a declarative ChartDefinition + its QueryResult into a render model.
 * Pure and framework-free so it can be unit tested, and so the renderer can be
 * swapped (e.g. for Vega-Lite) without touching data handling.
 */

export interface Category {
  key: string;
  label: string;
}

export interface Series {
  name: string;
  values: (number | null)[];
}

export type ChartModel =
  | { kind: 'metric'; value: number | null; formatted: string; summary: string }
  | {
      kind: 'categorical';
      variant: 'bar' | 'horizontalBar' | 'line' | 'area' | 'donut';
      categories: Category[];
      series: Series[];
      max: number;
      ticks: number[];
      format: ValueFormat;
      summary: string;
    }
  | { kind: 'table'; columns: QueryResult['columns']; rows: QueryResult['rows']; summary: string }
  | { kind: 'empty'; summary: string };

/** Round axis maximum and evenly spaced ticks, e.g. 52_300 → [0, 20k, 40k, 60k]. */
export function niceTicks(max: number, count = 3): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value < max + step * 0.0001; value += step) ticks.push(Math.round(value * 1e6) / 1e6);
  if ((ticks.at(-1) ?? 0) < max) ticks.push(Math.round((ticks.at(-1) ?? 0) + step));
  return ticks;
}

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function compileChart(definition: ChartDefinition, result: QueryResult): ChartModel {
  const { encoding, format, title } = definition;
  const valueKey = encoding.value;

  if (definition.type === 'table') {
    return {
      kind: 'table',
      columns: result.columns,
      rows: result.rows,
      summary: `${title}: table with ${result.rows.length} rows.`,
    };
  }

  if (definition.type === 'metric' || !encoding.category) {
    const value = toNumber(result.rows[0]?.[valueKey]);
    const formatted = formatValue(value, format);
    return { kind: 'metric', value, formatted, summary: `${title}: ${formatted}.` };
  }

  if (result.rows.length === 0) return { kind: 'empty', summary: `${title}: no data matches yet.` };

  const categoryKey = encoding.category;
  const categoryColumn = result.columns.find((column) => column.key === categoryKey);
  const bucket = definition.query.select.find((item) => item.as === categoryKey)?.bucket;
  const labelFor = (raw: unknown) =>
    raw === null || raw === undefined
      ? '(empty)'
      : categoryColumn?.type === 'date'
        ? formatBucket(String(raw), bucket)
        : String(raw);

  const categories: Category[] = [];
  const seen = new Set<string>();
  for (const row of result.rows) {
    const key = String(row[categoryKey] ?? '');
    if (!seen.has(key)) {
      seen.add(key);
      categories.push({ key, label: labelFor(row[categoryKey]) });
    }
  }

  let series: Series[];
  if (encoding.series) {
    const seriesKey = encoding.series;
    const names = [...new Set(result.rows.map((row) => String(row[seriesKey] ?? '(empty)')))];
    series = names.map((name) => ({
      name,
      values: categories.map((category) => {
        const row = result.rows.find(
          (r) => String(r[categoryKey] ?? '') === category.key && String(r[seriesKey] ?? '(empty)') === name,
        );
        return toNumber(row?.[valueKey]);
      }),
    }));
  } else {
    const valueLabel = result.columns.find((column) => column.key === valueKey)?.label ?? valueKey;
    series = [
      {
        name: valueLabel,
        values: categories.map((category) =>
          toNumber(result.rows.find((r) => String(r[categoryKey] ?? '') === category.key)?.[valueKey]),
        ),
      },
    ];
  }

  const allValues = series.flatMap((s) => s.values).filter((value): value is number => value !== null);
  const max = Math.max(0, ...allValues);
  const variant = definition.type as Extract<ChartModel, { kind: 'categorical' }>['variant'];

  return {
    kind: 'categorical',
    variant,
    categories,
    series,
    max,
    ticks: niceTicks(max),
    format,
    summary: summarise(title, categories, series, format, variant),
  };
}

function summarise(
  title: string,
  categories: Category[],
  series: Series[],
  format: ValueFormat,
  variant: string,
): string {
  const first = series[0];
  if (!first) return title;
  const pairs = categories.map(
    (category, index) => `${category.label} ${formatValue(first.values[index] ?? null, format)}`,
  );
  const shown = pairs.slice(0, 8).join(', ') + (pairs.length > 8 ? `, and ${pairs.length - 8} more` : '');
  let highest = 0;
  first.values.forEach((value, index) => {
    if ((value ?? -Infinity) > (first.values[highest] ?? -Infinity)) highest = index;
  });
  const peakCategory = categories[highest];
  const peak = peakCategory ? ` Highest: ${peakCategory.label}.` : '';
  const kind = variant === 'donut' ? 'Share' : variant === 'line' || variant === 'area' ? 'Trend' : 'Values';
  return `${title}. ${kind}: ${shown}.${peak}`;
}

/** Fraction (0–1) of the axis maximum, for bar sizes. */
export const scale = (value: number | null, ticks: number[]) => {
  const top = ticks.at(-1) ?? 1;
  return value === null || top === 0 ? 0 : Math.max(0, Math.min(1, value / top));
};
