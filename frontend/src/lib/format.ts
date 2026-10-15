import type { TimeBucket, ValueFormat } from '@/api/contract';

const LOCALE = undefined; // user's locale

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(options: Intl.NumberFormatOptions) {
  const key = JSON.stringify(options);
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, options);
    numberFormats.set(key, format);
  }
  return format;
}

export function formatValue(value: number | null | undefined, format: ValueFormat): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const compact = format.compact && Math.abs(value) >= 10_000;
  const base: Intl.NumberFormatOptions = compact
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { maximumFractionDigits: 2 };
  if (format.style === 'currency') {
    return numberFormat({
      ...base,
      style: 'currency',
      currency: format.currency ?? 'USD',
      currencyDisplay: 'narrowSymbol',
      ...(compact ? {} : { maximumFractionDigits: 0 }),
    }).format(value);
  }
  if (format.style === 'percent')
    return numberFormat({ style: 'percent', maximumFractionDigits: 1 }).format(value);
  return numberFormat(base).format(value);
}

export const formatCount = (value: number) => numberFormat({ maximumFractionDigits: 0 }).format(value);

export function formatMoney(value: number, currency = 'USD', decimals = 0) {
  return numberFormat({
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const parseDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

export function formatDate(value: string): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "8 min ago", "Yesterday", "3 days ago", falling back to a date. */
export function formatRelative(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return value;
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (abs < 45) return future ? 'in a moment' : 'just now';
  if (abs < 3600) return rtf.format(Math.round(-seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(-seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(-seconds / 86_400), 'day');
  return formatDate(value);
}

export function formatBucket(value: string, bucket: TimeBucket | undefined): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }).format(date);
  switch (bucket) {
    case 'year':
      return fmt({ year: 'numeric' });
    case 'quarter':
      return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
    case 'month':
      return fmt({ month: 'short', year: '2-digit' });
    case 'week':
    case 'day':
      return fmt({ day: 'numeric', month: 'short' });
    default:
      return formatDate(value);
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
