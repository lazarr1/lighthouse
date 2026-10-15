import type {
  Action,
  Choice,
  Dashboard,
  Dataset,
  DataRecord,
  Field,
  Run,
  Session,
  Widget,
} from '@/api/contract';

/** All fixture timestamps are relative to this instant so seeds are deterministic. */
export const FIXTURE_NOW = new Date('2026-10-15T09:00:00Z');

export const WORKSPACE_ID = 'ws_acme';
export const LEADS_ID = 'ds_leads';
export const DASHBOARD_ID = 'db_overview';

const iso = (date: Date) => date.toISOString();
const daysAgo = (days: number, hour = 9) => {
  const date = new Date(FIXTURE_NOW);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return date;
};

/** Small deterministic PRNG (mulberry32). */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

const choice = (id: string, label: string, color: Choice['color']): Choice => ({ id, label, color });

export const STAGES = [
  choice('stg_prospecting', 'Prospecting', 'grey'),
  choice('stg_qualified', 'Qualified', 'blue'),
  choice('stg_proposal', 'Proposal', 'amber'),
  choice('stg_negotiation', 'Negotiation', 'amber'),
  choice('stg_won', 'Won', 'green'),
  choice('stg_lost', 'Lost', 'red'),
];
export const OPEN_STAGE_IDS = ['stg_prospecting', 'stg_qualified', 'stg_proposal', 'stg_negotiation'];

const OWNERS = [
  choice('own_priya', 'Priya Shah', 'green'),
  choice('own_sam', 'Sam Reed', 'blue'),
  choice('own_jess', 'Jess Wu', 'purple'),
  choice('own_lee', 'Lee Morris', 'amber'),
];

const SOURCES = [
  choice('src_website', 'Website', 'blue'),
  choice('src_referral', 'Referral', 'green'),
  choice('src_outbound', 'Outbound', 'grey'),
  choice('src_partner', 'Partner', 'purple'),
  choice('src_ai', 'AI research', 'blue'),
  choice('src_image', 'Image import', 'amber'),
];

const field = (
  partial: Omit<Field, 'description' | 'required' | 'status' | 'config'> & Partial<Field>,
): Field => ({
  description: '',
  required: false,
  status: 'active',
  config: {},
  ...partial,
});

export const LEAD_FIELDS: Field[] = [
  field({ id: 'fld_company', name: 'Company', type: 'text', required: true }),
  field({ id: 'fld_contact', name: 'Contact', type: 'text' }),
  field({ id: 'fld_owner', name: 'Owner', type: 'singleSelect', config: { choices: OWNERS } }),
  field({ id: 'fld_stage', name: 'Stage', type: 'singleSelect', config: { choices: STAGES } }),
  field({ id: 'fld_value', name: 'Value', type: 'money', config: { currency: 'USD', decimals: 0 } }),
  field({ id: 'fld_source', name: 'Source', type: 'singleSelect', config: { choices: SOURCES } }),
  field({ id: 'fld_priority', name: 'Priority', type: 'boolean' }),
  field({ id: 'fld_close', name: 'Close date', type: 'date' }),
  field({ id: 'fld_activity', name: 'Last activity', type: 'datetime' }),
  field({ id: 'fld_website', name: 'Website', type: 'url' }),
];

type Seed = [
  company: string,
  contact: string,
  owner: string,
  stage: string,
  value: number,
  source: string,
  days: number,
];

/** The rows shown in the original prototype, kept so the app feels familiar. */
const PROTOTYPE_ROWS: Seed[] = [
  ['Northstar Labs', 'Mia Lopez', 'own_priya', 'stg_qualified', 18400, 'src_website', 0],
  ['Formwork', 'Ethan Cole', 'own_sam', 'stg_proposal', 32000, 'src_referral', 0],
  ['Lumen Works', 'Erin Kim', 'own_jess', 'stg_prospecting', 8750, 'src_outbound', 1],
  ['Evergreen Co.', 'Jordan Bell', 'own_priya', 'stg_negotiation', 41600, 'src_website', 1],
  ['Daymark', 'Noah Green', 'own_lee', 'stg_qualified', 12000, 'src_partner', 18],
  ['Fieldnote', 'Ava Sinclair', 'own_sam', 'stg_proposal', 24500, 'src_outbound', 19],
  ['Brightline', 'Drew Price', 'own_jess', 'stg_prospecting', 6400, 'src_website', 20],
  ['Waypoint AI', 'Aria Stone', 'own_priya', 'stg_won', 19800, 'src_referral', 21],
  ['Harbor & Co.', 'Theo Moss', 'own_lee', 'stg_qualified', 15250, 'src_outbound', 22],
  ['Common Thread', 'Sasha Ford', 'own_sam', 'stg_lost', 9900, 'src_website', 23],
  ['Morrow Studio', 'Ivy Lane', 'own_jess', 'stg_prospecting', 5600, 'src_partner', 25],
  ['Rivet Systems', 'Owen Ross', 'own_lee', 'stg_proposal', 28300, 'src_referral', 26],
];

const NAME_A = [
  'North',
  'Blue',
  'Iron',
  'Cedar',
  'Silver',
  'Bright',
  'Harbor',
  'Summit',
  'Copper',
  'Willow',
  'Atlas',
  'Pine',
  'Granite',
  'Echo',
  'Maple',
  'Signal',
  'Orbit',
  'Coral',
  'Juniper',
  'Kite',
];
const NAME_B = [
  'Labs',
  'Works',
  'Systems',
  'Studio',
  'Partners',
  'Analytics',
  'Logistics',
  'Health',
  'Foods',
  'Robotics',
  'Energy',
  'Supply',
  'Media',
  'Capital',
  'Cloud',
];
const FIRST = [
  'Alex',
  'Jamie',
  'Morgan',
  'Riley',
  'Casey',
  'Taylor',
  'Jordan',
  'Avery',
  'Quinn',
  'Rowan',
  'Harper',
  'Skyler',
  'Emerson',
  'Finley',
  'Reese',
];
const LAST = [
  'Nguyen',
  'Patel',
  'Garcia',
  'Okafor',
  'Kim',
  'Silva',
  'Novak',
  'Haddad',
  'Larsen',
  'Moreau',
  'Tanaka',
  'Fischer',
  'Costa',
  'Byrne',
];

export const TOTAL_LEADS = 2481;

export function generateLeads(count = TOTAL_LEADS, random = createRandom(42)): DataRecord[] {
  const records: DataRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const seed: Seed = PROTOTYPE_ROWS[index] ?? [
      `${random.pick(NAME_A)} ${random.pick(NAME_B)}${index % 7 === 0 ? ` ${index}` : ''}`,
      `${random.pick(FIRST)} ${random.pick(LAST)}`,
      random.pick(OWNERS).id,
      random.pick(STAGES).id,
      random.int(20, 600) * 100,
      random.pick(SOURCES.slice(0, 4)).id,
      random.int(0, 364),
    ];
    const [company, contact, owner, stage, value, source, days] = seed;
    const created = daysAgo(days + random.int(5, 60));
    const activity = daysAgo(days, 8 + (index % 9));
    const closed = stage === 'stg_won' || stage === 'stg_lost';
    // Every ~138th record is missing a contact so "Data health" has something to show.
    const needsReview = index > 11 && index % 138 === 0;
    const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '');
    records.push({
      id: `rec_${String(index + 1).padStart(5, '0')}`,
      revision: 1,
      values: {
        fld_company: company,
        fld_contact: needsReview ? null : contact,
        fld_owner: owner,
        fld_stage: stage,
        fld_value: value,
        fld_source: source,
        fld_priority: value > 40000,
        fld_close: closed ? iso(daysAgo(days)).slice(0, 10) : null,
        fld_activity: iso(activity),
        fld_website: `https://${slug}.example.com`,
      },
      issues: needsReview
        ? [{ fieldId: 'fld_contact', severity: 'warning', message: 'Contact is missing' }]
        : [],
      source: { kind: 'import', ref: 'upl_initial_csv', label: 'CRM export (CSV)' },
      createdAt: iso(created),
      updatedAt: iso(activity),
    });
  }
  return records;
}

export function seedDataset(records: DataRecord[]): Dataset {
  return {
    id: LEADS_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Leads',
    description: 'Companies and opportunities in the sales pipeline.',
    primaryFieldId: 'fld_company',
    fields: structuredClone(LEAD_FIELDS),
    recordCount: records.length,
    schemaVersion: 1,
    dataRevision: 1,
    health: { score: 94, recordsNeedingReview: 0 },
    updatedAt: iso(FIXTURE_NOW),
  };
}

export const SEED_SESSION: Session = {
  user: { id: 'usr_lm', name: 'Lee Morris', email: 'lee@acme.example' },
  workspaces: [{ id: WORKSPACE_ID, name: 'Acme operations', role: 'owner' }],
};

const openStages = { fieldId: 'fld_stage', op: 'in' as const, value: OPEN_STAGE_IDS };

export function seedDashboard(): Dashboard {
  const created = iso(daysAgo(30));
  const widgets: Widget[] = [
    {
      id: 'wdg_total',
      kind: 'chart',
      chartVersionId: 'chv_total_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'metric',
        title: 'Total records',
        subtitle: 'All leads',
        query: {
          datasetId: LEADS_ID,
          select: [{ as: 'records', aggregate: 'count' }],
          filters: [],
          groupBy: [],
          orderBy: [],
          limit: 1,
        },
        encoding: { value: 'records' },
        format: { style: 'number', compact: false },
        accessibilitySummary: 'Total number of lead records.',
        schemaVersion: 1,
        fieldDependencies: [],
      },
    },
    {
      id: 'wdg_pipeline',
      kind: 'chart',
      chartVersionId: 'chv_pipeline_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'metric',
        title: 'Pipeline value',
        subtitle: 'Open opportunities',
        query: {
          datasetId: LEADS_ID,
          select: [{ as: 'pipeline', fieldId: 'fld_value', aggregate: 'sum' }],
          filters: [openStages],
          groupBy: [],
          orderBy: [],
          limit: 1,
        },
        encoding: { value: 'pipeline' },
        format: { style: 'currency', currency: 'USD', compact: true },
        accessibilitySummary: 'Sum of value for leads in an open stage.',
        schemaVersion: 1,
        fieldDependencies: ['fld_value', 'fld_stage'],
      },
    },
    {
      id: 'wdg_avg',
      kind: 'chart',
      chartVersionId: 'chv_avg_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'metric',
        title: 'Average deal size',
        subtitle: 'Won deals',
        query: {
          datasetId: LEADS_ID,
          select: [{ as: 'avg_value', fieldId: 'fld_value', aggregate: 'avg' }],
          filters: [{ fieldId: 'fld_stage', op: 'eq', value: 'stg_won' }],
          groupBy: [],
          orderBy: [],
          limit: 1,
        },
        encoding: { value: 'avg_value' },
        format: { style: 'currency', currency: 'USD', compact: true },
        accessibilitySummary: 'Average value of won deals.',
        schemaVersion: 1,
        fieldDependencies: ['fld_value', 'fld_stage'],
      },
    },
    {
      id: 'wdg_revenue',
      kind: 'chart',
      chartVersionId: 'chv_revenue_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'bar',
        title: 'Revenue by month',
        subtitle: 'Closed-won value · last 6 months',
        query: {
          datasetId: LEADS_ID,
          select: [
            { as: 'month', fieldId: 'fld_close', bucket: 'month' },
            { as: 'revenue', fieldId: 'fld_value', aggregate: 'sum' },
          ],
          filters: [
            { fieldId: 'fld_stage', op: 'eq', value: 'stg_won' },
            { fieldId: 'fld_close', op: 'gte', value: '2026-05-01' },
          ],
          groupBy: ['month'],
          orderBy: [{ by: 'month', direction: 'asc' }],
          limit: 12,
        },
        encoding: { category: 'month', value: 'revenue' },
        format: { style: 'currency', currency: 'USD', compact: true },
        accessibilitySummary: 'Total value of won deals per month for the last six months.',
        schemaVersion: 1,
        fieldDependencies: ['fld_close', 'fld_value', 'fld_stage'],
      },
    },
    {
      id: 'wdg_stage',
      kind: 'chart',
      chartVersionId: 'chv_stage_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'horizontalBar',
        title: 'Opportunities by stage',
        subtitle: 'Open deals',
        query: {
          datasetId: LEADS_ID,
          select: [
            { as: 'stage', fieldId: 'fld_stage' },
            { as: 'deals', aggregate: 'count' },
          ],
          filters: [openStages],
          groupBy: ['stage'],
          orderBy: [],
          limit: 10,
        },
        encoding: { category: 'stage', value: 'deals' },
        format: { style: 'number', compact: false },
        accessibilitySummary: 'Number of open deals in each pipeline stage.',
        schemaVersion: 1,
        fieldDependencies: ['fld_stage'],
      },
    },
    {
      id: 'wdg_health',
      kind: 'dataHealth',
      datasetId: LEADS_ID,
      title: 'Data health',
      status: 'ok',
      issues: [],
      createdAt: created,
    },
    {
      id: 'wdg_source',
      kind: 'chart',
      chartVersionId: 'chv_source_1',
      status: 'ok',
      issues: [],
      createdAt: created,
      definition: {
        type: 'donut',
        title: 'Leads by source',
        subtitle: 'Where leads come from',
        query: {
          datasetId: LEADS_ID,
          select: [
            { as: 'source', fieldId: 'fld_source' },
            { as: 'leads', aggregate: 'count' },
          ],
          filters: [],
          groupBy: ['source'],
          orderBy: [{ by: 'leads', direction: 'desc' }],
          limit: 10,
        },
        encoding: { category: 'source', value: 'leads' },
        format: { style: 'number', compact: false },
        accessibilitySummary: 'Share of leads from each source.',
        schemaVersion: 1,
        fieldDependencies: ['fld_source'],
      },
    },
  ];

  return {
    id: DASHBOARD_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Overview',
    version: 1,
    widgets,
    layouts: {
      lg: [
        { i: 'wdg_total', x: 0, y: 0, w: 4, h: 2 },
        { i: 'wdg_pipeline', x: 4, y: 0, w: 4, h: 2 },
        { i: 'wdg_avg', x: 8, y: 0, w: 4, h: 2 },
        { i: 'wdg_revenue', x: 0, y: 2, w: 8, h: 6 },
        { i: 'wdg_stage', x: 8, y: 2, w: 4, h: 6 },
        { i: 'wdg_health', x: 0, y: 8, w: 4, h: 4 },
        { i: 'wdg_source', x: 4, y: 8, w: 8, h: 4 },
      ],
      md: [
        { i: 'wdg_total', x: 0, y: 0, w: 4, h: 2 },
        { i: 'wdg_pipeline', x: 4, y: 0, w: 4, h: 2 },
        { i: 'wdg_avg', x: 8, y: 0, w: 4, h: 2 },
        { i: 'wdg_revenue', x: 0, y: 2, w: 12, h: 6 },
        { i: 'wdg_stage', x: 0, y: 8, w: 6, h: 6 },
        { i: 'wdg_health', x: 6, y: 8, w: 6, h: 6 },
        { i: 'wdg_source', x: 0, y: 14, w: 12, h: 5 },
      ],
      sm: [
        { i: 'wdg_total', x: 0, y: 0, w: 1, h: 2 },
        { i: 'wdg_pipeline', x: 0, y: 2, w: 1, h: 2 },
        { i: 'wdg_avg', x: 0, y: 4, w: 1, h: 2 },
        { i: 'wdg_revenue', x: 0, y: 6, w: 1, h: 6 },
        { i: 'wdg_stage', x: 0, y: 12, w: 1, h: 6 },
        { i: 'wdg_health', x: 0, y: 18, w: 1, h: 4 },
        { i: 'wdg_source', x: 0, y: 22, w: 1, h: 6 },
      ],
    },
    updatedAt: iso(daysAgo(1)),
  };
}

export function seedActions(): { actions: Action[]; runs: Run[] } {
  const enrichmentSteps = [
    {
      id: 'st_fetch',
      kind: 'fetch' as const,
      title: 'Fetch company profiles',
      detail: 'GET company pages from the approved directory API.',
    },
    {
      id: 'st_extract',
      kind: 'extract' as const,
      title: 'Extract size and industry',
      detail: 'Parse JSON responses into typed values.',
    },
    {
      id: 'st_upsert',
      kind: 'upsert' as const,
      title: 'Update matching leads',
      detail: 'Update leads by website; never creates records.',
    },
  ];
  const runs: Run[] = [3, 10, 17].map((days, index) => ({
    id: `run_enrich_${index + 1}`,
    actionId: 'act_enrich',
    draftId: null,
    artifactHash: 'h_enrich_v2',
    mode: 'live',
    trigger: 'schedule',
    status: index === 1 ? 'failed' : 'succeeded',
    steps: enrichmentSteps.map((step, stepIndex) => ({
      stepId: step.id,
      status: index === 1 && stepIndex === 0 ? 'failed' : index === 1 ? 'skipped' : 'succeeded',
      message: index === 1 && stepIndex === 0 ? 'directory.example.com returned 503' : null,
    })),
    changes:
      index === 1
        ? null
        : {
            datasetId: LEADS_ID,
            inserts: 0,
            updates: 37 - index * 5,
            duplicatesSkipped: 0,
            rejected: 1,
            sample: [],
            committed: true,
            changeSetId: `chg_enrich_${index + 1}`,
          },
    error:
      index === 1
        ? { code: 'upstream_unavailable', message: 'The directory API was unavailable (HTTP 503).' }
        : null,
    createdAt: iso(daysAgo(days)),
    startedAt: iso(daysAgo(days)),
    finishedAt: iso(new Date(daysAgo(days).getTime() + 94_000)),
  }));

  const enrich: Action = {
    id: 'act_enrich',
    workspaceId: WORKSPACE_ID,
    name: 'Weekly lead enrichment',
    description: 'Fills in company size and industry for leads using the approved company directory.',
    status: 'active',
    currentVersion: {
      id: 'acv_enrich_2',
      version: 2,
      hash: 'h_enrich_v2',
      steps: enrichmentSteps,
      manifest: {
        inputs: [LEADS_ID],
        outputs: [LEADS_ID],
        permissions: [
          { kind: 'read', target: LEADS_ID, description: 'Read Company and Website from Leads' },
          { kind: 'write', target: LEADS_ID, description: 'Update existing Leads' },
          { kind: 'network', target: 'directory.example.com', description: 'HTTPS GET only' },
          { kind: 'secret', target: 'DIRECTORY_API_KEY', description: 'Directory API key' },
        ],
        limits: { maxRecordsWritten: 500, timeoutSeconds: 600, maxNetworkRequests: 500 },
      },
      approvedBy: 'Lee Morris',
      approvedAt: iso(daysAgo(40)),
    },
    schedule: {
      cron: '0 9 * * 1',
      timezone: 'Europe/London',
      enabled: true,
      description: 'Every Monday at 09:00',
      nextRunAt: iso(new Date('2026-10-19T08:00:00Z')),
    },
    lastRun: pickSummary(runs[0] as Run),
    createdAt: iso(daysAgo(60)),
    updatedAt: iso(daysAgo(3)),
  };

  const dedupe: Action = {
    id: 'act_dedupe',
    workspaceId: WORKSPACE_ID,
    name: 'Clean duplicate leads',
    description: 'Flags leads that share a website and keeps the most complete record.',
    status: 'paused',
    currentVersion: {
      id: 'acv_dedupe_1',
      version: 1,
      hash: 'h_dedupe_v1',
      steps: [
        {
          id: 'st_match',
          kind: 'dedupe',
          title: 'Find matching leads',
          detail: 'Match by normalised website and company name.',
        },
        {
          id: 'st_merge',
          kind: 'upsert',
          title: 'Merge into the most complete record',
          detail: 'Keeps non-empty values; archives the rest.',
        },
      ],
      manifest: {
        inputs: [LEADS_ID],
        outputs: [LEADS_ID],
        permissions: [
          { kind: 'read', target: LEADS_ID, description: 'Read all Leads fields' },
          { kind: 'write', target: LEADS_ID, description: 'Update and archive Leads' },
        ],
        limits: { maxRecordsWritten: 200, timeoutSeconds: 120, maxNetworkRequests: 0 },
      },
      approvedBy: 'Priya Shah',
      approvedAt: iso(daysAgo(12)),
    },
    schedule: null,
    lastRun: null,
    createdAt: iso(daysAgo(12)),
    updatedAt: iso(daysAgo(5)),
  };

  return { actions: [enrich, dedupe], runs };
}

export function pickSummary(run: Run) {
  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    trigger: run.trigger,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
  };
}
