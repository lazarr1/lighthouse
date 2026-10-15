import { z } from 'zod';
import {
  Action,
  ActionDraft,
  ApproveDraftBody,
  ApproveDraftResult,
  CreateActionDraftBody,
  Run,
  RunEvent,
  SetScheduleBody,
  UpdateActionBody,
} from './actions';
import { ChartDraft, CreateChartDraftBody, QueryResult } from './charts';
import { Empty, listOf, pageOf } from './common';
import { AddWidgetBody, Dashboard, UpdateLayoutBody, WidgetMutationResult } from './dashboards';
import { Dataset, SchemaChangeRequest, SchemaChangeResult, SchemaImpact } from './datasets';
import { defineEndpoint } from './endpoint';
import {
  CreateRecordBody,
  DataRecord,
  DeleteRecordResult,
  RecordMutationResult,
  RecordPage,
  RecordQuery,
  RevertResult,
  UpdateRecordBody,
} from './records';
import { CreateUploadBody, Upload, UploadTicket } from './uploads';
import { Session, Workspace } from './workspace';

/**
 * The complete HTTP contract the web client depends on.
 *
 * Editing a schema here updates, in one step: the typed client, request/response
 * validation, the mock backend's type checks, the contract tests, and
 * `docs/openapi.json` (via `npm run contract:openapi`).
 */
export const endpoints = {
  // ── Session ────────────────────────────────────────────────────────────────
  getSession: defineEndpoint({
    method: 'GET',
    path: '/v1/session',
    tag: 'Session',
    summary: 'Current user and the workspaces they can access.',
    response: Session,
  }),
  getWorkspace: defineEndpoint({
    method: 'GET',
    path: '/v1/workspaces/{workspaceId}',
    tag: 'Session',
    summary: 'Workspace with its dataset summaries and default dashboard.',
    response: Workspace,
  }),

  // ── Datasets & schema ──────────────────────────────────────────────────────
  getDataset: defineEndpoint({
    method: 'GET',
    path: '/v1/datasets/{datasetId}',
    tag: 'Datasets',
    summary: 'Dataset metadata including its current schema (fields).',
    response: Dataset,
  }),
  previewSchemaChange: defineEndpoint({
    method: 'POST',
    path: '/v1/datasets/{datasetId}/schema-changes/preview',
    tag: 'Datasets',
    summary:
      'Impact assessment for a schema change: conversions and affected charts/actions. No side effects.',
    body: SchemaChangeRequest,
    response: SchemaImpact,
    errors: ['revision_conflict', 'validation_failed'],
  }),
  applySchemaChange: defineEndpoint({
    method: 'POST',
    path: '/v1/datasets/{datasetId}/schema-changes',
    tag: 'Datasets',
    summary: 'Publish a schema change. Fails if the schema moved since `expectedSchemaVersion`.',
    body: SchemaChangeRequest,
    response: SchemaChangeResult,
    idempotent: true,
    errors: ['revision_conflict', 'validation_failed'],
  }),

  // ── Records ────────────────────────────────────────────────────────────────
  queryRecords: defineEndpoint({
    method: 'POST',
    path: '/v1/datasets/{datasetId}/records/query',
    tag: 'Records',
    summary: 'Search, filter, sort and page through records (cursor pagination).',
    body: RecordQuery,
    response: RecordPage,
    errors: ['validation_failed'],
  }),
  getRecord: defineEndpoint({
    method: 'GET',
    path: '/v1/datasets/{datasetId}/records/{recordId}',
    tag: 'Records',
    summary: 'A single record.',
    response: DataRecord,
  }),
  createRecord: defineEndpoint({
    method: 'POST',
    path: '/v1/datasets/{datasetId}/records',
    tag: 'Records',
    summary: 'Create a record.',
    body: CreateRecordBody,
    response: RecordMutationResult,
    successStatus: 201,
    idempotent: true,
    errors: ['validation_failed'],
  }),
  updateRecord: defineEndpoint({
    method: 'PATCH',
    path: '/v1/datasets/{datasetId}/records/{recordId}',
    tag: 'Records',
    summary: 'Partially update a record. Requires `If-Match` with the revision being edited.',
    body: UpdateRecordBody,
    response: RecordMutationResult,
    ifMatch: true,
    errors: ['revision_conflict', 'validation_failed'],
  }),
  deleteRecord: defineEndpoint({
    method: 'DELETE',
    path: '/v1/datasets/{datasetId}/records/{recordId}',
    tag: 'Records',
    summary: 'Delete a record (reversible via its change set).',
    response: DeleteRecordResult,
    ifMatch: true,
    errors: ['revision_conflict'],
  }),
  revertChangeSet: defineEndpoint({
    method: 'POST',
    path: '/v1/change-sets/{changeSetId}/revert',
    tag: 'Records',
    summary: 'Undo a change set (record edit, delete, action commit, schema change).',
    response: RevertResult,
    idempotent: true,
    errors: ['revision_conflict'],
  }),

  // ── Charts ─────────────────────────────────────────────────────────────────
  createChartDraft: defineEndpoint({
    method: 'POST',
    path: '/v1/chart-drafts',
    tag: 'Charts',
    summary: 'Ask the AI for a chart. Returns a validated definition plus a bounded preview.',
    body: CreateChartDraftBody,
    response: ChartDraft,
    successStatus: 201,
    errors: ['validation_failed', 'schema_incompatible', 'quota_exceeded'],
  }),

  // ── Dashboards ─────────────────────────────────────────────────────────────
  getDashboard: defineEndpoint({
    method: 'GET',
    path: '/v1/dashboards/{dashboardId}',
    tag: 'Dashboards',
    summary: 'Dashboard with widgets and per-breakpoint layouts.',
    response: Dashboard,
  }),
  updateDashboardLayout: defineEndpoint({
    method: 'PUT',
    path: '/v1/dashboards/{dashboardId}/layout',
    tag: 'Dashboards',
    summary: 'Replace layouts. Does not create new chart versions.',
    body: UpdateLayoutBody,
    response: Dashboard,
    errors: ['revision_conflict', 'validation_failed'],
  }),
  addWidget: defineEndpoint({
    method: 'POST',
    path: '/v1/dashboards/{dashboardId}/widgets',
    tag: 'Dashboards',
    summary: 'Publish a chart draft as an immutable version and place it on the dashboard.',
    body: AddWidgetBody,
    response: WidgetMutationResult,
    successStatus: 201,
    idempotent: true,
  }),
  duplicateWidget: defineEndpoint({
    method: 'POST',
    path: '/v1/dashboards/{dashboardId}/widgets/{widgetId}/duplicate',
    tag: 'Dashboards',
    summary: 'Copy a widget (shares the chart version).',
    response: WidgetMutationResult,
    successStatus: 201,
    idempotent: true,
  }),
  deleteWidget: defineEndpoint({
    method: 'DELETE',
    path: '/v1/dashboards/{dashboardId}/widgets/{widgetId}',
    tag: 'Dashboards',
    summary: 'Remove a widget (soft delete; restorable).',
    response: WidgetMutationResult,
  }),
  restoreWidget: defineEndpoint({
    method: 'POST',
    path: '/v1/dashboards/{dashboardId}/widgets/{widgetId}/restore',
    tag: 'Dashboards',
    summary: 'Undo a widget removal.',
    response: WidgetMutationResult,
  }),
  getWidgetData: defineEndpoint({
    method: 'GET',
    path: '/v1/dashboards/{dashboardId}/widgets/{widgetId}/data',
    tag: 'Dashboards',
    summary: 'Run the widget query. Cached by tenant + chart version + data revision + auth scope.',
    response: QueryResult,
    errors: ['schema_incompatible'],
  }),

  // ── Actions ────────────────────────────────────────────────────────────────
  createActionDraft: defineEndpoint({
    method: 'POST',
    path: '/v1/workspaces/{workspaceId}/action-drafts',
    tag: 'Actions',
    summary: 'Ask the AI to plan an action. Returns interpretation, steps and required permissions.',
    body: CreateActionDraftBody,
    response: ActionDraft,
    successStatus: 201,
    errors: ['validation_failed', 'quota_exceeded'],
  }),
  startDryRun: defineEndpoint({
    method: 'POST',
    path: '/v1/action-drafts/{draftId}/dry-runs',
    tag: 'Actions',
    summary: 'Execute the draft against a read-only snapshot and stage proposed changes.',
    response: Run,
    successStatus: 202,
    idempotent: true,
  }),
  approveDraft: defineEndpoint({
    method: 'POST',
    path: '/v1/action-drafts/{draftId}/approve',
    tag: 'Actions',
    summary: 'Approve the exact draft hash, creating an action version. Optionally run it now.',
    body: ApproveDraftBody,
    response: ApproveDraftResult,
    idempotent: true,
    errors: ['approval_invalidated', 'forbidden'],
  }),
  listActions: defineEndpoint({
    method: 'GET',
    path: '/v1/workspaces/{workspaceId}/actions',
    tag: 'Actions',
    summary: 'All approved actions in the workspace.',
    response: listOf(Action),
  }),
  getAction: defineEndpoint({
    method: 'GET',
    path: '/v1/actions/{actionId}',
    tag: 'Actions',
    summary: 'An action with its current approved version and schedule.',
    response: Action,
  }),
  updateAction: defineEndpoint({
    method: 'PATCH',
    path: '/v1/actions/{actionId}',
    tag: 'Actions',
    summary: 'Pause or resume an action (acts as a per-action kill switch).',
    body: UpdateActionBody,
    response: Action,
  }),
  setSchedule: defineEndpoint({
    method: 'PUT',
    path: '/v1/actions/{actionId}/schedule',
    tag: 'Actions',
    summary:
      'Create, change or disable the schedule. Enabling is a separate approval from the action itself.',
    body: SetScheduleBody,
    response: Action,
    errors: ['validation_failed', 'forbidden'],
  }),
  startRun: defineEndpoint({
    method: 'POST',
    path: '/v1/actions/{actionId}/runs',
    tag: 'Runs',
    summary: 'Start a live run of the current approved version.',
    response: Run,
    successStatus: 202,
    idempotent: true,
    errors: ['forbidden'],
  }),
  listRuns: defineEndpoint({
    method: 'GET',
    path: '/v1/actions/{actionId}/runs',
    tag: 'Runs',
    summary: 'Run history, newest first.',
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
    response: pageOf(Run),
  }),
  getRun: defineEndpoint({
    method: 'GET',
    path: '/v1/runs/{runId}',
    tag: 'Runs',
    summary: 'Run status, step progress and staged/committed changes.',
    response: Run,
  }),
  streamRunEvents: defineEndpoint({
    method: 'GET',
    path: '/v1/runs/{runId}/events',
    tag: 'Runs',
    summary: 'Server-sent events: `run.updated` snapshots and `log` lines. Ends after a terminal status.',
    response: RunEvent,
    stream: true,
  }),
  cancelRun: defineEndpoint({
    method: 'POST',
    path: '/v1/runs/{runId}/cancel',
    tag: 'Runs',
    summary: 'Cancel a queued or running run. Staged changes are discarded.',
    response: Run,
  }),

  // ── Uploads ────────────────────────────────────────────────────────────────
  createUpload: defineEndpoint({
    method: 'POST',
    path: '/v1/workspaces/{workspaceId}/uploads',
    tag: 'Uploads',
    summary: 'Get a pre-signed URL to upload a file directly to quarantined object storage.',
    body: CreateUploadBody,
    response: UploadTicket,
    successStatus: 201,
    idempotent: true,
    errors: ['validation_failed', 'quota_exceeded'],
  }),
  completeUpload: defineEndpoint({
    method: 'POST',
    path: '/v1/uploads/{uploadId}/complete',
    tag: 'Uploads',
    summary: 'Confirm the bytes were uploaded; triggers type verification and scanning.',
    body: Empty,
    response: Upload,
  }),
} as const;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
