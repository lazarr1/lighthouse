import { z } from 'zod';

/** Opaque, stable identifier issued by the backend. Never derived from display names. */
export const Id = z.string().min(1).max(128);

/** RFC 3339 timestamp with offset, e.g. `2026-10-15T09:30:00Z`. */
export const Timestamp = z.iso.datetime({ offset: true });

/** Monotonic integer used for optimistic concurrency (records, schemas, dashboards). */
export const Revision = z.number().int().nonnegative();

export const SortDirection = z.enum(['asc', 'desc']);

/** Cursor-paginated list. `nextCursor` is null on the last page. */
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

/** Plain list wrapper (kept as an object so fields can be added without breaking clients). */
export const listOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

/**
 * Stable, machine-readable error codes. The UI switches on these, never on messages.
 * `contract_violation` and `network_error` are client-side only and never sent by the server.
 */
export const ApiErrorCode = z.enum([
  'unauthenticated',
  'forbidden',
  'not_found',
  'validation_failed',
  'revision_conflict',
  'approval_invalidated',
  'schema_incompatible',
  'quota_exceeded',
  'rate_limited',
  'unavailable',
  'internal',
  'contract_violation',
  'network_error',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    requestId: z.string().optional(),
    /** Code-specific payload, e.g. `{ current: Record }` for `revision_conflict`. */
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const Empty = z.object({});
