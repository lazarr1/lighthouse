import type { Field } from '@/api/contract';

export function defaultColumnWidth(field: Field, primary: boolean): number {
  if (primary) return 220;
  switch (field.type) {
    case 'boolean':
      return 96;
    case 'number':
    case 'money':
    case 'percent':
      return 128;
    case 'date':
      return 132;
    case 'datetime':
      return 168;
    case 'singleSelect':
      return 152;
    case 'longText':
    case 'url':
    case 'multiSelect':
      return 220;
    default:
      return 180;
  }
}
