import { z } from 'zod';
import { Id, Timestamp } from './common';
import { RecordValues } from './records';

export const StepKind = z.enum([
  'fetch',
  'parse',
  'extract',
  'ocr',
  'transform',
  'validate',
  'dedupe',
  'lookup',
  'upsert',
  'notify',
]);
export type StepKind = z.infer<typeof StepKind>;

export const PlanStep = z.object({
  id: Id,
  kind: StepKind,
  title: z.string(),
  detail: z.string(),
});
export type PlanStep = z.infer<typeof PlanStep>;

export const Permission = z.object({
  kind: z.enum(['read', 'write', 'network', 'secret']),
  /** Dataset ID, domain, or secret name (never a secret value). */
  target: z.string(),
  description: z.string(),
});
export type Permission = z.infer<typeof Permission>;

export const ActionManifest = z.object({
  inputs: z.array(Id),
  outputs: z.array(Id),
  permissions: z.array(Permission),
  limits: z.object({
    maxRecordsWritten: z.number().int().positive(),
    timeoutSeconds: z.number().int().positive(),
    maxNetworkRequests: z.number().int().nonnegative(),
  }),
});
export type ActionManifest = z.infer<typeof ActionManifest>;

// ── Drafts (AI proposals, not yet approved) ────────────────────────────────

export const CreateActionDraftBody = z.object({
  prompt: z.string().min(1).max(4000),
  attachmentIds: z.array(Id).max(10).default([]),
  /** Dataset the user is looking at, as context. */
  datasetId: Id.optional(),
  /** Propose a new version of an existing action. */
  actionId: Id.optional(),
});

export const ActionDraft = z.object({
  id: Id,
  workspaceId: Id,
  actionId: Id.nullable(),
  prompt: z.string(),
  attachmentIds: z.array(Id),
  status: z.enum(['ready', 'needs_input', 'rejected']),
  title: z.string(),
  /** The AI's restatement of what it understood. */
  interpretation: z.string(),
  steps: z.array(PlanStep),
  manifest: ActionManifest,
  /** Content + capability hash. Approval binds to this exact value. */
  hash: z.string(),
  /** Clarifying questions when `status = needs_input`. */
  questions: z.array(z.string()),
  /** Reason when `status = rejected` (e.g. disallowed capability). */
  rejectionReason: z.string().nullable(),
  createdAt: Timestamp,
});
export type ActionDraft = z.infer<typeof ActionDraft>;

// ── Runs ───────────────────────────────────────────────────────────────────

export const RunStatus = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export type RunStatus = z.infer<typeof RunStatus>;
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['succeeded', 'failed', 'cancelled'];

export const ChangeSample = z.object({
  kind: z.enum(['insert', 'update', 'duplicate', 'rejected']),
  recordId: Id.nullable(),
  values: RecordValues,
  reason: z.string().nullable(),
});
export type ChangeSample = z.infer<typeof ChangeSample>;

/** Staged mutations produced by a run. Dry runs are never committed. */
export const ProposedChanges = z.object({
  datasetId: Id,
  inserts: z.number().int().nonnegative(),
  updates: z.number().int().nonnegative(),
  duplicatesSkipped: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  sample: z.array(ChangeSample).max(50),
  committed: z.boolean(),
  /** Set once committed; can be reverted. */
  changeSetId: Id.nullable(),
});
export type ProposedChanges = z.infer<typeof ProposedChanges>;

export const Run = z.object({
  id: Id,
  actionId: Id.nullable(),
  draftId: Id.nullable(),
  /** Hash of the exact artifact executed. */
  artifactHash: z.string(),
  mode: z.enum(['dry_run', 'live']),
  trigger: z.enum(['manual', 'schedule', 'approval']),
  status: RunStatus,
  steps: z.array(
    z.object({
      stepId: Id,
      status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']),
      message: z.string().nullable(),
    }),
  ),
  changes: ProposedChanges.nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: Timestamp,
  startedAt: Timestamp.nullable(),
  finishedAt: Timestamp.nullable(),
});
export type Run = z.infer<typeof Run>;

/** Server-sent events on `GET /v1/runs/{runId}/events`. The stream ends after a terminal `run.updated`. */
export const RunEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run.updated'), run: Run }),
  z.object({
    type: z.literal('log'),
    at: Timestamp,
    level: z.enum(['info', 'warn', 'error']),
    message: z.string(),
  }),
]);
export type RunEvent = z.infer<typeof RunEvent>;

// ── Approved actions ───────────────────────────────────────────────────────

export const ActionVersion = z.object({
  id: Id,
  version: z.number().int().positive(),
  hash: z.string(),
  steps: z.array(PlanStep),
  manifest: ActionManifest,
  approvedBy: z.string(),
  approvedAt: Timestamp,
});
export type ActionVersion = z.infer<typeof ActionVersion>;

export const Schedule = z.object({
  /** 5-field cron expression. */
  cron: z.string().min(9).max(100),
  /** IANA timezone. */
  timezone: z.string(),
  enabled: z.boolean(),
  /** Server-rendered human description, e.g. "Every weekday at 09:00". */
  description: z.string(),
  nextRunAt: Timestamp.nullable(),
});
export type Schedule = z.infer<typeof Schedule>;

export const RunSummary = Run.pick({
  id: true,
  status: true,
  mode: true,
  trigger: true,
  createdAt: true,
  finishedAt: true,
});
export type RunSummary = z.infer<typeof RunSummary>;

export const Action = z.object({
  id: Id,
  workspaceId: Id,
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'paused']),
  currentVersion: ActionVersion,
  schedule: Schedule.nullable(),
  lastRun: RunSummary.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Action = z.infer<typeof Action>;

export const ApproveDraftBody = z.object({
  /** Must match the draft's current hash, otherwise `approval_invalidated`. */
  hash: z.string(),
  /** A succeeded dry run of this exact hash. */
  dryRunId: Id,
  /** Start a live run immediately after approval. */
  runNow: z.boolean(),
});

export const ApproveDraftResult = z.object({
  action: Action,
  run: Run.nullable(),
});

export const UpdateActionBody = z.object({ status: z.enum(['active', 'paused']) });

export const SetScheduleBody = z.object({
  cron: z.string().min(9).max(100),
  timezone: z.string(),
  enabled: z.boolean(),
});
