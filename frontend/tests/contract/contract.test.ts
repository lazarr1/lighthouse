/**
 * Contract tests: drive every endpoint through the real ApiClient against the
 * strict mock backend. The client validates every response against the
 * contract schemas, and the mock validates every request — so these tests
 * fail if the client, the schemas or the mock disagree.
 *
 * Point `TEST_BASE_URL` at a real backend (with seeded fixtures) to reuse
 * these scenarios as backend acceptance tests.
 */
import { describe, expect, it } from 'vitest';
import { hasCode } from '@/api/client';
import { endpoints, type Run, type RunEvent } from '@/api/contract';
import { DASHBOARD_ID, LEADS_ID, WORKSPACE_ID } from '@/mocks/fixtures';
import { createHandlers } from '@/mocks/handlers';
import { MockDb } from '@/mocks/db';
import { createTestClient, TEST_BASE_URL } from '../testBackend';

const api = createTestClient();
const leads = { datasetId: LEADS_ID };

describe('contract coverage', () => {
  it('has a mock handler for every endpoint in the contract', () => {
    const handlers = createHandlers(new MockDb({ recordCount: 1 }), {
      baseUrl: '',
      latencyMs: 0,
      strict: true,
    });
    const mocked = new Set(
      handlers.map((handler) => {
        const info = handler.info as { method: string; path: string };
        return `${info.method} ${info.path}`;
      }),
    );
    const missing = Object.entries(endpoints)
      .map(([name, endpoint]) => ({
        name,
        key: `${endpoint.method} ${endpoint.path.replace(/\{(\w+)\}/g, ':$1')}`,
      }))
      .filter(({ key }) => !mocked.has(key));
    expect(missing).toEqual([]);
  });
});

describe('session and workspace', () => {
  it('returns the user, workspaces and datasets', async () => {
    const session = await api.request(endpoints.getSession, {});
    expect(session.workspaces[0]?.id).toBe(WORKSPACE_ID);
    const workspace = await api.request(endpoints.getWorkspace, { params: { workspaceId: WORKSPACE_ID } });
    expect(workspace.datasets).toEqual([expect.objectContaining({ id: LEADS_ID, recordCount: 300 })]);
    expect(workspace.defaultDashboardId).toBe(DASHBOARD_ID);
  });

  it('returns not_found with a stable error code', async () => {
    await expect(
      api.request(endpoints.getWorkspace, { params: { workspaceId: 'nope' } }),
    ).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });
  });
});

describe('records', () => {
  it('pages through records with a cursor', async () => {
    const first = await api.request(endpoints.queryRecords, { params: leads, body: { limit: 100 } });
    expect(first.items).toHaveLength(100);
    expect(first.totalCount).toBe(300);
    const second = await api.request(endpoints.queryRecords, {
      params: leads,
      body: { limit: 100, cursor: first.nextCursor },
    });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    const third = await api.request(endpoints.queryRecords, {
      params: leads,
      body: { limit: 100, cursor: second.nextCursor },
    });
    expect(third.nextCursor).toBeNull();
  });

  it('searches, filters and sorts', async () => {
    const searched = await api.request(endpoints.queryRecords, {
      params: leads,
      body: { search: 'northstar' },
    });
    expect(searched.items[0]?.values.fld_company).toBe('Northstar Labs');

    const won = await api.request(endpoints.queryRecords, {
      params: leads,
      body: {
        filters: [{ fieldId: 'fld_stage', op: 'eq', value: 'stg_won' }],
        sort: [{ fieldId: 'fld_value', direction: 'desc' }],
      },
    });
    expect(won.items.every((record) => record.values.fld_stage === 'stg_won')).toBe(true);
    const values = won.items.map((record) => record.values.fld_value as number);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('rejects filters on unknown fields', async () => {
    await expect(
      api.request(endpoints.queryRecords, {
        params: leads,
        body: { filters: [{ fieldId: 'fld_nope', op: 'isEmpty' }] },
      }),
    ).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('creates, updates with If-Match, detects conflicts and reverts', async () => {
    const created = await api.request(endpoints.createRecord, {
      params: leads,
      body: { values: { fld_company: 'Contract Co' } },
    });
    const { record } = created;
    expect(record.revision).toBe(1);

    const updated = await api.request(endpoints.updateRecord, {
      params: { ...leads, recordId: record.id },
      body: { values: { fld_value: 1200 } },
      ifMatch: record.revision,
    });
    expect(updated.record.revision).toBe(2);

    const stale = api.request(endpoints.updateRecord, {
      params: { ...leads, recordId: record.id },
      body: { values: { fld_value: 99 } },
      ifMatch: 1,
    });
    await expect(stale).rejects.toMatchObject({ code: 'revision_conflict', status: 409 });
    const error = await stale.catch((e: unknown) => e);
    expect(
      hasCode(error, 'revision_conflict') && (error.details.current as { revision: number }).revision,
    ).toBe(2);

    await api.request(endpoints.revertChangeSet, { params: { changeSetId: updated.changeSetId } });
    const reverted = await api.request(endpoints.getRecord, { params: { ...leads, recordId: record.id } });
    expect(reverted.values.fld_value).toBeNull();
  });

  it('validates values by field type', async () => {
    await expect(
      api.request(endpoints.createRecord, { params: leads, body: { values: { fld_value: 'lots' } } }),
    ).rejects.toMatchObject({
      code: 'validation_failed',
      details: { fields: { fld_value: 'Must be a number' } },
    });
  });

  it('deletes and restores via change set', async () => {
    const page = await api.request(endpoints.queryRecords, { params: leads, body: { limit: 1 } });
    const target = page.items[0]!;
    const { changeSetId } = await api.request(endpoints.deleteRecord, {
      params: { ...leads, recordId: target.id },
      ifMatch: target.revision,
    });
    await expect(
      api.request(endpoints.getRecord, { params: { ...leads, recordId: target.id } }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    await api.request(endpoints.revertChangeSet, { params: { changeSetId } });
    await expect(
      api.request(endpoints.getRecord, { params: { ...leads, recordId: target.id } }),
    ).resolves.toBeTruthy();
  });
});

describe('schema changes', () => {
  it('previews impact, then applies with optimistic concurrency', async () => {
    const dataset = await api.request(endpoints.getDataset, { params: leads });
    const change = {
      expectedSchemaVersion: dataset.schemaVersion,
      changes: [{ op: 'changeFieldType' as const, fieldId: 'fld_value', type: 'text' as const }],
    };

    const impact = await api.request(endpoints.previewSchemaChange, { params: leads, body: change });
    expect(impact.requiresConfirmation).toBe(true);
    expect(impact.dependents.map((d) => d.id)).toContain('wdg_revenue');

    const result = await api.request(endpoints.applySchemaChange, { params: leads, body: change });
    expect(result.dataset.schemaVersion).toBe(dataset.schemaVersion + 1);

    await expect(
      api.request(endpoints.applySchemaChange, { params: leads, body: change }),
    ).rejects.toMatchObject({
      code: 'revision_conflict',
    });

    const dashboard = await api.request(endpoints.getDashboard, { params: { dashboardId: DASHBOARD_ID } });
    expect(dashboard.widgets.find((w) => w.id === 'wdg_revenue')?.status).toBe('needs_attention');
    await expect(
      api.request(endpoints.getWidgetData, {
        params: { dashboardId: DASHBOARD_ID, widgetId: 'wdg_revenue' },
      }),
    ).rejects.toMatchObject({ code: 'schema_incompatible' });
  });

  it('treats renames as safe because charts reference field IDs', async () => {
    const dataset = await api.request(endpoints.getDataset, { params: leads });
    const body = {
      expectedSchemaVersion: dataset.schemaVersion,
      changes: [{ op: 'renameField' as const, fieldId: 'fld_value', name: 'Deal size' }],
    };
    const impact = await api.request(endpoints.previewSchemaChange, { params: leads, body });
    expect(impact.requiresConfirmation).toBe(false);
    await api.request(endpoints.applySchemaChange, { params: leads, body });
    const data = await api.request(endpoints.getWidgetData, {
      params: { dashboardId: DASHBOARD_ID, widgetId: 'wdg_revenue' },
    });
    expect(data.rows.length).toBeGreaterThan(0);
  });
});

describe('charts and dashboards', () => {
  it('creates a chart draft with a preview and publishes it as a widget', async () => {
    const draft = await api.request(endpoints.createChartDraft, {
      body: { datasetId: LEADS_ID, prompt: 'Pipeline value by owner' },
    });
    expect(draft.definition.type).toBe('horizontalBar');
    expect(draft.preview.rows.length).toBe(4);

    const refined = await api.request(endpoints.createChartDraft, {
      body: { datasetId: LEADS_ID, prompt: 'as a donut', refineDraftId: draft.id },
    });
    expect(refined.definition.type).toBe('donut');

    const { dashboard, widgetId } = await api.request(endpoints.addWidget, {
      params: { dashboardId: DASHBOARD_ID },
      body: { chartDraftId: refined.id },
    });
    expect(dashboard.widgets.map((w) => w.id)).toContain(widgetId);
    expect(dashboard.layouts.lg.some((item) => item.i === widgetId)).toBe(true);
  });

  it('saves layouts with version checks', async () => {
    const dashboard = await api.request(endpoints.getDashboard, { params: { dashboardId: DASHBOARD_ID } });
    const layouts = {
      ...dashboard.layouts,
      lg: dashboard.layouts.lg.map((item) => ({ ...item, y: item.y + 1 })),
    };
    const saved = await api.request(endpoints.updateDashboardLayout, {
      params: { dashboardId: DASHBOARD_ID },
      body: { expectedVersion: dashboard.version, layouts },
    });
    expect(saved.version).toBe(dashboard.version + 1);
    await expect(
      api.request(endpoints.updateDashboardLayout, {
        params: { dashboardId: DASHBOARD_ID },
        body: { expectedVersion: dashboard.version, layouts },
      }),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
  });

  it('removes, restores and duplicates widgets', async () => {
    const params = { dashboardId: DASHBOARD_ID, widgetId: 'wdg_stage' };
    const removed = await api.request(endpoints.deleteWidget, { params });
    expect(removed.dashboard.widgets.some((w) => w.id === 'wdg_stage')).toBe(false);
    const restored = await api.request(endpoints.restoreWidget, { params });
    expect(restored.dashboard.layouts.lg.some((item) => item.i === 'wdg_stage')).toBe(true);
    const duplicated = await api.request(endpoints.duplicateWidget, { params });
    expect(duplicated.widgetId).not.toBe('wdg_stage');
  });

  it('returns query results for every seeded widget', async () => {
    const dashboard = await api.request(endpoints.getDashboard, { params: { dashboardId: DASHBOARD_ID } });
    for (const widget of dashboard.widgets.filter((w) => w.kind === 'chart')) {
      const data = await api.request(endpoints.getWidgetData, {
        params: { dashboardId: DASHBOARD_ID, widgetId: widget.id },
      });
      expect(data.rows.length, widget.id).toBeGreaterThan(0);
    }
  });
});

async function collectRun(runId: string) {
  const events: RunEvent[] = [];
  for await (const event of api.stream(endpoints.streamRunEvents, { params: { runId } })) events.push(event);
  const last = events
    .filter((e): e is Extract<RunEvent, { type: 'run.updated' }> => e.type === 'run.updated')
    .at(-1);
  return { events, run: last?.run as Run };
}

describe('actions and runs', () => {
  it('drafts, dry-runs, approves and runs an action', async () => {
    const draft = await api.request(endpoints.createActionDraft, {
      params: { workspaceId: WORKSPACE_ID },
      body: { prompt: 'Find new companies like our best customers', datasetId: LEADS_ID },
    });
    expect(draft.status).toBe('ready');
    expect(draft.manifest.permissions.map((p) => p.kind)).toContain('network');

    const dryRun = await api.request(endpoints.startDryRun, { params: { draftId: draft.id } });
    const { events, run: finishedDryRun } = await collectRun(dryRun.id);
    expect(events.some((e) => e.type === 'log')).toBe(true);
    expect(finishedDryRun.status).toBe('succeeded');
    expect(finishedDryRun.changes).toMatchObject({ inserts: 6, committed: false });

    const before = await api.request(endpoints.getDataset, { params: leads });
    await expect(
      api.request(endpoints.approveDraft, {
        params: { draftId: draft.id },
        body: { hash: 'tampered', dryRunId: dryRun.id, runNow: true },
      }),
    ).rejects.toMatchObject({ code: 'approval_invalidated' });

    const approved = await api.request(endpoints.approveDraft, {
      params: { draftId: draft.id },
      body: { hash: draft.hash, dryRunId: dryRun.id, runNow: true },
    });
    expect(approved.action.currentVersion.hash).toBe(draft.hash);
    const { run: live } = await collectRun(approved.run!.id);
    expect(live.changes?.committed).toBe(true);

    const after = await api.request(endpoints.getDataset, { params: leads });
    expect(after.recordCount).toBe(before.recordCount + 6);

    const runs = await api.request(endpoints.listRuns, { params: { actionId: approved.action.id } });
    expect(runs.items[0]?.id).toBe(approved.run!.id);
  });

  it('asks for more detail or refuses unsafe requests', async () => {
    const vague = await api.request(endpoints.createActionDraft, {
      params: { workspaceId: WORKSPACE_ID },
      body: { prompt: 'do stuff' },
    });
    expect(vague.status).toBe('needs_input');
    expect(vague.questions.length).toBeGreaterThan(0);
    const unsafe = await api.request(endpoints.createActionDraft, {
      params: { workspaceId: WORKSPACE_ID },
      body: { prompt: 'delete all the records' },
    });
    expect(unsafe.status).toBe('rejected');
  });

  it('manages schedules, pausing and manual runs', async () => {
    const list = await api.request(endpoints.listActions, { params: { workspaceId: WORKSPACE_ID } });
    expect(list.items.length).toBe(2);

    const scheduled = await api.request(endpoints.setSchedule, {
      params: { actionId: 'act_dedupe' },
      body: { cron: '0 9 * * 1-5', timezone: 'Europe/London', enabled: true },
    });
    expect(scheduled.schedule?.description).toBe('Every weekday at 09:00');

    await expect(
      api.request(endpoints.startRun, { params: { actionId: 'act_dedupe' } }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await api.request(endpoints.updateAction, {
      params: { actionId: 'act_dedupe' },
      body: { status: 'active' },
    });
    const run = await api.request(endpoints.startRun, { params: { actionId: 'act_dedupe' } });
    expect(run.trigger).toBe('manual');
    const fetched = await api.request(endpoints.getRun, { params: { runId: run.id } });
    expect(fetched.id).toBe(run.id);
    const cancelled = await api.request(endpoints.cancelRun, { params: { runId: run.id } });
    expect(['cancelled', 'succeeded']).toContain(cancelled.status);
    const action = await api.request(endpoints.getAction, { params: { actionId: 'act_dedupe' } });
    expect(action.lastRun?.id).toBe(run.id);
  });

  it('replays idempotent requests instead of repeating them', async () => {
    const first = await api.request(endpoints.startRun, {
      params: { actionId: 'act_enrich' },
      idempotencyKey: 'same-key',
    });
    const second = await api.request(endpoints.startRun, {
      params: { actionId: 'act_enrich' },
      idempotencyKey: 'same-key',
    });
    expect(second.id).toBe(first.id);
  });
});

describe('uploads', () => {
  it('issues a signed upload target and completes the upload', async () => {
    const ticket = await api.request(endpoints.createUpload, {
      params: { workspaceId: WORKSPACE_ID },
      body: { filename: 'card.png', contentType: 'image/png', size: 1024 },
    });
    expect(ticket.uploadUrl.startsWith(TEST_BASE_URL)).toBe(true);
    const put = await fetch(ticket.uploadUrl, { method: 'PUT', body: 'bytes', headers: ticket.headers });
    expect(put.ok).toBe(true);
    const upload = await api.request(endpoints.completeUpload, {
      params: { uploadId: ticket.upload.id },
      body: {},
    });
    expect(upload.status).toBe('ready');
  });

  it('rejects disallowed file types before upload', async () => {
    await expect(
      api.request(endpoints.createUpload, {
        params: { workspaceId: WORKSPACE_ID },
        // @ts-expect-error — the contract only allows specific content types
        body: { filename: 'x.exe', contentType: 'application/x-msdownload', size: 10 },
      }),
    ).rejects.toMatchObject({ code: 'validation_failed' });
  });
});
