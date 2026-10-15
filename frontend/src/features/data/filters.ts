import type { Field, FilterOperator } from '@/api/contract';
import { isNumericType } from '@/lib/fieldValues';

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  in: 'is any of',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

/** Operators that make sense for a field type, in display order. */
export function operatorsFor(field: Field): FilterOperator[] {
  if (isNumericType(field.type)) return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
  if (field.type === 'date' || field.type === 'datetime')
    return ['eq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
  if (field.type === 'singleSelect' || field.type === 'multiSelect' || field.type === 'boolean')
    return ['eq', 'neq', 'isEmpty', 'isNotEmpty'];
  return ['contains', 'eq', 'neq', 'isEmpty', 'isNotEmpty'];
}

export const needsValue = (op: FilterOperator) => op !== 'isEmpty' && op !== 'isNotEmpty';
