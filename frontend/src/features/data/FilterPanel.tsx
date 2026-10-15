import { useState } from 'react';
import type { Field, Filter, FilterOperator } from '@/api/contract';
import { displayText, parseInput } from '@/lib/fieldValues';
import { Button, Dialog, IconButton, formStyles } from '@/ui';
import styles from './DataPage.module.css';
import { needsValue, OPERATOR_LABELS, operatorsFor } from './filters';

interface DraftFilter {
  key: number;
  fieldId: string;
  op: FilterOperator;
  text: string;
}

let nextKey = 0;

function toDraft(filter: Filter, fields: Field[]): DraftFilter {
  const field = fields.find((item) => item.id === filter.fieldId);
  return {
    key: nextKey++,
    fieldId: filter.fieldId,
    op: filter.op,
    text: field && filter.value !== undefined ? displayText(field, filter.value) : '',
  };
}

export interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  filters: Filter[];
  onApply: (filters: Filter[]) => void;
}

/** Builds typed `Filter[]` for the records query. Values are parsed per field type. */
export function FilterPanel({ open, onClose, fields, filters, onApply }: FilterPanelProps) {
  const [drafts, setDrafts] = useState<DraftFilter[]>(() => filters.map((filter) => toDraft(filter, fields)));
  const [errors, setErrors] = useState<Record<number, string>>({});

  const update = (key: number, patch: Partial<DraftFilter>) =>
    setDrafts((list) => list.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const add = () => {
    const field = fields[0];
    if (!field) return;
    setDrafts((list) => [
      ...list,
      { key: nextKey++, fieldId: field.id, op: operatorsFor(field)[0] ?? 'eq', text: '' },
    ]);
  };

  const apply = () => {
    const nextErrors: Record<number, string> = {};
    const result: Filter[] = [];
    for (const draft of drafts) {
      const field = fields.find((item) => item.id === draft.fieldId);
      if (!field) continue;
      if (!needsValue(draft.op)) {
        result.push({ fieldId: field.id, op: draft.op });
        continue;
      }
      if (draft.op === 'contains') {
        result.push({ fieldId: field.id, op: 'contains', value: draft.text });
        continue;
      }
      const parsed = parseInput({ ...field, required: true }, draft.text);
      if (!parsed.ok) nextErrors[draft.key] = parsed.error;
      else result.push({ fieldId: field.id, op: draft.op, value: parsed.value });
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onApply(result);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filter records"
      kicker={{ icon: 'filter', label: 'Filters', tone: 'data' }}
      description="Only records matching every condition are shown."
      footer={
        <>
          <Button variant="ghost" icon="plus" onClick={add}>
            Add condition
          </Button>
          <div className={styles.dialogButtons}>
            <Button
              onClick={() => {
                setDrafts([]);
                onApply([]);
                onClose();
              }}
            >
              Clear all
            </Button>
            <Button variant="primary" onClick={apply}>
              Apply
            </Button>
          </div>
        </>
      }
    >
      <div className={styles.filterList}>
        {drafts.length === 0 ? (
          <p className={styles.muted}>No conditions yet. Add one to narrow down the records.</p>
        ) : null}
        {drafts.map((draft, index) => {
          const field = fields.find((item) => item.id === draft.fieldId) ?? fields[0];
          if (!field) return null;
          const operators = operatorsFor(field);
          return (
            <div key={draft.key} className={styles.filterRow}>
              <span className={styles.filterJoin}>{index === 0 ? 'Where' : 'and'}</span>
              <select
                className={formStyles.select}
                aria-label="Field"
                value={draft.fieldId}
                onChange={(event) => {
                  const next = fields.find((item) => item.id === event.target.value);
                  update(draft.key, {
                    fieldId: event.target.value,
                    op: next ? (operatorsFor(next)[0] ?? 'eq') : draft.op,
                    text: '',
                  });
                }}
              >
                {fields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className={formStyles.select}
                aria-label="Condition"
                value={draft.op}
                onChange={(event) => update(draft.key, { op: event.target.value as FilterOperator })}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              {needsValue(draft.op) ? (
                field.type === 'singleSelect' || field.type === 'multiSelect' || field.type === 'boolean' ? (
                  <select
                    className={formStyles.select}
                    aria-label="Value"
                    value={draft.text}
                    onChange={(event) => update(draft.key, { text: event.target.value })}
                  >
                    <option value="">Choose…</option>
                    {(field.type === 'boolean'
                      ? ['Yes', 'No']
                      : (field.config.choices ?? []).map((choice) => choice.label)
                    ).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={formStyles.input}
                    aria-label="Value"
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={draft.text}
                    aria-invalid={errors[draft.key] ? true : undefined}
                    onChange={(event) => update(draft.key, { text: event.target.value })}
                  />
                )
              ) : (
                <span />
              )}
              <IconButton
                icon="close"
                label="Remove condition"
                size="sm"
                onClick={() => setDrafts((list) => list.filter((item) => item.key !== draft.key))}
              />
              {errors[draft.key] ? <p className={formStyles.error}>{errors[draft.key]}</p> : null}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
