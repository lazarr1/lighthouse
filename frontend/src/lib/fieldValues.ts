import type { CellValue, Field, FieldType } from '@/api/contract';
import { formatDate, formatDateTime, formatMoney } from './format';

/**
 * Converting between wire values (`CellValue`) and what users type or see.
 * Shared by the grid editors, paste handling and the record drawer.
 */

export type ParseResult = { ok: true; value: CellValue } | { ok: false; error: string };

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  longText: 'Long text',
  number: 'Number',
  money: 'Money',
  percent: 'Percent',
  date: 'Date',
  datetime: 'Date & time',
  boolean: 'Yes / no',
  singleSelect: 'Single choice',
  multiSelect: 'Multiple choice',
  url: 'Link',
};

/** Short glyph shown in column headers. */
export const FIELD_TYPE_GLYPHS: Record<FieldType, string> = {
  text: 'T',
  longText: '¶',
  number: '#',
  money: '$',
  percent: '%',
  date: '◷',
  datetime: '◷',
  boolean: '✓',
  singleSelect: '≡',
  multiSelect: '≡',
  url: '↗',
};

export const isNumericType = (type: FieldType) => type === 'number' || type === 'money' || type === 'percent';

export function choiceFor(field: Field, id: string) {
  return field.config.choices?.find((choice) => choice.id === id);
}

/** Plain-text rendering (copy, search, accessible labels). */
export function displayText(field: Field, value: CellValue | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'money':
      return typeof value === 'number'
        ? formatMoney(value, field.config.currency, field.config.decimals ?? 0)
        : String(value);
    case 'percent':
      return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      return formatDate(String(value));
    case 'datetime':
      return formatDateTime(String(value));
    case 'boolean':
      return value === true ? 'Yes' : value === false ? 'No' : '';
    case 'singleSelect':
      return choiceFor(field, String(value))?.label ?? String(value);
    case 'multiSelect':
      return Array.isArray(value)
        ? value.map((id) => choiceFor(field, id)?.label ?? id).join(', ')
        : String(value);
    default:
      return String(value);
  }
}

/** Text placed in an editor when editing starts. */
export function editText(field: Field, value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (field.type === 'percent' && typeof value === 'number') return String(Math.round(value * 10000) / 100);
  if (field.type === 'datetime' && typeof value === 'string') return toLocalInput(value);
  if (field.type === 'singleSelect' || field.type === 'multiSelect' || field.type === 'boolean')
    return displayText(field, value);
  return String(value);
}

/** Parse user input (typed or pasted) into a wire value. */
export function parseInput(field: Field, input: string): ParseResult {
  const text = input.trim();
  if (text === '')
    return field.required ? { ok: false, error: `${field.name} is required` } : { ok: true, value: null };

  switch (field.type) {
    case 'number':
    case 'money':
    case 'percent': {
      const number = Number(text.replace(/[,$£€%\s]/g, ''));
      if (!Number.isFinite(number)) return { ok: false, error: 'Enter a number' };
      return { ok: true, value: field.type === 'percent' ? number / 100 : number };
    }
    case 'boolean':
      if (/^(y|yes|true|1|✓)$/i.test(text)) return { ok: true, value: true };
      if (/^(n|no|false|0)$/i.test(text)) return { ok: true, value: false };
      return { ok: false, error: 'Enter yes or no' };
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: true, value: text };
      const time = Date.parse(text);
      if (Number.isNaN(time)) return { ok: false, error: 'Enter a date' };
      const date = new Date(time);
      const local = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      return { ok: true, value: local.toISOString().slice(0, 10) };
    }
    case 'datetime': {
      const time = Date.parse(text);
      return Number.isNaN(time)
        ? { ok: false, error: 'Enter a date and time' }
        : { ok: true, value: new Date(time).toISOString() };
    }
    case 'singleSelect': {
      const match = field.config.choices?.find(
        (choice) => choice.label.toLowerCase() === text.toLowerCase() || choice.id === text,
      );
      return match ? { ok: true, value: match.id } : { ok: false, error: 'Pick one of the options' };
    }
    case 'multiSelect': {
      const ids: string[] = [];
      for (const part of text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)) {
        const match = field.config.choices?.find(
          (choice) => choice.label.toLowerCase() === part.toLowerCase(),
        );
        if (!match) return { ok: false, error: `“${part}” isn’t an option` };
        ids.push(match.id);
      }
      return { ok: true, value: ids };
    }
    case 'url': {
      const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      try {
        new URL(url);
        return { ok: true, value: url };
      } catch {
        return { ok: false, error: 'Enter a web address' };
      }
    }
    default:
      return { ok: true, value: input };
  }
}

export const sameValue = (a: CellValue | undefined, b: CellValue | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** ISO instant → `YYYY-MM-DDTHH:mm` in local time, as `<input type="datetime-local">` expects. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
