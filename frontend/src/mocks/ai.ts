import type {
  ActionDraft,
  ActionManifest,
  ChartDefinition,
  ChartType,
  Dataset,
  Field,
  Filter,
  PlanStep,
  SelectItem,
} from '@/api/contract';
import { OPEN_STAGE_IDS } from './fixtures';

/**
 * Deterministic stand-in for the model + validator pipeline. It is keyword
 * based on purpose: predictable for tests and demos, and it only ever emits
 * artifacts that conform to the contract — exactly what the real backend
 * guarantees after validation.
 */

const NUMERIC = new Set(['number', 'money', 'percent']);

function findMentionedField(prompt: string, fields: Field[], types: string[]): Field | undefined {
  const lower = prompt.toLowerCase();
  return fields
    .filter((field) => field.status === 'active' && types.includes(field.type))
    .find((field) => {
      const name = field.name.toLowerCase();
      return lower.includes(name) || lower.includes(name.replace(/s$/, '')) || lower.includes(`${name}s`);
    });
}

function requestedType(lower: string): ChartType | undefined {
  if (/\b(table|list)\b/.test(lower)) return 'table';
  if (/\b(donut|pie|share|split|breakdown|proportion)\b/.test(lower)) return 'donut';
  if (/\b(area)\b/.test(lower)) return 'area';
  if (/\b(line|trend)\b/.test(lower)) return 'line';
  if (/\bhorizontal\b/.test(lower)) return 'horizontalBar';
  if (/\bbar\b/.test(lower)) return 'bar';
  if (/\b(single number|kpi|metric)\b/.test(lower)) return 'metric';
  return undefined;
}

export interface ChartPlan {
  definition: ChartDefinition;
  explanation: string;
  warnings: string[];
}

export function planChart(dataset: Dataset, prompt: string): ChartPlan {
  const lower = prompt.toLowerCase();
  const fields = dataset.fields;
  const warnings: string[] = [];

  // Measure
  const numericField =
    findMentionedField(prompt, fields, ['number', 'money', 'percent']) ??
    (/\b(revenue|pipeline|value|amount|worth|sales)\b/.test(lower)
      ? fields.find((field) => field.status === 'active' && NUMERIC.has(field.type))
      : undefined);
  const aggregate: SelectItem['aggregate'] = numericField
    ? /\b(average|avg|mean|typical)\b/.test(lower)
      ? 'avg'
      : 'sum'
    : 'count';
  const measure: SelectItem = numericField
    ? { as: 'value', fieldId: numericField.id, aggregate }
    : { as: 'records', aggregate: 'count' };

  // Dimension
  const timeWords = /\b(month|monthly|week|weekly|day|daily|quarter|year|over time|trend)\b/.exec(lower);
  const selectField = findMentionedField(prompt, fields, ['singleSelect', 'boolean']);
  const dateField =
    findMentionedField(prompt, fields, ['date', 'datetime']) ??
    (timeWords
      ? fields.find(
          (field) => field.status === 'active' && (field.type === 'date' || field.type === 'datetime'),
        )
      : undefined);

  let dimension: SelectItem | undefined;
  let dimensionLabel = '';
  if (selectField && !(timeWords && !/\bby\b/.test(lower))) {
    dimension = { as: 'category', fieldId: selectField.id };
    dimensionLabel = selectField.name.toLowerCase();
  } else if (dateField) {
    const bucket = /week/.test(lower)
      ? 'week'
      : /day|daily/.test(lower)
        ? 'day'
        : /quarter/.test(lower)
          ? 'quarter'
          : /year/.test(lower) && !/month/.test(lower)
            ? 'year'
            : 'month';
    dimension = { as: 'period', fieldId: dateField.id, bucket };
    dimensionLabel = bucket;
  }

  // Filters
  const filters: Filter[] = [];
  const stageField = fields.find((field) => field.id === 'fld_stage' && field.status === 'active');
  if (stageField) {
    if (/\b(won|closed)\b/.test(lower)) filters.push({ fieldId: stageField.id, op: 'eq', value: 'stg_won' });
    else if (/\b(open|active|pipeline)\b/.test(lower))
      filters.push({ fieldId: stageField.id, op: 'in', value: OPEN_STAGE_IDS });
  }

  // Chart type
  let type: ChartType =
    requestedType(lower) ??
    (dimension
      ? dimension.bucket
        ? /\btrend|over time\b/.test(lower)
          ? 'line'
          : 'bar'
        : 'horizontalBar'
      : 'metric');
  if (!dimension && type !== 'metric') {
    warnings.push('I couldn’t find something to group by, so this shows a single number.');
    type = 'metric';
  }
  if (dimension && type === 'metric') type = 'bar';

  const measureLabel = numericField
    ? `${aggregate === 'avg' ? 'Average ' : ''}${numericField.name.toLowerCase()}`
    : 'Records';
  const title = capitalise(dimension ? `${measureLabel} by ${dimensionLabel}` : measureLabel);
  const filterNote = filters.length
    ? filters[0]?.op === 'eq'
      ? 'won deals'
      : 'open deals'
    : `all ${dataset.name.toLowerCase()}`;

  const select = dimension ? [dimension, measure] : [measure];
  const definition: ChartDefinition = {
    type,
    title,
    subtitle: capitalise(filterNote),
    query: {
      datasetId: dataset.id,
      select,
      filters,
      groupBy: dimension ? [dimension.as] : [],
      orderBy: dimension?.bucket ? [{ by: dimension.as, direction: 'asc' }] : [],
      limit: dimension ? 24 : 1,
    },
    encoding: { category: dimension?.as, value: measure.as },
    format:
      numericField?.type === 'money'
        ? { style: 'currency', currency: numericField.config.currency ?? 'USD', compact: true }
        : numericField?.type === 'percent'
          ? { style: 'percent', compact: false }
          : { style: 'number', compact: false },
    accessibilitySummary: `${title} for ${filterNote}.`,
    schemaVersion: dataset.schemaVersion,
    fieldDependencies: [
      ...new Set(
        select
          .map((item) => item.fieldId)
          .concat(filters.map((f) => f.fieldId))
          .filter((id): id is string => !!id),
      ),
    ],
  };

  const how = numericField
    ? `${aggregate === 'avg' ? 'average' : 'total'} ${numericField.name}`
    : 'count records';
  const explanation = dimension
    ? `I’ll ${how} for ${filterNote}, grouped by ${dimensionLabel}.`
    : `I’ll ${how} for ${filterNote} and show it as a single number.`;
  return { definition, explanation, warnings };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ── Actions ─────────────────────────────────────────────────────────────────

export type ActionPlan = Pick<
  ActionDraft,
  'status' | 'title' | 'interpretation' | 'steps' | 'manifest' | 'questions' | 'rejectionReason'
> & { kind: 'research' | 'dedupe' | 'image' | 'none' };

const step = (id: string, kind: PlanStep['kind'], title: string, detail: string): PlanStep => ({
  id,
  kind,
  title,
  detail,
});

const manifest = (
  datasetId: string,
  permissions: ActionManifest['permissions'],
  network = 0,
): ActionManifest => ({
  inputs: [datasetId],
  outputs: [datasetId],
  permissions,
  limits: { maxRecordsWritten: 100, timeoutSeconds: 300, maxNetworkRequests: network },
});

export function planAction(dataset: Dataset, prompt: string, hasAttachment: boolean): ActionPlan {
  const lower = prompt.toLowerCase();
  const name = dataset.name;

  if (/\b(delete|drop|wipe|erase)\b.*\b(all|every|everything)\b/.test(lower)) {
    return {
      kind: 'none',
      status: 'rejected',
      title: 'Bulk deletion',
      interpretation: 'You asked to delete data in bulk.',
      steps: [],
      manifest: manifest(dataset.id, []),
      questions: [],
      rejectionReason:
        'Actions can’t delete records in bulk. Filter the Data view and delete records there instead.',
    };
  }

  if (hasAttachment || /\b(image|photo|picture|scan|card|receipt)\b/.test(lower)) {
    return {
      kind: 'image',
      status: 'ready',
      title: 'Extract a record from your image',
      interpretation: `I’ll read the attached image, match the details to ${name} fields and add one new record.`,
      steps: [
        step('st_ocr', 'ocr', 'Read the attached image', 'Text recognition runs in an isolated worker.'),
        step(
          'st_map',
          'extract',
          `Match details to ${name} fields`,
          'Each value gets a confidence score; uncertain values are flagged.',
        ),
        step('st_check', 'dedupe', 'Check for an existing record', 'Matches on company name and website.'),
        step('st_add', 'upsert', `Add the record to ${name}`, 'Inserts at most one record.'),
      ],
      manifest: manifest(dataset.id, [
        { kind: 'read', target: dataset.id, description: `Read Company and Website from ${name}` },
        { kind: 'write', target: dataset.id, description: `Insert 1 record into ${name}` },
      ]),
      questions: [],
      rejectionReason: null,
    };
  }

  if (/\b(duplicate|dedupe|clean|merge)\b/.test(lower)) {
    return {
      kind: 'dedupe',
      status: 'ready',
      title: 'Review duplicate records',
      interpretation: `I’ll find ${name} records that look like the same company and keep the most complete version of each.`,
      steps: [
        step(
          'st_match',
          'dedupe',
          'Find matching company and contact details',
          'Normalises names and websites before comparing.',
        ),
        step(
          'st_rank',
          'transform',
          'Compare how complete each match is',
          'Prefers the record with more non-empty fields.',
        ),
        step(
          'st_merge',
          'upsert',
          'Merge into the most complete record',
          'Fills gaps; never overwrites a non-empty value.',
        ),
      ],
      manifest: manifest(dataset.id, [
        { kind: 'read', target: dataset.id, description: `Read all ${name} fields` },
        { kind: 'write', target: dataset.id, description: `Update ${name} records` },
      ]),
      questions: [],
      rejectionReason: null,
    };
  }

  if (/\b(find|research|discover|search|look for|new companies|prospects?)\b/.test(lower)) {
    return {
      kind: 'research',
      status: 'ready',
      title: 'Research and add matching companies',
      interpretation: `I’ll look up companies that match your description in an approved directory and stage them as new ${name}.`,
      steps: [
        step('st_fetch', 'fetch', 'Search the company directory', 'HTTPS GET to directory.example.com only.'),
        step('st_parse', 'parse', 'Extract company details', 'Name, website, industry and size.'),
        step('st_dedupe', 'dedupe', 'Skip companies already in your data', 'Matches on website domain.'),
        step(
          'st_insert',
          'upsert',
          `Add new matches as Prospecting ${name}`,
          'Source is set to “AI research”.',
        ),
      ],
      manifest: manifest(
        dataset.id,
        [
          { kind: 'read', target: dataset.id, description: `Read Company and Website from ${name}` },
          { kind: 'write', target: dataset.id, description: `Insert up to 100 records into ${name}` },
          { kind: 'network', target: 'directory.example.com', description: 'HTTPS GET only' },
        ],
        50,
      ),
      questions: [],
      rejectionReason: null,
    };
  }

  return {
    kind: 'none',
    status: 'needs_input',
    title: 'Tell me a bit more',
    interpretation: 'I’m not sure what you’d like the action to do yet.',
    steps: [],
    manifest: manifest(dataset.id, []),
    questions: [
      `Should it add new records to ${name}, update existing ones, or both?`,
      'Where should the information come from — a website, an image, or your existing data?',
    ],
    rejectionReason: null,
  };
}

/** Stable content hash (FNV-1a). The real backend uses SHA-256 over a canonical encoding. */
export function hashArtifact(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `h_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
