import { z } from 'zod';
import { Id, Revision, SortDirection, Timestamp } from './common';

/**
 * Wire representation of a cell.
 * - text / longText / url / singleSelect (choice id) / date (YYYY-MM-DD) / datetime (RFC 3339): string
 * - number / money / percent (0.25 = 25%): number
 * - boolean: boolean
 * - multiSelect: string[] of choice ids
 * - empty: null
 */
export const CellValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);
export type CellValue = z.infer<typeof CellValue>;

export const RecordValues = z.record(z.string(), CellValue);
export type RecordValues = z.infer<typeof RecordValues>;

export const RecordIssue = z.object({
  fieldId: Id,
  severity: z.enum(['warning', 'error']),
  message: z.string(),
});
export type RecordIssue = z.infer<typeof RecordIssue>;

export const Provenance = z.object({
  kind: z.enum(['manual', 'import', 'action', 'image']),
  /** Action run ID, upload ID, etc. */
  ref: z.string().nullable(),
  label: z.string(),
});

export const DataRecord = z.object({
  id: Id,
  revision: Revision,
  values: RecordValues,
  issues: z.array(RecordIssue),
  source: Provenance,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type DataRecord = z.infer<typeof DataRecord>;

export const FilterOperator = z.enum([
  'eq',
  'neq',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'isEmpty',
  'isNotEmpty',
]);
export type FilterOperator = z.infer<typeof FilterOperator>;

export const Filter = z.object({
  fieldId: Id,
  op: FilterOperator,
  value: CellValue.optional(),
});
export type Filter = z.infer<typeof Filter>;

export const RecordSort = z.object({ fieldId: Id, direction: SortDirection });
export type RecordSort = z.infer<typeof RecordSort>;

export const RecordQuery = z.object({
  search: z.string().max(200).optional(),
  filters: z.array(Filter).max(20).default([]),
  sort: z.array(RecordSort).max(5).default([]),
  /** When true, only records with validation issues are returned. */
  onlyWithIssues: z.boolean().default(false),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});
export type RecordQuery = z.input<typeof RecordQuery>;

export const RecordPage = z.object({
  items: z.array(DataRecord),
  nextCursor: z.string().nullable(),
  /** Total matching the query (not just this page). */
  totalCount: z.number().int().nonnegative(),
  dataRevision: Revision,
});
export type RecordPage = z.infer<typeof RecordPage>;

export const CreateRecordBody = z.object({ values: RecordValues });
export const UpdateRecordBody = z.object({ values: RecordValues });

export const RecordMutationResult = z.object({
  record: DataRecord,
  /** Use with `revertChangeSet` to undo. */
  changeSetId: Id,
});
export type RecordMutationResult = z.infer<typeof RecordMutationResult>;

export const DeleteRecordResult = z.object({ changeSetId: Id });

export const RevertResult = z.object({
  changeSetId: Id,
  affectedRecordIds: z.array(Id),
});
