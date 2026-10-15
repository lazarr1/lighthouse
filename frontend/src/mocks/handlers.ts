import { http, HttpResponse } from 'msw';
import { endpoints, TERMINAL_RUN_STATUSES } from '@/api/contract';
import { contractHandler, contractStreamHandler, type ContractHandlerOptions } from './contractHandler';
import { MockApiError, type MockDb } from './db';
import { MockQueryError, queryRecords } from './queryEngine';

/**
 * One handler per contract endpoint. `tests/contract/coverage.test.ts` fails if
 * an endpoint is added to the contract without a handler here.
 */
export function createHandlers(db: MockDb, options: ContractHandlerOptions) {
  const on = <E extends Parameters<typeof contractHandler>[0]>(
    endpoint: E,
    resolve: Parameters<typeof contractHandler<E>>[2],
  ) => contractHandler(endpoint, options, resolve);

  return [
    on(endpoints.getSession, () => db.session),
    on(endpoints.getWorkspace, ({ params }) => db.workspace(params.workspaceId)),

    on(endpoints.getDataset, ({ params }) => db.getDataset(params.datasetId)),
    on(endpoints.previewSchemaChange, ({ params, body }) =>
      db.previewSchemaChange(params.datasetId, body.expectedSchemaVersion, body.changes),
    ),
    on(endpoints.applySchemaChange, ({ params, body }) =>
      db.applySchemaChange(params.datasetId, body.expectedSchemaVersion, body.changes),
    ),

    on(endpoints.queryRecords, ({ params, body }) => {
      try {
        return queryRecords(db.getDataset(params.datasetId), db.records, body);
      } catch (error) {
        if (error instanceof MockQueryError) throw new MockApiError(422, 'validation_failed', error.message);
        throw error;
      }
    }),
    on(endpoints.getRecord, ({ params }) => db.findRecord(params.datasetId, params.recordId)),
    on(endpoints.createRecord, ({ params, body }) => db.createRecord(params.datasetId, body.values)),
    on(endpoints.updateRecord, ({ params, body, ifMatch }) =>
      db.updateRecord(params.datasetId, params.recordId, body.values, ifMatch),
    ),
    on(endpoints.deleteRecord, ({ params, ifMatch }) =>
      db.deleteRecord(params.datasetId, params.recordId, ifMatch),
    ),
    on(endpoints.revertChangeSet, ({ params }) => db.revertChangeSet(params.changeSetId)),

    on(endpoints.createChartDraft, ({ body }) =>
      db.createChartDraft(body.datasetId, body.prompt, body.refineDraftId),
    ),

    on(endpoints.getDashboard, ({ params }) => db.getDashboard(params.dashboardId)),
    on(endpoints.updateDashboardLayout, ({ params, body }) =>
      db.updateLayout(params.dashboardId, body.expectedVersion, body.layouts),
    ),
    on(endpoints.addWidget, ({ params, body }) => db.addWidget(params.dashboardId, body.chartDraftId)),
    on(endpoints.duplicateWidget, ({ params }) => db.duplicateWidget(params.dashboardId, params.widgetId)),
    on(endpoints.deleteWidget, ({ params }) => db.deleteWidget(params.dashboardId, params.widgetId)),
    on(endpoints.restoreWidget, ({ params }) => db.restoreWidget(params.dashboardId, params.widgetId)),
    on(endpoints.getWidgetData, ({ params }) => db.widgetData(params.dashboardId, params.widgetId)),

    on(endpoints.createActionDraft, ({ params, body }) => {
      const { plan: _plan, ...draft } = db.createActionDraft(
        params.workspaceId,
        body.prompt,
        body.attachmentIds,
        body.actionId,
      );
      return draft;
    }),
    on(endpoints.startDryRun, ({ params }) => db.startDryRun(params.draftId)),
    on(endpoints.approveDraft, ({ params, body }) =>
      db.approveDraft(params.draftId, body.hash, body.dryRunId, body.runNow),
    ),
    on(endpoints.listActions, ({ params }) => {
      db.workspace(params.workspaceId);
      return { items: [...db.actions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    }),
    on(endpoints.getAction, ({ params }) => db.getAction(params.actionId)),
    on(endpoints.updateAction, ({ params, body }) => db.updateAction(params.actionId, body.status)),
    on(endpoints.setSchedule, ({ params, body }) =>
      db.setSchedule(params.actionId, body.cron, body.timezone, body.enabled),
    ),
    on(endpoints.startRun, ({ params }) => db.startLiveRun(params.actionId)),
    on(endpoints.listRuns, ({ params, query }) => {
      const runs = db.listRuns(params.actionId);
      const limit = Number(query.get('limit') ?? 20);
      const offset = Number(query.get('cursor') ?? 0);
      const items = runs.slice(offset, offset + limit);
      return { items, nextCursor: offset + limit < runs.length ? String(offset + limit) : null };
    }),
    on(endpoints.getRun, ({ params }) => db.getRun(params.runId)),
    on(endpoints.cancelRun, ({ params }) => db.cancelRun(params.runId)),
    contractStreamHandler(endpoints.streamRunEvents, options, ({ params }, send, close) =>
      db.subscribe(params.runId, (event) => {
        send(event);
        if (event.type === 'run.updated' && TERMINAL_RUN_STATUSES.includes(event.run.status)) close();
      }),
    ),

    on(endpoints.createUpload, ({ body }) => {
      const upload = db.createUpload(body.filename, body.contentType, body.size);
      return {
        upload,
        uploadUrl: `${options.baseUrl}/mock-storage/${upload.id}`,
        method: 'PUT' as const,
        headers: { 'Content-Type': body.contentType },
        expiresAt: new Date(db.now().getTime() + 15 * 60_000).toISOString(),
      };
    }),
    on(endpoints.completeUpload, ({ params }) => db.completeUpload(params.uploadId)),

    // Stand-in for the pre-signed object storage URL (not part of the API contract).
    http.put(`${options.baseUrl}/mock-storage/:uploadId`, () => new HttpResponse(null, { status: 200 })),
  ];
}
