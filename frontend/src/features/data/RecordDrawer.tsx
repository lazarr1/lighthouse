import { useEffect, useRef, useState } from 'react';
import { describeError } from '@/api/client';
import type { CellValue, Dataset, DataRecord } from '@/api/contract';
import { editText, FIELD_TYPE_LABELS, parseInput, sameValue } from '@/lib/fieldValues';
import { formatDateTime } from '@/lib/format';
import { Button, Icon, IconButton, formStyles, useToast } from '@/ui';
import styles from './RecordDrawer.module.css';
import { useDeleteRecord, useRevertChangeSet, useUpdateRecord } from './hooks';

export interface RecordDrawerProps {
  dataset: Dataset;
  record: DataRecord | null;
  onClose: () => void;
}

/**
 * Side panel for one record: long values, validation issues, provenance,
 * and a form for editing every field at once (one PATCH, one undo).
 */
export function RecordDrawer({ dataset, record, onClose }: RecordDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = !!record;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-label="Record details"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {record ? (
        <RecordForm
          key={`${record.id}:${record.revision}`}
          dataset={dataset}
          record={record}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  );
}

function RecordForm({
  dataset,
  record,
  onClose,
}: {
  dataset: Dataset;
  record: DataRecord;
  onClose: () => void;
}) {
  const toast = useToast();
  const update = useUpdateRecord(dataset.id);
  const remove = useDeleteRecord(dataset.id);
  const revert = useRevertChangeSet(dataset.id);
  const fields = dataset.fields.filter((field) => field.status === 'active');
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, editText(field, record.values[field.id])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const primary = fields.find((field) => field.id === dataset.primaryFieldId) ?? fields[0];
  const title = (primary && String(record.values[primary.id] ?? '')) || 'Untitled record';

  const save = () => {
    const values: Record<string, CellValue> = {};
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const parsed = parseInput(field, drafts[field.id] ?? '');
      if (!parsed.ok) nextErrors[field.id] = parsed.error;
      else if (!sameValue(parsed.value, record.values[field.id])) values[field.id] = parsed.value;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (Object.keys(values).length === 0) return onClose();
    update.mutate(
      { record, values },
      {
        onSuccess: (result) => {
          toast.success('Record saved.', { label: 'Undo', onClick: () => revert.mutate(result.changeSetId) });
          onClose();
        },
        onError: (error) => toast.error(describeError(error)),
      },
    );
  };

  const onDelete = () =>
    remove.mutate(record, {
      onSuccess: ({ changeSetId }) => {
        toast.success(`Deleted ${title}.`, { label: 'Undo', onClick: () => revert.mutate(changeSetId) });
        onClose();
      },
      onError: (error) => toast.error(describeError(error)),
    });

  return (
    <form
      className={styles.shell}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{dataset.name} record</p>
          <h2>{title}</h2>
        </div>
        <IconButton icon="close" label="Close record" variant="quiet" onClick={onClose} />
      </header>

      <div className={styles.body}>
        {record.issues.length ? (
          <section className={styles.issues} aria-label="Validation issues">
            {record.issues.map((issue) => (
              <p key={`${issue.fieldId}-${issue.message}`}>
                <Icon name="alert" size={14} />
                {issue.message}
              </p>
            ))}
          </section>
        ) : null}

        {fields.map((field) => {
          const id = `record-field-${field.id}`;
          const draft = drafts[field.id] ?? '';
          const set = (value: string) => setDrafts((current) => ({ ...current, [field.id]: value }));
          return (
            <div key={field.id} className={styles.field}>
              <label className={formStyles.label} htmlFor={id}>
                {field.name}
                {field.required ? <span aria-hidden="true"> *</span> : null}
                <span className={styles.type}>{FIELD_TYPE_LABELS[field.type]}</span>
              </label>
              {field.type === 'singleSelect' || field.type === 'boolean' ? (
                <select
                  id={id}
                  className={formStyles.select}
                  value={draft}
                  onChange={(event) => set(event.target.value)}
                >
                  <option value="">—</option>
                  {(field.type === 'boolean'
                    ? ['Yes', 'No']
                    : (field.config.choices ?? []).map((choice) => choice.label)
                  ).map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              ) : field.type === 'longText' ? (
                <textarea
                  id={id}
                  className={formStyles.textarea}
                  rows={4}
                  value={draft}
                  onChange={(event) => set(event.target.value)}
                />
              ) : (
                <input
                  id={id}
                  className={formStyles.input}
                  type={
                    field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'
                  }
                  value={draft}
                  aria-invalid={errors[field.id] ? true : undefined}
                  aria-describedby={errors[field.id] ? `${id}-error` : undefined}
                  onChange={(event) => set(event.target.value)}
                />
              )}
              {errors[field.id] ? (
                <p id={`${id}-error`} className={formStyles.error}>
                  {errors[field.id]}
                </p>
              ) : null}
            </div>
          );
        })}

        <section className={styles.meta} aria-label="Provenance">
          <p>
            <Icon name="database" size={14} />
            {record.source.label}
          </p>
          <p>
            Created {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)} · Revision{' '}
            {record.revision}
          </p>
        </section>
      </div>

      <footer className={styles.footer}>
        <Button variant="danger" icon="trash" loading={remove.isPending} onClick={onDelete}>
          Delete
        </Button>
        <div>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </footer>
    </form>
  );
}
