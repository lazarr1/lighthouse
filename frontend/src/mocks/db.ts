import type {
  Action,
  ActionDraft,
  ApiErrorCode,
  CellValue,
  ChartDraft,
  ChartWidget,
  Dashboard,
  Dataset,
  DataRecord,
  Field,
  FieldType,
  Run,
  RunEvent,
  SchemaChange,
  SchemaImpact,
  Session,
  Upload,
} from '@/api/contract';
import { hashArtifact, planAction, planChart, type ActionPlan } from './ai';
import {
  DASHBOARD_ID,
  FIXTURE_NOW,
  generateLeads,
  LEADS_ID,
  pickSummary,
  SEED_SESSION,
  seedActions,
  seedDashboard,
  seedDataset,
  WORKSPACE_ID,
} from './fixtures';
import { MockQueryError, runQuery, validateQuery } from './queryEngine';

export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const notFound = (what: string) => new MockApiError(404, 'not_found', `${what} not found`);

export interface MockDbOptions {
  /** Delay between simulated run steps. Use 0 in tests. */
  stepDelayMs?: number;
  /** Number of seeded lead records. */
  recordCount?: number;
  now?: () => Date;
}

type RunListener = (event: RunEvent) => void;

interface ChangeSet {
  revert: () => string[];
}

/**
 * In-memory backend state. One instance per browser session (dev) or per test.
 * Behaviour mirrors the contract in `docs/BACKEND.md`: optimistic concurrency,
 * approvals bound to hashes, staged changes, soft deletes.
 */
export class MockDb {
  readonly session: Session = structuredClone(SEED_SESSION);
  readonly records: DataRecord[];
  readonly dataset: Dataset;
  dashboard: Dashboard;
  readonly deletedWidgets = new Map<
    string,
    { widget: Dashboard['widgets'][number]; layouts: Dashboard['layouts'] }
  >();
  readonly actions = new Map<string, Action>();
  readonly runs = new Map<string, Run>();
  readonly chartDrafts = new Map<string, ChartDraft>();
  readonly actionDrafts = new Map<string, ActionDraft & { plan: ActionPlan }>();
  readonly uploads = new Map<string, Upload>();
  readonly changeSets = new Map<string, ChangeSet>();
  private readonly runListeners = new Map<string, Set<RunListener>>();
  private readonly runLogs = new Map<string, RunEvent[]>();
  private sequence = 0;
  readonly stepDelayMs: number;
  readonly now: () => Date;

  constructor(options: MockDbOptions = {}) {
    this.stepDelayMs = options.stepDelayMs ?? 450;
    this.now = options.now ?? (() => new Date(Math.max(Date.now(), FIXTURE_NOW.getTime())));
    this.records = generateLeads(options.recordCount);
    this.dataset = seedDataset(this.records);
    this.refreshHealth();
    this.dashboard = seedDashboard();
    const { actions, runs } = seedActions();
    actions.forEach((action) => this.actions.set(action.id, action));
    runs.forEach((run) => this.runs.set(run.id, run));
  }

  nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}_${this.sequence.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }

  private timestamp() {
    return this.now().toISOString();
  }

  // ── Workspace / datasets ────────────────────────────────────────────────

  workspace(workspaceId: string) {
    if (workspaceId !== WORKSPACE_ID) throw notFound('Workspace');
    return {
      id: WORKSPACE_ID,
      name: 'Acme operations',
      role: 'owner' as const,
      datasets: [{ id: this.dataset.id, name: this.dataset.name, recordCount: this.records.length }],
      defaultDashboardId: DASHBOARD_ID,
    };
  }

  getDataset(datasetId: string) {
    if (datasetId !== this.dataset.id) throw notFound('Dataset');
    return this.dataset;
  }

  private touchData() {
    this.dataset.dataRevision += 1;
    this.dataset.recordCount = this.records.length;
    this.dataset.updatedAt = this.timestamp();
    this.refreshHealth();
  }

  private refreshHealth() {
    const needing = this.records.filter((record) => record.issues.length > 0).length;
    const ratio = this.records.length ? needing / this.records.length : 0;
    this.dataset.health = {
      score: Math.max(0, Math.round(100 - ratio * 800)),
      recordsNeedingReview: needing,
    };
  }

  // ── Records ────────────────────────────────────────────────────────────

  findRecord(datasetId: string, recordId: string) {
    this.getDataset(datasetId);
    const record = this.records.find((item) => item.id === recordId);
    if (!record) throw notFound('Record');
    return record;
  }

  validateValues(values: Record<string, CellValue>) {
    const errors: Record<string, string> = {};
    const fields = new Map(this.dataset.fields.map((field) => [field.id, field]));
    for (const [fieldId, value] of Object.entries(values)) {
      const field = fields.get(fieldId);
      if (!field) errors[fieldId] = 'Unknown field';
      else if (field.status === 'deprecated') errors[fieldId] = 'Field has been removed';
      else {
        const problem = valueProblem(field, value);
        if (problem) errors[fieldId] = problem;
      }
    }
    if (Object.keys(errors).length) {
      throw new MockApiError(422, 'validation_failed', 'Some values are not valid', { fields: errors });
    }
  }

  private computeIssues(record: DataRecord) {
    record.issues = this.dataset.fields
      .filter((field) => field.status === 'active')
      .flatMap((field): DataRecord['issues'] => {
        const value = record.values[field.id];
        if (field.id === 'fld_contact' && (value === null || value === '')) {
          return [{ fieldId: field.id, severity: 'warning', message: 'Contact is missing' }];
        }
        if (field.required && (value === null || value === '' || value === undefined)) {
          return [{ fieldId: field.id, severity: 'error', message: `${field.name} is required` }];
        }
        return [];
      });
  }

  createRecord(datasetId: string, values: Record<string, CellValue>, source?: DataRecord['source']) {
    this.getDataset(datasetId);
    this.validateValues(values);
    const now = this.timestamp();
    const record: DataRecord = {
      id: this.nextId('rec'),
      revision: 1,
      values: Object.fromEntries(this.dataset.fields.map((field) => [field.id, values[field.id] ?? null])),
      issues: [],
      source: source ?? { kind: 'manual', ref: null, label: 'Added by Lee Morris' },
      createdAt: now,
      updatedAt: now,
    };
    this.computeIssues(record);
    this.records.unshift(record);
    this.touchData();
    const changeSetId = this.registerChangeSet(() => {
      const index = this.records.indexOf(record);
      if (index >= 0) this.records.splice(index, 1);
      this.touchData();
      return [record.id];
    });
    return { record, changeSetId };
  }

  updateRecord(
    datasetId: string,
    recordId: string,
    values: Record<string, CellValue>,
    expectedRevision: number | null,
  ) {
    const record = this.findRecord(datasetId, recordId);
    if (expectedRevision === null)
      throw new MockApiError(428, 'validation_failed', 'If-Match header is required');
    if (record.revision !== expectedRevision) {
      throw new MockApiError(409, 'revision_conflict', 'The record changed since you loaded it', {
        current: record,
      });
    }
    this.validateValues(values);
    const before = structuredClone(record);
    Object.assign(record.values, values);
    record.revision += 1;
    record.updatedAt = this.timestamp();
    this.computeIssues(record);
    this.touchData();
    const changeSetId = this.registerChangeSet(() => {
      record.values = before.values;
      record.issues = before.issues;
      record.revision += 1;
      record.updatedAt = this.timestamp();
      this.touchData();
      return [record.id];
    });
    return { record, changeSetId };
  }

  deleteRecord(datasetId: string, recordId: string, expectedRevision: number | null) {
    const record = this.findRecord(datasetId, recordId);
    if (expectedRevision !== null && record.revision !== expectedRevision) {
      throw new MockApiError(409, 'revision_conflict', 'The record changed since you loaded it', {
        current: record,
      });
    }
    const index = this.records.indexOf(record);
    this.records.splice(index, 1);
    this.touchData();
    return {
      changeSetId: this.registerChangeSet(() => {
        this.records.splice(Math.min(index, this.records.length), 0, record);
        this.touchData();
        return [record.id];
      }),
    };
  }

  private registerChangeSet(revert: () => string[]) {
    const id = this.nextId('chg');
    this.changeSets.set(id, { revert });
    return id;
  }

  revertChangeSet(changeSetId: string) {
    const changeSet = this.changeSets.get(changeSetId);
    if (!changeSet) throw notFound('Change set');
    this.changeSets.delete(changeSetId);
    const affectedRecordIds = changeSet.revert();
    return { changeSetId: this.nextId('chg'), affectedRecordIds };
  }

  // ── Schema ─────────────────────────────────────────────────────────────

  private assertSchemaVersion(expected: number) {
    if (expected !== this.dataset.schemaVersion) {
      throw new MockApiError(409, 'revision_conflict', 'The schema changed since you loaded it', {
        current: this.dataset,
      });
    }
  }

  previewSchemaChange(
    datasetId: string,
    expectedSchemaVersion: number,
    changes: SchemaChange[],
  ): SchemaImpact {
    this.getDataset(datasetId);
    this.assertSchemaVersion(expectedSchemaVersion);
    const conversions: SchemaImpact['conversions'] = [];
    const touched = new Map<string, SchemaChange>();

    for (const change of changes) {
      if (change.op === 'addField') {
        if (this.dataset.fields.some((field) => field.name.toLowerCase() === change.name.toLowerCase())) {
          throw new MockApiError(422, 'validation_failed', `A field called “${change.name}” already exists`);
        }
        continue;
      }
      const field = this.fieldOrThrow(change.fieldId);
      touched.set(field.id, change);
      if (change.op === 'changeFieldType') {
        const examples: SchemaImpact['conversions'][number]['examples'] = [];
        let failed = 0;
        let convertible = 0;
        for (const record of this.records) {
          const value = record.values[field.id];
          if (value === null || value === undefined) continue;
          const converted = convertValue(field, change.type, value);
          if (converted.ok) convertible += 1;
          else {
            failed += 1;
            if (examples.length < 5)
              examples.push({ recordId: record.id, value: String(value), reason: converted.reason });
          }
        }
        conversions.push({ fieldId: field.id, convertible, failed, examples });
      }
    }

    const dependents: SchemaImpact['dependents'] = this.dashboard.widgets
      .filter((widget): widget is ChartWidget => widget.kind === 'chart')
      .filter((widget) => widget.definition.fieldDependencies.some((id) => touched.has(id)))
      .map((widget) => {
        const ops = widget.definition.fieldDependencies.map((id) => touched.get(id)?.op).filter(Boolean);
        const breaking = ops.includes('deprecateField') || ops.includes('changeFieldType');
        return {
          kind: 'widget' as const,
          id: widget.id,
          name: widget.definition.title,
          effect: breaking ? ('needs_attention' as const) : ('unaffected' as const),
          reason: breaking
            ? 'Uses a field whose type or availability is changing.'
            : 'Uses this field by ID, so a rename has no effect.',
        };
      });

    const failed = conversions.reduce((sum, item) => sum + item.failed, 0);
    const broken = dependents.filter((item) => item.effect !== 'unaffected').length;
    const deprecations = changes.filter((change) => change.op === 'deprecateField').length;
    const parts: string[] = [];
    if (failed)
      parts.push(`${failed} value${failed === 1 ? '' : 's'} can’t be converted and will be kept for review`);
    if (broken) parts.push(`${broken} chart${broken === 1 ? '' : 's'} will need attention`);
    if (deprecations) parts.push('hidden fields keep their data and can be restored');
    return {
      requiresConfirmation: failed > 0 || broken > 0 || deprecations > 0,
      summary: parts.length ? capitalise(parts.join('; ')) + '.' : 'This change is safe to apply.',
      conversions,
      dependents,
    };
  }

  applySchemaChange(datasetId: string, expectedSchemaVersion: number, changes: SchemaChange[]) {
    this.previewSchemaChange(datasetId, expectedSchemaVersion, changes);
    const snapshot = structuredClone({
      fields: this.dataset.fields,
      values: this.records.map((record) => record.values),
    });

    for (const change of changes) {
      switch (change.op) {
        case 'addField': {
          const field: Field = {
            id: this.nextId('fld'),
            name: change.name,
            type: change.type,
            description: '',
            required: false,
            status: 'active',
            config: change.config ?? defaultConfig(change.type),
          };
          this.dataset.fields.push(field);
          this.records.forEach((record) => (record.values[field.id] = null));
          break;
        }
        case 'renameField':
          this.fieldOrThrow(change.fieldId).name = change.name;
          break;
        case 'changeFieldType': {
          const field = this.fieldOrThrow(change.fieldId);
          for (const record of this.records) {
            const value = record.values[field.id];
            if (value === null || value === undefined) continue;
            const converted = convertValue(field, change.type, value);
            if (converted.ok) record.values[field.id] = converted.value;
            else {
              record.values[field.id] = null;
              record.issues.push({
                fieldId: field.id,
                severity: 'warning',
                message: `Couldn’t convert “${String(value)}”`,
              });
            }
          }
          field.type = change.type;
          field.config = change.config ?? defaultConfig(change.type, field.config);
          break;
        }
        case 'updateFieldConfig':
          Object.assign(this.fieldOrThrow(change.fieldId).config, change.config);
          break;
        case 'deprecateField':
          this.fieldOrThrow(change.fieldId).status = 'deprecated';
          break;
        case 'restoreField':
          this.fieldOrThrow(change.fieldId).status = 'active';
          break;
      }
    }

    this.dataset.schemaVersion += 1;
    this.revalidateWidgets();
    this.touchData();
    const changeSetId = this.registerChangeSet(() => {
      this.dataset.fields = snapshot.fields;
      this.records.forEach((record, index) => (record.values = snapshot.values[index] ?? record.values));
      this.dataset.schemaVersion += 1;
      this.revalidateWidgets();
      this.touchData();
      return [];
    });
    return { dataset: this.dataset, changeSetId };
  }

  private fieldOrThrow(fieldId: string) {
    const field = this.dataset.fields.find((item) => item.id === fieldId);
    if (!field) throw new MockApiError(422, 'validation_failed', `Unknown field ${fieldId}`);
    return field;
  }

  private revalidateWidgets() {
    for (const widget of this.dashboard.widgets) {
      if (widget.kind !== 'chart') continue;
      const issues = validateQuery(this.dataset, widget.definition.query);
      widget.status = issues.length ? 'needs_attention' : 'ok';
      widget.issues = issues;
    }
    this.dashboard.version += 1;
  }

  // ── Dashboards & charts ────────────────────────────────────────────────

  getDashboard(dashboardId: string) {
    if (dashboardId !== this.dashboard.id) throw notFound('Dashboard');
    return this.dashboard;
  }

  updateLayout(dashboardId: string, expectedVersion: number, layouts: Dashboard['layouts']) {
    const dashboard = this.getDashboard(dashboardId);
    if (dashboard.version !== expectedVersion) {
      throw new MockApiError(409, 'revision_conflict', 'The dashboard changed since you loaded it', {
        current: dashboard,
      });
    }
    const ids = new Set(dashboard.widgets.map((widget) => widget.id));
    for (const items of Object.values(layouts)) {
      const unknown = items.find((item) => !ids.has(item.i));
      if (unknown)
        throw new MockApiError(422, 'validation_failed', `Layout references unknown widget ${unknown.i}`);
    }
    dashboard.layouts = layouts;
    dashboard.version += 1;
    dashboard.updatedAt = this.timestamp();
    return dashboard;
  }

  createChartDraft(datasetId: string, prompt: string, refineDraftId?: string): ChartDraft {
    const dataset = this.getDataset(datasetId);
    const previous = refineDraftId ? this.chartDrafts.get(refineDraftId) : undefined;
    if (refineDraftId && !previous) throw notFound('Chart draft');
    const combinedPrompt = previous ? `${previous.prompt}. ${prompt}` : prompt;
    const plan = planChart(dataset, combinedPrompt);
    const draft: ChartDraft = {
      id: this.nextId('chd'),
      datasetId,
      prompt: combinedPrompt,
      definition: plan.definition,
      explanation: plan.explanation,
      preview: runQuery(dataset, this.records, plan.definition.query, this.now()),
      warnings: plan.warnings,
      createdAt: this.timestamp(),
    };
    this.chartDrafts.set(draft.id, draft);
    return draft;
  }

  addWidget(dashboardId: string, chartDraftId: string) {
    const dashboard = this.getDashboard(dashboardId);
    const draft = this.chartDrafts.get(chartDraftId);
    if (!draft) throw notFound('Chart draft');
    const widget: ChartWidget = {
      id: this.nextId('wdg'),
      kind: 'chart',
      chartVersionId: this.nextId('chv'),
      definition: draft.definition,
      status: 'ok',
      issues: [],
      createdAt: this.timestamp(),
    };
    this.insertWidget(
      dashboard,
      widget,
      draft.definition.type === 'metric' ? 2 : 5,
      draft.definition.type === 'metric' ? 4 : 6,
    );
    return { dashboard, widgetId: widget.id };
  }

  duplicateWidget(dashboardId: string, widgetId: string) {
    const dashboard = this.getDashboard(dashboardId);
    const source = dashboard.widgets.find((widget) => widget.id === widgetId);
    if (!source) throw notFound('Widget');
    const copy = { ...structuredClone(source), id: this.nextId('wdg'), createdAt: this.timestamp() };
    const size = dashboard.layouts.lg.find((item) => item.i === widgetId);
    this.insertWidget(dashboard, copy, size?.h ?? 5, size?.w ?? 6);
    return { dashboard, widgetId: copy.id };
  }

  private insertWidget(dashboard: Dashboard, widget: Dashboard['widgets'][number], h: number, w: number) {
    dashboard.widgets.push(widget);
    const bottom = (items: Dashboard['layouts']['lg']) =>
      items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    dashboard.layouts = {
      lg: [...dashboard.layouts.lg, { i: widget.id, x: 0, y: bottom(dashboard.layouts.lg), w, h }],
      md: [
        ...dashboard.layouts.md,
        { i: widget.id, x: 0, y: bottom(dashboard.layouts.md), w: Math.max(w, 6), h },
      ],
      sm: [...dashboard.layouts.sm, { i: widget.id, x: 0, y: bottom(dashboard.layouts.sm), w: 1, h }],
    };
    dashboard.version += 1;
    dashboard.updatedAt = this.timestamp();
  }

  deleteWidget(dashboardId: string, widgetId: string) {
    const dashboard = this.getDashboard(dashboardId);
    const widget = dashboard.widgets.find((item) => item.id === widgetId);
    if (!widget) throw notFound('Widget');
    this.deletedWidgets.set(widgetId, { widget, layouts: structuredClone(dashboard.layouts) });
    dashboard.widgets = dashboard.widgets.filter((item) => item.id !== widgetId);
    dashboard.layouts = {
      lg: dashboard.layouts.lg.filter((item) => item.i !== widgetId),
      md: dashboard.layouts.md.filter((item) => item.i !== widgetId),
      sm: dashboard.layouts.sm.filter((item) => item.i !== widgetId),
    };
    dashboard.version += 1;
    return { dashboard, widgetId };
  }

  restoreWidget(dashboardId: string, widgetId: string) {
    const dashboard = this.getDashboard(dashboardId);
    const deleted = this.deletedWidgets.get(widgetId);
    if (!deleted) throw notFound('Deleted widget');
    this.deletedWidgets.delete(widgetId);
    dashboard.widgets.push(deleted.widget);
    const restoreIn = (key: keyof Dashboard['layouts']) => {
      const item = deleted.layouts[key].find((entry) => entry.i === widgetId);
      return item ? [...dashboard.layouts[key], item] : dashboard.layouts[key];
    };
    dashboard.layouts = { lg: restoreIn('lg'), md: restoreIn('md'), sm: restoreIn('sm') };
    dashboard.version += 1;
    return { dashboard, widgetId };
  }

  widgetData(dashboardId: string, widgetId: string) {
    const dashboard = this.getDashboard(dashboardId);
    const widget = dashboard.widgets.find((item) => item.id === widgetId);
    if (!widget) throw notFound('Widget');
    if (widget.kind !== 'chart') throw new MockApiError(422, 'validation_failed', 'Widget has no query');
    try {
      return runQuery(this.dataset, this.records, widget.definition.query, this.now());
    } catch (error) {
      if (error instanceof MockQueryError) throw new MockApiError(422, 'schema_incompatible', error.message);
      throw error;
    }
  }

  // ── Uploads ────────────────────────────────────────────────────────────

  createUpload(filename: string, contentType: string, size: number) {
    const upload: Upload = {
      id: this.nextId('upl'),
      filename,
      contentType,
      size,
      status: 'pending',
      createdAt: this.timestamp(),
    };
    this.uploads.set(upload.id, upload);
    return upload;
  }

  completeUpload(uploadId: string) {
    const upload = this.uploads.get(uploadId);
    if (!upload) throw notFound('Upload');
    upload.status = 'ready';
    return upload;
  }

  // ── Action drafts, approvals and runs ──────────────────────────────────

  createActionDraft(workspaceId: string, prompt: string, attachmentIds: string[], actionId?: string) {
    this.workspace(workspaceId);
    for (const id of attachmentIds) if (!this.uploads.has(id)) throw notFound(`Upload ${id}`);
    if (actionId && !this.actions.has(actionId)) throw notFound('Action');
    const plan = planAction(this.dataset, prompt, attachmentIds.length > 0);
    const draft = {
      id: this.nextId('acd'),
      workspaceId,
      actionId: actionId ?? null,
      prompt,
      attachmentIds,
      status: plan.status,
      title: plan.title,
      interpretation: plan.interpretation,
      steps: plan.steps,
      manifest: plan.manifest,
      hash: hashArtifact({ steps: plan.steps, manifest: plan.manifest, prompt, attachmentIds }),
      questions: plan.questions,
      rejectionReason: plan.rejectionReason,
      createdAt: this.timestamp(),
      plan,
    };
    this.actionDrafts.set(draft.id, draft);
    return draft;
  }

  getActionDraft(draftId: string) {
    const draft = this.actionDrafts.get(draftId);
    if (!draft) throw notFound('Action draft');
    return draft;
  }

  startDryRun(draftId: string) {
    const draft = this.getActionDraft(draftId);
    if (draft.status !== 'ready')
      throw new MockApiError(422, 'validation_failed', 'Only ready drafts can be dry-run');
    return this.startRunFor({
      draftId,
      actionId: null,
      hash: draft.hash,
      steps: draft.steps,
      plan: draft.plan,
      mode: 'dry_run',
      trigger: 'manual',
    });
  }

  approveDraft(draftId: string, hash: string, dryRunId: string, runNow: boolean) {
    const draft = this.getActionDraft(draftId);
    const dryRun = this.runs.get(dryRunId);
    if (hash !== draft.hash) {
      throw new MockApiError(
        409,
        'approval_invalidated',
        'The action changed after you reviewed it. Review it again.',
      );
    }
    if (
      !dryRun ||
      dryRun.draftId !== draftId ||
      dryRun.artifactHash !== hash ||
      dryRun.status !== 'succeeded'
    ) {
      throw new MockApiError(
        409,
        'approval_invalidated',
        'Approval requires a successful preview of this exact version.',
      );
    }
    const now = this.timestamp();
    const existing = draft.actionId ? this.actions.get(draft.actionId) : undefined;
    const version = {
      id: this.nextId('acv'),
      version: (existing?.currentVersion.version ?? 0) + 1,
      hash,
      steps: draft.steps,
      manifest: draft.manifest,
      approvedBy: this.session.user.name,
      approvedAt: now,
    };
    const action: Action = existing
      ? { ...existing, currentVersion: version, updatedAt: now }
      : {
          id: this.nextId('act'),
          workspaceId: draft.workspaceId,
          name: draft.title,
          description: draft.interpretation,
          status: 'active',
          currentVersion: version,
          schedule: null,
          lastRun: null,
          createdAt: now,
          updatedAt: now,
        };
    this.actions.set(action.id, action);
    draft.actionId = action.id;
    const run = runNow
      ? this.startRunFor({
          draftId,
          actionId: action.id,
          hash,
          steps: draft.steps,
          plan: draft.plan,
          mode: 'live',
          trigger: 'approval',
        })
      : null;
    return { action: this.actions.get(action.id) as Action, run };
  }

  getAction(actionId: string) {
    const action = this.actions.get(actionId);
    if (!action) throw notFound('Action');
    return action;
  }

  updateAction(actionId: string, status: Action['status']) {
    const action = this.getAction(actionId);
    action.status = status;
    action.updatedAt = this.timestamp();
    if (action.schedule)
      action.schedule.nextRunAt =
        status === 'active' && action.schedule.enabled ? nextWeekday(this.now()) : null;
    return action;
  }

  setSchedule(actionId: string, cron: string, timezone: string, enabled: boolean) {
    const action = this.getAction(actionId);
    if (cron.trim().split(/\s+/).length !== 5) {
      throw new MockApiError(422, 'validation_failed', 'Schedule must be a 5-field cron expression', {
        fields: { cron: 'Invalid cron' },
      });
    }
    action.schedule = {
      cron,
      timezone,
      enabled,
      description: describeCron(cron),
      nextRunAt: enabled && action.status === 'active' ? nextWeekday(this.now()) : null,
    };
    action.updatedAt = this.timestamp();
    return action;
  }

  startLiveRun(actionId: string) {
    const action = this.getAction(actionId);
    if (action.status === 'paused')
      throw new MockApiError(403, 'forbidden', 'This action is paused. Resume it to run it.');
    const plan = [...this.actionDrafts.values()].find((draft) => draft.actionId === actionId)?.plan ?? {
      kind: action.id === 'act_dedupe' ? ('dedupe' as const) : ('none' as const),
    };
    return this.startRunFor({
      draftId: null,
      actionId,
      hash: action.currentVersion.hash,
      steps: action.currentVersion.steps,
      plan: plan as ActionPlan,
      mode: 'live',
      trigger: 'manual',
    });
  }

  listRuns(actionId: string) {
    this.getAction(actionId);
    return [...this.runs.values()]
      .filter((run) => run.actionId === actionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) throw notFound('Run');
    return run;
  }

  cancelRun(runId: string) {
    const run = this.getRun(runId);
    if (run.status === 'queued' || run.status === 'running') {
      run.status = 'cancelled';
      run.finishedAt = this.timestamp();
      run.steps = run.steps.map((s) => (s.status === 'succeeded' ? s : { ...s, status: 'skipped' }));
      run.changes = null;
      this.emit(run.id, { type: 'run.updated', run: structuredClone(run) });
    }
    return run;
  }

  /** Subscribe to a run's events. Replays logs and the current snapshot first. */
  subscribe(runId: string, listener: RunListener) {
    const run = this.getRun(runId);
    for (const event of this.runLogs.get(runId) ?? []) listener(event);
    listener({ type: 'run.updated', run: structuredClone(run) });
    const listeners = this.runListeners.get(runId) ?? new Set();
    listeners.add(listener);
    this.runListeners.set(runId, listeners);
    return () => listeners.delete(listener);
  }

  private emit(runId: string, event: RunEvent) {
    if (event.type === 'log') this.runLogs.set(runId, [...(this.runLogs.get(runId) ?? []), event]);
    this.runListeners.get(runId)?.forEach((listener) => listener(event));
  }

  private log(runId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.emit(runId, { type: 'log', at: this.timestamp(), level, message });
  }

  private startRunFor(input: {
    draftId: string | null;
    actionId: string | null;
    hash: string;
    steps: { id: string; title: string }[];
    plan: ActionPlan;
    mode: Run['mode'];
    trigger: Run['trigger'];
  }) {
    const run: Run = {
      id: this.nextId('run'),
      actionId: input.actionId,
      draftId: input.draftId,
      artifactHash: input.hash,
      mode: input.mode,
      trigger: input.trigger,
      status: 'queued',
      steps: input.steps.map((step) => ({ stepId: step.id, status: 'pending', message: null })),
      changes: null,
      error: null,
      createdAt: this.timestamp(),
      startedAt: null,
      finishedAt: null,
    };
    this.runs.set(run.id, run);
    if (input.actionId) {
      const action = this.actions.get(input.actionId);
      if (action) action.lastRun = pickSummary(run);
    }
    this.simulate(run, input.steps, input.plan);
    return structuredClone(run);
  }

  private simulate(run: Run, steps: { id: string; title: string }[], plan: ActionPlan) {
    let index = -1;
    const tick = () => {
      if (run.status === 'cancelled') return;
      if (index === -1) {
        run.status = 'running';
        run.startedAt = this.timestamp();
        this.log(
          run.id,
          run.mode === 'dry_run' ? 'Started preview against a read-only snapshot.' : 'Started run.',
        );
      } else {
        const current = run.steps[index];
        if (current) current.status = 'succeeded';
      }
      index += 1;
      const next = run.steps[index];
      const step = steps[index];
      if (next && step) {
        next.status = 'running';
        this.log(run.id, `${step.title}…`);
        this.emit(run.id, { type: 'run.updated', run: structuredClone(run) });
        setTimeout(tick, this.stepDelayMs);
        return;
      }
      run.changes = this.proposeChanges(run, plan);
      if (run.mode === 'live') this.commit(run);
      run.status = 'succeeded';
      run.finishedAt = this.timestamp();
      const action = run.actionId ? this.actions.get(run.actionId) : undefined;
      if (action) action.lastRun = pickSummary(run);
      this.log(
        run.id,
        run.mode === 'dry_run' ? 'Preview ready. Nothing has been changed.' : 'Changes committed.',
      );
      this.emit(run.id, { type: 'run.updated', run: structuredClone(run) });
    };
    setTimeout(tick, this.stepDelayMs);
  }

  private proposeChanges(run: Run, plan: ActionPlan): Run['changes'] {
    const base = { datasetId: this.dataset.id, committed: false, changeSetId: null };
    if (plan.kind === 'research') {
      const names = [
        'Tidewater Robotics',
        'Kestrel Health',
        'Brookline Energy',
        'Quarry Analytics',
        'Lantern Foods',
        'Meridian Cloud',
      ];
      return {
        ...base,
        inserts: names.length,
        updates: 0,
        duplicatesSkipped: 2,
        rejected: 0,
        sample: [
          ...names.map((name) => ({
            kind: 'insert' as const,
            recordId: null,
            values: {
              fld_company: name,
              fld_stage: 'stg_prospecting',
              fld_source: 'src_ai',
              fld_website: `https://${name.toLowerCase().replace(/\s+/g, '')}.example.com`,
            },
            reason: null,
          })),
          {
            kind: 'duplicate' as const,
            recordId: 'rec_00001',
            values: { fld_company: 'Northstar Labs' },
            reason: 'Already in Leads (same website)',
          },
          {
            kind: 'duplicate' as const,
            recordId: 'rec_00002',
            values: { fld_company: 'Formwork' },
            reason: 'Already in Leads (same website)',
          },
        ],
      };
    }
    if (plan.kind === 'image') {
      const draft = run.draftId ? this.actionDrafts.get(run.draftId) : undefined;
      const upload = draft?.attachmentIds[0] ? this.uploads.get(draft.attachmentIds[0]) : undefined;
      const company = upload ? titleFromFilename(upload.filename) : 'Imported lead';
      return {
        ...base,
        inserts: 1,
        updates: 0,
        duplicatesSkipped: 0,
        rejected: 0,
        sample: [
          {
            kind: 'insert',
            recordId: null,
            values: {
              fld_company: company,
              fld_contact: 'Jordan Avery',
              fld_stage: 'stg_prospecting',
              fld_source: 'src_image',
            },
            reason: 'Contact name read with 78% confidence',
          },
        ],
      };
    }
    if (plan.kind === 'dedupe') {
      const pairs = this.records.slice(12, 16);
      return {
        ...base,
        inserts: 0,
        updates: pairs.length,
        duplicatesSkipped: 0,
        rejected: 0,
        sample: pairs.map((record) => ({
          kind: 'update',
          recordId: record.id,
          values: { fld_company: record.values.fld_company ?? null },
          reason: 'Merged with a matching record',
        })),
      };
    }
    return { ...base, inserts: 0, updates: 0, duplicatesSkipped: 0, rejected: 0, sample: [] };
  }

  private commit(run: Run) {
    const changes = run.changes;
    if (!changes) return;
    const created: DataRecord[] = [];
    const source = { kind: 'action' as const, ref: run.id, label: 'Added by an action' };
    for (const sample of changes.sample) {
      if (sample.kind === 'insert')
        created.push(this.createRecord(this.dataset.id, sample.values, source).record);
    }
    changes.committed = true;
    changes.changeSetId = this.registerChangeSet(() => {
      for (const record of created) {
        const index = this.records.indexOf(record);
        if (index >= 0) this.records.splice(index, 1);
      }
      this.touchData();
      return created.map((record) => record.id);
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function titleFromFilename(filename: string) {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base ? base.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Imported lead';
}

function defaultConfig(type: FieldType, previous: Field['config'] = {}): Field['config'] {
  if (type === 'money') return { currency: previous.currency ?? 'USD', decimals: 0 };
  if (type === 'singleSelect' || type === 'multiSelect') return { choices: previous.choices ?? [] };
  return {};
}

function valueProblem(field: Field, value: CellValue): string | null {
  if (value === null) return field.required ? `${field.name} is required` : null;
  switch (field.type) {
    case 'number':
    case 'money':
    case 'percent':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'Must be a number';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Must be yes or no';
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? null
        : 'Must be a date (YYYY-MM-DD)';
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? null : 'Must be a date and time';
    case 'singleSelect':
      return typeof value === 'string' && field.config.choices?.some((c) => c.id === value)
        ? null
        : 'Not one of the options';
    case 'multiSelect':
      return Array.isArray(value) && value.every((id) => field.config.choices?.some((c) => c.id === id))
        ? null
        : 'Not one of the options';
    case 'url':
      return typeof value === 'string' && /^https?:\/\/\S+$/.test(value) ? null : 'Must be a web address';
    default:
      return typeof value === 'string' ? null : 'Must be text';
  }
}

function convertValue(
  field: Field,
  to: FieldType,
  value: CellValue,
): { ok: true; value: CellValue } | { ok: false; reason: string } {
  const label = (id: string) => field.config.choices?.find((c) => c.id === id)?.label ?? id;
  const text = Array.isArray(value)
    ? value.map(label).join(', ')
    : field.type === 'singleSelect'
      ? label(String(value))
      : String(value);
  switch (to) {
    case 'text':
    case 'longText':
      return { ok: true, value: text };
    case 'number':
    case 'money':
    case 'percent': {
      const number = typeof value === 'number' ? value : Number(text.replace(/[$,%\s]/g, ''));
      return Number.isFinite(number) && text.trim() !== ''
        ? { ok: true, value: number }
        : { ok: false, reason: 'Not a number' };
    }
    case 'boolean':
      if (typeof value === 'boolean') return { ok: true, value };
      if (/^(yes|true|1)$/i.test(text)) return { ok: true, value: true };
      if (/^(no|false|0)$/i.test(text)) return { ok: false, reason: 'Not yes/no' };
      return { ok: false, reason: 'Not yes/no' };
    case 'date':
    case 'datetime': {
      const time = Date.parse(text);
      if (Number.isNaN(time)) return { ok: false, reason: 'Not a date' };
      const date = new Date(time).toISOString();
      return { ok: true, value: to === 'date' ? date.slice(0, 10) : date };
    }
    case 'url':
      return /^https?:\/\//.test(text)
        ? { ok: true, value: text }
        : { ok: false, reason: 'Not a web address' };
    default:
      return { ok: false, reason: 'Can’t convert to options automatically' };
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeCron(cron: string): string {
  const [minute = '0', hour = '*', , , weekday = '*'] = cron.trim().split(/\s+/);
  const time =
    hour === '*'
      ? `every hour at :${minute.padStart(2, '0')}`
      : `at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  if (hour === '*') return capitalise(time);
  if (weekday === '*') return `Every day ${time}`;
  if (weekday === '1-5') return `Every weekday ${time}`;
  const day = DAY_NAMES[Number(weekday)];
  return day ? `Every ${day} ${time}` : `Custom schedule (${cron})`;
}

function nextWeekday(now: Date) {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(8, 0, 0, 0);
  return next.toISOString();
}

export { LEADS_ID, WORKSPACE_ID, DASHBOARD_ID };
