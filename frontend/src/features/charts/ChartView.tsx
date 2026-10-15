import { useMemo, type CSSProperties } from 'react';
import type { ChartDefinition, QueryResult } from '@/api/contract';
import { cx } from '@/lib/cx';
import { formatValue } from '@/lib/format';
import { EmptyState } from '@/ui';
import styles from './ChartView.module.css';
import { compileChart, scale, type ChartModel } from './model';

const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
];
const color = (index: number) => SERIES_COLORS[index % SERIES_COLORS.length];

export interface ChartViewProps {
  definition: ChartDefinition;
  result: QueryResult;
  /** Smaller type and padding for previews. */
  dense?: boolean;
}

/**
 * Renders any ChartDefinition. Every chart exposes a text summary to assistive
 * tech (`role="img"` + label); `ChartDataTable` provides the tabular alternative.
 */
export function ChartView({ definition, result, dense }: ChartViewProps) {
  const model = useMemo(() => compileChart(definition, result), [definition, result]);
  return (
    <div className={cx(styles.chart, dense && styles.dense)} data-chart-type={definition.type}>
      <ChartBody model={model} />
    </div>
  );
}

function ChartBody({ model }: { model: ChartModel }) {
  switch (model.kind) {
    case 'metric':
      return (
        <div className={styles.metric} role="img" aria-label={model.summary}>
          <strong>{model.formatted}</strong>
        </div>
      );
    case 'empty':
      return (
        <EmptyState compact icon="info" title="No data yet">
          Records that match this chart will appear here.
        </EmptyState>
      );
    case 'table':
      return <ChartDataTable columns={model.columns} rows={model.rows} caption={model.summary} />;
    case 'categorical':
      if (model.variant === 'horizontalBar') return <HorizontalBars model={model} />;
      if (model.variant === 'donut') return <Donut model={model} />;
      if (model.variant === 'line' || model.variant === 'area') return <LineChart model={model} />;
      return <VerticalBars model={model} />;
  }
}

type Categorical = Extract<ChartModel, { kind: 'categorical' }>;

function Legend({ model }: { model: Categorical }) {
  if (model.series.length < 2) return null;
  return (
    <ul className={styles.legend} aria-hidden="true">
      {model.series.map((series, index) => (
        <li key={series.name}>
          <i style={{ background: color(index) }} />
          {series.name}
        </li>
      ))}
    </ul>
  );
}

function YAxis({ model }: { model: Categorical }) {
  return (
    <div className={styles.yAxis} aria-hidden="true">
      {[...model.ticks].reverse().map((tick) => (
        <span key={tick}>{formatValue(tick, { ...model.format, compact: true })}</span>
      ))}
    </div>
  );
}

function VerticalBars({ model }: { model: Categorical }) {
  const highlight = model.series.length === 1 ? model.categories.length - 1 : -1;
  const columns = { gridTemplateColumns: `repeat(${model.categories.length}, minmax(0, 1fr))` };
  return (
    <>
      <div className={styles.cartesian}>
        <YAxis model={model} />
        <div className={styles.plotWrap}>
          <div
            className={styles.plot}
            role="img"
            aria-label={model.summary}
            style={{ '--gridlines': model.ticks.length - 1 } as CSSProperties}
          >
            <div className={styles.bars} style={columns}>
              {model.categories.map((category, index) => (
                <div
                  key={category.key}
                  className={cx(styles.barStack, index === highlight && styles.active)}
                  title={category.label}
                >
                  {model.series.map((series, seriesIndex) => {
                    const value = series.values[index] ?? null;
                    return (
                      <span
                        key={series.name}
                        className={styles.bar}
                        style={{
                          height: `${scale(value, model.ticks) * 100}%`,
                          background: model.series.length > 1 ? color(seriesIndex) : undefined,
                        }}
                      >
                        {model.series.length === 1 ? (
                          <b>{formatValue(value, { ...model.format, compact: true })}</b>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.xLabels} style={columns} aria-hidden="true">
            {model.categories.map((category) => (
              <small key={category.key}>{category.label}</small>
            ))}
          </div>
        </div>
      </div>
      <Legend model={model} />
    </>
  );
}

function HorizontalBars({ model }: { model: Categorical }) {
  const series = model.series[0];
  if (!series) return null;
  return (
    <div className={styles.horizontal} role="img" aria-label={model.summary}>
      {model.categories.map((category, index) => {
        const value = series.values[index] ?? null;
        return (
          <div key={category.key} className={styles.hRow}>
            <span>{category.label}</span>
            <b>{formatValue(value, model.format)}</b>
            <i
              style={{
                width: `${scale(value, [model.max || 1]) * 100}%`,
                opacity: 1 - Math.min(index, 5) * 0.12,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ model }: { model: Categorical }) {
  const count = model.categories.length;
  const x = (index: number) => (count <= 1 ? 50 : (index / (count - 1)) * 100);
  const y = (value: number | null) => 100 - scale(value, model.ticks) * 100;
  const labelEvery = Math.max(1, Math.ceil(count / 8));
  return (
    <>
      <div className={styles.cartesian}>
        <YAxis model={model} />
        <div className={styles.plotWrap}>
          <div
            className={cx(styles.plot, styles.linePlot)}
            role="img"
            aria-label={model.summary}
            style={{ '--gridlines': model.ticks.length - 1 } as CSSProperties}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {model.series.map((series, seriesIndex) => {
                const points = series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
                return (
                  <g key={series.name}>
                    {model.variant === 'area' ? (
                      <polygon points={`0,100 ${points} 100,100`} fill={color(seriesIndex)} opacity={0.14} />
                    ) : null}
                    <polyline
                      points={points}
                      fill="none"
                      stroke={color(seriesIndex)}
                      strokeWidth={2.2}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
            </svg>
            {model.series.map((series, seriesIndex) =>
              series.values.map((value, index) => (
                <span
                  key={`${series.name}-${index}`}
                  className={styles.point}
                  style={{ left: `${x(index)}%`, top: `${y(value)}%`, borderColor: color(seriesIndex) }}
                  title={`${model.categories[index]?.label}: ${formatValue(value, model.format)}`}
                />
              )),
            )}
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {model.categories.map((category, index) => (
              <span key={category.key} style={{ left: `${x(index)}%` }}>
                {index % labelEvery === 0 ? category.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Legend model={model} />
    </>
  );
}

function Donut({ model }: { model: Categorical }) {
  const series = model.series[0];
  if (!series) return null;
  const total = series.values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const radius = 15.9155; // circumference = 100
  let offset = 25;
  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 42 42" role="img" aria-label={model.summary}>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        {series.values.map((value, index) => {
          const share = total ? ((value ?? 0) / total) * 100 : 0;
          const segment = (
            <circle
              key={model.categories[index]?.key ?? index}
              cx="21"
              cy="21"
              r={radius}
              fill="none"
              stroke={color(index)}
              strokeWidth="6"
              strokeDasharray={`${Math.max(0, share - 0.6)} ${100 - Math.max(0, share - 0.6)}`}
              strokeDashoffset={offset}
            />
          );
          offset -= share;
          return segment;
        })}
        <text x="21" y="20.5" textAnchor="middle" className={styles.donutTotal}>
          {formatValue(total, { ...model.format, compact: true })}
        </text>
        <text x="21" y="26" textAnchor="middle" className={styles.donutLabel}>
          total
        </text>
      </svg>
      <ul className={styles.donutLegend} aria-hidden="true">
        {model.categories.map((category, index) => (
          <li key={category.key}>
            <i style={{ background: color(index) }} />
            <span>{category.label}</span>
            <b>{total ? Math.round(((series.values[index] ?? 0) / total) * 100) : 0}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Accessible tabular alternative for any chart ("View data"). */
export function ChartDataTable({
  columns,
  rows,
  caption,
}: Pick<QueryResult, 'columns' | 'rows'> & { caption?: string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        {caption ? <caption className="visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.type === 'number' ? styles.num : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => {
                const value = row[column.key];
                return (
                  <td key={column.key} className={column.type === 'number' ? styles.num : undefined}>
                    {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
