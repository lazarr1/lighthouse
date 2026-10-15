import type {
  CellValue,
  Dataset,
  DataRecord,
  Field,
  Filter,
  QueryDefinition,
  QueryResult,
  RecordQuery,
  SelectItem,
  TimeBucket,
} from '@/api/contract';

/**
 * Reference implementation of record queries and the chart query AST over an
 * in-memory array. The real backend compiles the same AST to parameterised SQL.
 */
export class MockQueryError extends Error {}

const choiceLabel = (field: Field | undefined, id: string) =>
  field?.config.choices?.find((choice) => choice.id === id)?.label ?? id;

function searchableText(record: DataRecord, fields: Field[]): string {
  return fields
    .map((field) => {
      const value = record.values[field.id];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return value.map((id) => choiceLabel(field, id)).join(' ');
      if (field.type === 'singleSelect' && typeof value === 'string') return choiceLabel(field, value);
      return String(value);
    })
    .join(' ')
    .toLowerCase();
}

const isEmpty = (value: CellValue | undefined) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

export function matchesFilter(record: DataRecord, filter: Filter): boolean {
  const value = record.values[filter.fieldId];
  const target = filter.value;
  switch (filter.op) {
    case 'isEmpty':
      return isEmpty(value);
    case 'isNotEmpty':
      return !isEmpty(value);
    case 'eq':
      return Array.isArray(value) ? value.includes(String(target)) : value === target;
    case 'neq':
      return Array.isArray(value) ? !value.includes(String(target)) : value !== target;
    case 'contains':
      return String(value ?? '')
        .toLowerCase()
        .includes(String(target ?? '').toLowerCase());
    case 'in':
      return (
        Array.isArray(target) &&
        (Array.isArray(value) ? value.some((v) => target.includes(v)) : target.includes(String(value)))
      );
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (isEmpty(value) || target === undefined || target === null) return false;
      const a = value as number | string;
      const b = target as number | string;
      if (filter.op === 'gt') return a > b;
      if (filter.op === 'gte') return a >= b;
      if (filter.op === 'lt') return a < b;
      return a <= b;
    }
  }
}

function compareValues(a: CellValue | undefined, b: CellValue | undefined, field: Field | undefined): number {
  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1; // empties last
  if (isEmpty(b)) return -1;
  if (field?.type === 'singleSelect' && field.config.choices) {
    const order = field.config.choices.map((choice) => choice.id);
    return order.indexOf(String(a)) - order.indexOf(String(b));
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

const encodeCursor = (offset: number) => btoa(`o:${offset}`);
const decodeCursor = (cursor: string | null | undefined) => {
  if (!cursor) return 0;
  const match = /^o:(\d+)$/.exec(atob(cursor));
  if (!match) throw new MockQueryError('Invalid cursor');
  return Number(match[1]);
};

export function queryRecords(dataset: Dataset, records: DataRecord[], query: RecordQuery) {
  const fieldsById = new Map(dataset.fields.map((field) => [field.id, field]));
  for (const ref of [...(query.filters ?? []), ...(query.sort ?? [])]) {
    if (!fieldsById.has(ref.fieldId)) throw new MockQueryError(`Unknown field ${ref.fieldId}`);
  }

  const needle = query.search?.trim().toLowerCase();
  let matched = records.filter(
    (record) =>
      (!query.onlyWithIssues || record.issues.length > 0) &&
      (query.filters ?? []).every((filter) => matchesFilter(record, filter)) &&
      (!needle || searchableText(record, dataset.fields).includes(needle)),
  );

  if (query.sort?.length) {
    const sorts = query.sort;
    matched = [...matched].sort((a, b) => {
      for (const sort of sorts) {
        const result = compareValues(
          a.values[sort.fieldId],
          b.values[sort.fieldId],
          fieldsById.get(sort.fieldId),
        );
        if (result !== 0) return sort.direction === 'asc' ? result : -result;
      }
      return 0;
    });
  }

  const offset = decodeCursor(query.cursor);
  const limit = query.limit ?? 100;
  const items = matched.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    nextCursor: nextOffset < matched.length ? encodeCursor(nextOffset) : null,
    totalCount: matched.length,
    dataRevision: dataset.dataRevision,
  };
}

// ── Aggregation ─────────────────────────────────────────────────────────────

function bucketDate(value: string, bucket: TimeBucket): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (bucket) {
    case 'year':
      return `${y}-01-01`;
    case 'quarter':
      return `${y}-${pad(Math.floor(m / 3) * 3 + 1)}-01`;
    case 'month':
      return `${y}-${pad(m + 1)}-01`;
    case 'week': {
      const day = (date.getUTCDay() + 6) % 7; // Monday = 0
      const monday = new Date(Date.UTC(y, m, date.getUTCDate() - day));
      return monday.toISOString().slice(0, 10);
    }
    case 'day':
      return date.toISOString().slice(0, 10);
  }
}

function dimensionValue(
  record: DataRecord,
  item: SelectItem,
  field: Field | undefined,
): string | number | null {
  const raw = item.fieldId ? record.values[item.fieldId] : null;
  if (isEmpty(raw)) return null;
  if (item.bucket) return bucketDate(String(raw), item.bucket);
  if (field?.type === 'singleSelect') return choiceLabel(field, String(raw));
  if (Array.isArray(raw)) return raw.map((id) => choiceLabel(field, id)).join(', ');
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  return raw as string | number;
}

function aggregate(records: DataRecord[], item: SelectItem): number | null {
  if (item.aggregate === 'count') return records.length;
  const values = records
    .map((record) => (item.fieldId ? record.values[item.fieldId] : null))
    .filter((value) => !isEmpty(value));
  if (item.aggregate === 'countDistinct') return new Set(values.map(String)).size;
  const numbers = values.filter((value): value is number => typeof value === 'number');
  if (numbers.length === 0) return null;
  switch (item.aggregate) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return null;
  }
}

const NUMERIC_TYPES = new Set(['number', 'money', 'percent']);

export function validateQuery(dataset: Dataset, query: QueryDefinition): string[] {
  const problems: string[] = [];
  const fields = new Map(dataset.fields.map((field) => [field.id, field]));
  const aliases = new Set(query.select.map((item) => item.as));
  for (const item of query.select) {
    const field = item.fieldId ? fields.get(item.fieldId) : undefined;
    if (item.fieldId && !field) problems.push(`Field ${item.fieldId} no longer exists.`);
    else if (field?.status === 'deprecated') problems.push(`Field “${field.name}” has been removed.`);
    if (
      item.aggregate &&
      ['sum', 'avg', 'min', 'max'].includes(item.aggregate) &&
      field &&
      !NUMERIC_TYPES.has(field.type)
    ) {
      problems.push(
        `“${field.name}” is no longer numeric, so it can’t be ${item.aggregate === 'sum' ? 'summed' : 'aggregated'}.`,
      );
    }
    if (item.bucket && field && field.type !== 'date' && field.type !== 'datetime') {
      problems.push(`“${field.name}” is no longer a date.`);
    }
    if (!item.aggregate && !item.fieldId) problems.push(`Column ${item.as} needs a field or an aggregate.`);
  }
  for (const filter of query.filters) {
    if (!fields.has(filter.fieldId)) problems.push(`Filter field ${filter.fieldId} no longer exists.`);
  }
  for (const alias of [...query.groupBy, ...query.orderBy.map((order) => order.by)]) {
    if (!aliases.has(alias)) problems.push(`Unknown column ${alias}.`);
  }
  return problems;
}

export function runQuery(
  dataset: Dataset,
  records: DataRecord[],
  query: QueryDefinition,
  now: Date,
): QueryResult {
  const problems = validateQuery(dataset, query);
  if (problems.length) throw new MockQueryError(problems.join(' '));

  const fields = new Map(dataset.fields.map((field) => [field.id, field]));
  const filtered = records.filter((record) => query.filters.every((filter) => matchesFilter(record, filter)));
  const dimensions = query.select.filter((item) => !item.aggregate);
  const measures = query.select.filter((item) => item.aggregate);

  const groups = new Map<string, { key: (string | number | null)[]; records: DataRecord[] }>();
  for (const record of filtered) {
    const key = dimensions.map((item) =>
      dimensionValue(record, item, item.fieldId ? fields.get(item.fieldId) : undefined),
    );
    if (dimensions.length && key.some((part) => part === null)) continue;
    const id = JSON.stringify(key);
    const group = groups.get(id) ?? { key, records: [] };
    group.records.push(record);
    groups.set(id, group);
  }
  if (!dimensions.length && groups.size === 0) groups.set('[]', { key: [], records: [] });

  let rows = [...groups.values()].map((group) => {
    const row: Record<string, string | number | null> = {};
    dimensions.forEach((item, index) => (row[item.as] = group.key[index] ?? null));
    measures.forEach((item) => (row[item.as] = aggregate(group.records, item)));
    return row;
  });

  // Default order: categories in schema order (select fields) or ascending.
  const order = query.orderBy.length
    ? query.orderBy
    : dimensions.slice(0, 1).map((item) => ({ by: item.as, direction: 'asc' as const }));
  const choiceOrder = (alias: string) => {
    const item = dimensions.find((d) => d.as === alias);
    const field = item?.fieldId ? fields.get(item.fieldId) : undefined;
    return field?.type === 'singleSelect' && !item?.bucket
      ? field.config.choices?.map((c) => c.label)
      : undefined;
  };
  rows.sort((a, b) => {
    for (const { by, direction } of order) {
      const labels = choiceOrder(by);
      const left = a[by] ?? null;
      const right = b[by] ?? null;
      const result = labels
        ? labels.indexOf(String(left)) - labels.indexOf(String(right))
        : typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));
      if (result !== 0) return direction === 'asc' ? result : -result;
    }
    return 0;
  });

  const truncated = rows.length > query.limit;
  rows = rows.slice(0, query.limit);

  return {
    columns: query.select.map((item) => {
      const field = item.fieldId ? fields.get(item.fieldId) : undefined;
      return {
        key: item.as,
        label: item.aggregate === 'count' ? 'Records' : (field?.name ?? item.as),
        type: item.aggregate
          ? 'number'
          : item.bucket
            ? 'date'
            : field && NUMERIC_TYPES.has(field.type)
              ? 'number'
              : 'string',
      };
    }),
    rows,
    meta: { datasetRevision: dataset.dataRevision, generatedAt: now.toISOString(), truncated },
  };
}
