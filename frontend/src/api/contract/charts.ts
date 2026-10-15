import { z } from 'zod';
import { Id, Revision, Timestamp } from './common';
import { Filter } from './records';

// ── Query AST ───────────────────────────────────────────────────────────────
// Neither the browser nor the AI ever sends SQL. The backend compiles this AST
// against the dataset schema and authorisation scope.

export const Aggregate = z.enum(['count', 'countDistinct', 'sum', 'avg', 'min', 'max']);
export type Aggregate = z.infer<typeof Aggregate>;

export const TimeBucket = z.enum(['day', 'week', 'month', 'quarter', 'year']);
export type TimeBucket = z.infer<typeof TimeBucket>;

/** Output column name: lower-case identifier, referenced by groupBy/orderBy/encodings. */
export const Alias = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const SelectItem = z.object({
  as: Alias,
  /** Omitted only for `count` of records. */
  fieldId: Id.optional(),
  aggregate: Aggregate.optional(),
  bucket: TimeBucket.optional(),
});
export type SelectItem = z.infer<typeof SelectItem>;

export const QueryDefinition = z.object({
  datasetId: Id,
  select: z.array(SelectItem).min(1).max(8),
  filters: z.array(Filter).max(20).default([]),
  groupBy: z.array(Alias).max(3).default([]),
  orderBy: z
    .array(z.object({ by: Alias, direction: z.enum(['asc', 'desc']) }))
    .max(3)
    .default([]),
  limit: z.number().int().min(1).max(1000).default(100),
});
export type QueryDefinition = z.infer<typeof QueryDefinition>;

export const ResultColumn = z.object({
  key: Alias,
  label: z.string(),
  type: z.enum(['string', 'number', 'date']),
});

export const QueryResult = z.object({
  columns: z.array(ResultColumn),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  meta: z.object({
    datasetRevision: Revision,
    generatedAt: Timestamp,
    /** True when `limit` cut the result short. */
    truncated: z.boolean(),
  }),
});
export type QueryResult = z.infer<typeof QueryResult>;

// ── Chart definition ────────────────────────────────────────────────────────
// An application-owned, declarative artifact. The frontend renders it; it never
// contains code, HTML, CSS, URLs or expressions.

export const ChartType = z.enum(['bar', 'horizontalBar', 'line', 'area', 'donut', 'metric', 'table']);
export type ChartType = z.infer<typeof ChartType>;

export const ValueFormat = z.object({
  style: z.enum(['number', 'currency', 'percent']),
  currency: z.string().length(3).optional(),
  compact: z.boolean().default(false),
});
export type ValueFormat = z.infer<typeof ValueFormat>;

export const ChartEncoding = z.object({
  /** Category / time axis alias. Absent for `metric`. */
  category: Alias.optional(),
  /** Measure alias. */
  value: Alias,
  /** Optional alias that splits the measure into multiple series. */
  series: Alias.optional(),
});
export type ChartEncoding = z.infer<typeof ChartEncoding>;

export const ChartDefinition = z.object({
  type: ChartType,
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).default(''),
  query: QueryDefinition,
  encoding: ChartEncoding,
  format: ValueFormat,
  /** Plain-language description of what the chart shows, for screen readers and summaries. */
  accessibilitySummary: z.string(),
  /** Schema version the definition was validated against. */
  schemaVersion: Revision,
  /** Field IDs the chart depends on (used by schema impact analysis). */
  fieldDependencies: z.array(Id),
});
export type ChartDefinition = z.infer<typeof ChartDefinition>;

// ── AI chart drafts ─────────────────────────────────────────────────────────

export const CreateChartDraftBody = z.object({
  datasetId: Id,
  prompt: z.string().min(1).max(2000),
  /** Refine a previous draft conversationally instead of starting over. */
  refineDraftId: Id.optional(),
});

export const ChartDraft = z.object({
  id: Id,
  datasetId: Id,
  prompt: z.string(),
  definition: ChartDefinition,
  /** The AI's explanation of how it interpreted the request. */
  explanation: z.string(),
  /** Bounded preview result for the definition. */
  preview: QueryResult,
  warnings: z.array(z.string()),
  createdAt: Timestamp,
});
export type ChartDraft = z.infer<typeof ChartDraft>;
