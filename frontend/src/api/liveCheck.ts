import { ApiError, type ApiClient } from './client';
import { endpoints, type EndpointName } from './contract';

/**
 * Walks a running backend the way the UI does — session → workspace → dataset
 * → records → dashboard → actions → runs — and validates every response
 * against the contract. Data-agnostic: it follows whatever IDs the server
 * returns, so it works against any seeded database.
 *
 * With `writes: true` it also creates, edits, conflicts, deletes and restores
 * a scratch record, cleaning up after itself.
 */

export type CheckStatus = 'pass' | 'fail' | 'missing' | 'skipped';

export interface CheckResult {
  endpoint: EndpointName;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface LiveCheckOptions {
  writes?: boolean;
  /** Only report on these endpoints (others are still called when needed for IDs). */
  only?: ReadonlySet<EndpointName>;
}

const MISSING_STATUSES = new Set([404, 405, 501]);

export async function runLiveCheck(api: ApiClient, options: LiveCheckOptions = {}): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  /** Runs one call; returns its result, or undefined if it failed (dependents are then skipped). */
  async function check<T>(
    endpoint: EndpointName,
    label: string,
    call: () => Promise<T>,
    expect?: (value: T) => string | null,
  ) {
    try {
      const value = await call();
      const problem = expect?.(value) ?? null;
      results.push({ endpoint, label, status: problem ? 'fail' : 'pass', detail: problem ?? 'ok' });
      return value;
    } catch (error) {
      results.push({ endpoint, label, ...classify(error) });
      return undefined;
    }
  }

  /** For calls that are supposed to fail with a specific error code. */
  async function expectError(
    endpoint: EndpointName,
    label: string,
    code: string,
    call: () => Promise<unknown>,
  ) {
    try {
      await call();
      results.push({ endpoint, label, status: 'fail', detail: `expected error "${code}", got success` });
    } catch (error) {
      if (error instanceof ApiError && error.code === code)
        results.push({ endpoint, label, status: 'pass', detail: `${code} as expected` });
      else results.push({ endpoint, label, ...classify(error) });
    }
  }

  const skip = (endpoint: EndpointName, label: string, reason: string) =>
    results.push({ endpoint, label, status: 'skipped', detail: reason });

  // ── Session & workspace ──────────────────────────────────────────────────
  const session = await check('getSession', 'GET session', () => api.request(endpoints.getSession, {}));
  const workspaceId = session?.workspaces[0]?.id;
  const workspace = workspaceId
    ? await check('getWorkspace', 'GET workspace', () =>
        api.request(endpoints.getWorkspace, { params: { workspaceId } }),
      )
    : (skip('getWorkspace', 'GET workspace', 'no workspace from session'), undefined);

  // ── Dataset & records ────────────────────────────────────────────────────
  const datasetId = workspace?.datasets[0]?.id;
  const dataset = datasetId
    ? await check('getDataset', 'GET dataset', () =>
        api.request(endpoints.getDataset, { params: { datasetId } }),
      )
    : (skip('getDataset', 'GET dataset', 'workspace has no datasets'), undefined);

  if (datasetId) {
    const page = await check(
      'queryRecords',
      'POST records/query (first page)',
      () => api.request(endpoints.queryRecords, { params: { datasetId }, body: { limit: 5 } }),
      (result) => (result.items.length > 5 ? `returned ${result.items.length} items for limit 5` : null),
    );
    if (page?.nextCursor) {
      await check(
        'queryRecords',
        'POST records/query (next cursor)',
        () =>
          api.request(endpoints.queryRecords, {
            params: { datasetId },
            body: { limit: 5, cursor: page.nextCursor },
          }),
        (next) =>
          next.items[0] && next.items[0].id === page.items[0]?.id
            ? 'cursor returned the same first record'
            : null,
      );
    }
    const first = page?.items[0];
    if (first) {
      await check('getRecord', 'GET record', () =>
        api.request(endpoints.getRecord, { params: { datasetId, recordId: first.id } }),
      );
    } else skip('getRecord', 'GET record', 'dataset is empty');
    if (dataset) {
      await check('previewSchemaChange', 'POST schema-changes/preview (rename, no side effects)', () =>
        api.request(endpoints.previewSchemaChange, {
          params: { datasetId },
          body: {
            expectedSchemaVersion: dataset.schemaVersion,
            changes: [{ op: 'renameField', fieldId: dataset.primaryFieldId, name: 'Contract check' }],
          },
        }),
      );
    }

    if (options.writes && dataset) await checkRecordWrites(datasetId, dataset.primaryFieldId);
    else skip('createRecord', 'record write cycle', 'run with --writes');
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  const dashboardId = workspace?.defaultDashboardId;
  const dashboard = dashboardId
    ? await check('getDashboard', 'GET dashboard', () =>
        api.request(endpoints.getDashboard, { params: { dashboardId } }),
      )
    : (skip('getDashboard', 'GET dashboard', 'no default dashboard'), undefined);
  for (const widget of dashboard?.widgets
    .filter((w) => w.kind === 'chart' && w.status === 'ok')
    .slice(0, 5) ?? []) {
    await check('getWidgetData', `GET widget data (${widget.id})`, () =>
      api.request(endpoints.getWidgetData, { params: { dashboardId: dashboardId!, widgetId: widget.id } }),
    );
  }

  // ── Actions & runs ───────────────────────────────────────────────────────
  if (workspaceId) {
    const actions = await check('listActions', 'GET actions', () =>
      api.request(endpoints.listActions, { params: { workspaceId } }),
    );
    const action = actions?.items[0];
    if (action) {
      await check('getAction', 'GET action', () =>
        api.request(endpoints.getAction, { params: { actionId: action.id } }),
      );
      const runs = await check('listRuns', 'GET action runs', () =>
        api.request(endpoints.listRuns, { params: { actionId: action.id }, query: { limit: 5 } }),
      );
      const run = runs?.items[0];
      if (run)
        await check('getRun', 'GET run', () => api.request(endpoints.getRun, { params: { runId: run.id } }));
      else skip('getRun', 'GET run', 'action has no runs');
    } else skip('getAction', 'GET action', 'workspace has no actions');
  }

  async function checkRecordWrites(datasetId: string, primaryFieldId: string) {
    const created = await check('createRecord', 'POST record (scratch)', () =>
      api.request(endpoints.createRecord, {
        params: { datasetId },
        body: { values: { [primaryFieldId]: 'Lighthouse contract check' } },
      }),
    );
    if (!created) return;
    const record = created.record;
    const params = { datasetId, recordId: record.id };
    const updated = await check(
      'updateRecord',
      'PATCH record with If-Match',
      () =>
        api.request(endpoints.updateRecord, {
          params,
          body: { values: { [primaryFieldId]: 'Lighthouse contract check (edited)' } },
          ifMatch: record.revision,
        }),
      (result) => (result.record.revision <= record.revision ? 'revision did not increase' : null),
    );
    if (updated) {
      await expectError('updateRecord', 'PATCH with stale If-Match → 409', 'revision_conflict', () =>
        api.request(endpoints.updateRecord, {
          params,
          body: { values: { [primaryFieldId]: 'stale write' } },
          ifMatch: record.revision,
        }),
      );
    }
    const latest = updated?.record ?? record;
    const deleted = await check('deleteRecord', 'DELETE record', () =>
      api.request(endpoints.deleteRecord, { params, ifMatch: latest.revision }),
    );
    if (deleted) {
      await check('revertChangeSet', 'POST change-sets/revert (undo delete)', () =>
        api.request(endpoints.revertChangeSet, { params: { changeSetId: deleted.changeSetId } }),
      );
      // Clean up the restored scratch record.
      const restored = await api.request(endpoints.getRecord, { params }).catch(() => undefined);
      if (restored)
        await api
          .request(endpoints.deleteRecord, { params, ifMatch: restored.revision })
          .catch(() => undefined);
    }
  }

  return options.only ? results.filter((result) => options.only!.has(result.endpoint)) : results;
}

function classify(error: unknown): { status: CheckStatus; detail: string } {
  if (error instanceof ApiError) {
    if (error.code === 'network_error')
      return { status: 'missing', detail: 'no response (is the backend running?)' };
    if (MISSING_STATUSES.has(error.status) && error.code !== 'not_found')
      return { status: 'missing', detail: `HTTP ${error.status}` };
    if (error.status === 404 && !error.requestId)
      return { status: 'missing', detail: 'HTTP 404 (route not implemented?)' };
    if (error.code === 'contract_violation') {
      const issues =
        (error.details.issues as { path: (string | number)[]; message: string }[] | undefined) ?? [];
      const summary = issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      return { status: 'fail', detail: `response violates contract — ${summary || error.message}` };
    }
    return { status: 'fail', detail: `${error.status} ${error.code}: ${error.message}` };
  }
  return { status: 'fail', detail: error instanceof Error ? error.message : String(error) };
}
