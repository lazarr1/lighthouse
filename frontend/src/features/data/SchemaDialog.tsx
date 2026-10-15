import { useState, type FormEvent } from 'react';
import { describeError, hasCode } from '@/api/client';
import { FieldType, type Dataset, type Field, type SchemaChange, type SchemaImpact } from '@/api/contract';
import { FIELD_TYPE_LABELS } from '@/lib/fieldValues';
import { plural } from '@/lib/format';
import { Button, Dialog, Icon, IconButton, Pill, formStyles, useToast } from '@/ui';
import { useApplySchemaChange, usePreviewSchemaChange } from './hooks';
import { choicesFromText } from './schema';
import styles from './SchemaDialog.module.css';

function describeChange(change: SchemaChange, fields: Field[]): string {
  const name =
    'fieldId' in change ? (fields.find((field) => field.id === change.fieldId)?.name ?? 'field') : '';
  switch (change.op) {
    case 'addField':
      return `Add “${change.name}” (${FIELD_TYPE_LABELS[change.type]})`;
    case 'renameField':
      return `Rename “${name}” to “${change.name}”`;
    case 'changeFieldType':
      return `Change “${name}” to ${FIELD_TYPE_LABELS[change.type]}`;
    case 'deprecateField':
      return `Hide “${name}”`;
    case 'restoreField':
      return `Restore “${name}”`;
    case 'updateFieldConfig':
      return `Update options for “${name}”`;
  }
}

/**
 * Plain-language schema editor. Every change follows: propose → impact
 * assessment → (confirm if risky) → publish with optimistic concurrency.
 */
export function SchemaDialog({
  open,
  onClose,
  dataset,
}: {
  open: boolean;
  onClose: () => void;
  dataset: Dataset;
}) {
  const toast = useToast();
  const preview = usePreviewSchemaChange(dataset.id);
  const apply = useApplySchemaChange(dataset.id);
  const [review, setReview] = useState<{ changes: SchemaChange[]; impact: SchemaImpact } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newChoices, setNewChoices] = useState('');

  const active = dataset.fields.filter((field) => field.status === 'active');
  const hidden = dataset.fields.filter((field) => field.status === 'deprecated');
  const busy = preview.isPending || apply.isPending;

  const onError = (error: unknown) =>
    toast.error(
      hasCode(error, 'revision_conflict')
        ? 'The fields changed while you were editing. We’ve loaded the latest version — please try again.'
        : describeError(error),
    );

  const commit = (changes: SchemaChange[]) =>
    apply.mutate(
      { expectedSchemaVersion: dataset.schemaVersion, changes },
      {
        onSuccess: () => {
          setReview(null);
          toast.success(
            changes.length === 1
              ? `${describeChange(changes[0]!, dataset.fields)} — done.`
              : 'Fields updated.',
          );
        },
        onError,
      },
    );

  const propose = (changes: SchemaChange[]) =>
    preview.mutate(
      { expectedSchemaVersion: dataset.schemaVersion, changes },
      {
        onSuccess: (impact) =>
          impact.requiresConfirmation ? setReview({ changes, impact }) : commit(changes),
        onError,
      },
    );

  const addField = (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const isChoice = newType === 'singleSelect' || newType === 'multiSelect';
    propose([
      {
        op: 'addField',
        name: newName.trim(),
        type: newType,
        config: isChoice ? { choices: choicesFromText(newChoices) } : undefined,
      },
    ]);
    setNewName('');
    setNewChoices('');
  };

  const close = () => {
    setReview(null);
    setRenaming(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={review ? 'Review this change' : 'Manage fields'}
      kicker={{ icon: 'columns', label: 'Flexible schema', tone: 'data' }}
      description={
        review
          ? 'Lighthouse checked what this change affects before applying it.'
          : 'Add, rename or hide fields whenever your data needs to change. Charts keep working after a rename.'
      }
      footer={
        review ? (
          <>
            <Button onClick={() => setReview(null)}>Back</Button>
            <Button variant="primary" loading={apply.isPending} onClick={() => commit(review.changes)}>
              Apply change
            </Button>
          </>
        ) : (
          <>
            <span className={styles.footnote}>
              Schema version {dataset.schemaVersion}. Changes can be undone from history.
            </span>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </>
        )
      }
    >
      {review ? (
        <ImpactReview changes={review.changes} impact={review.impact} fields={dataset.fields} />
      ) : (
        <>
          <ul className={styles.list} aria-label="Fields">
            {active.map((field) => (
              <li key={field.id} className={styles.row}>
                {renaming === field.id ? (
                  <form
                    className={styles.renameForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get('name')?.toString().trim();
                      setRenaming(null);
                      if (value && value !== field.name)
                        propose([{ op: 'renameField', fieldId: field.id, name: value }]);
                    }}
                  >
                    <input
                      name="name"
                      className={formStyles.input}
                      defaultValue={field.name}
                      aria-label={`New name for ${field.name}`}
                      autoFocus
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </form>
                ) : (
                  <strong>
                    {field.name}
                    {field.id === dataset.primaryFieldId ? (
                      <Pill tone="green" dot={false}>
                        Primary
                      </Pill>
                    ) : null}
                  </strong>
                )}
                <select
                  className={formStyles.select}
                  aria-label={`Type of ${field.name}`}
                  value={field.type}
                  disabled={busy}
                  onChange={(event) =>
                    propose([
                      { op: 'changeFieldType', fieldId: field.id, type: event.target.value as FieldType },
                    ])
                  }
                >
                  {FieldType.options.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <div className={styles.rowActions}>
                  <IconButton
                    icon="edit"
                    label={`Rename ${field.name}`}
                    size="sm"
                    onClick={() => setRenaming(field.id)}
                  />
                  <IconButton
                    icon="eye"
                    label={`Hide ${field.name}`}
                    size="sm"
                    disabled={field.id === dataset.primaryFieldId || busy}
                    onClick={() => propose([{ op: 'deprecateField', fieldId: field.id }])}
                  />
                </div>
              </li>
            ))}
          </ul>

          {hidden.length ? (
            <section className={styles.hidden} aria-label="Hidden fields">
              <h3>Hidden fields</h3>
              {hidden.map((field) => (
                <div key={field.id} className={styles.hiddenRow}>
                  <span>
                    {field.name} · {FIELD_TYPE_LABELS[field.type]}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="undo"
                    onClick={() => propose([{ op: 'restoreField', fieldId: field.id }])}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </section>
          ) : null}

          <form className={styles.addForm} onSubmit={addField}>
            <div>
              <label className={formStyles.label} htmlFor="new-field-name">
                New field
              </label>
              <input
                id="new-field-name"
                className={formStyles.input}
                required
                maxLength={120}
                placeholder="e.g. Industry"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </div>
            <div>
              <label className={formStyles.label} htmlFor="new-field-type">
                Type
              </label>
              <select
                id="new-field-type"
                className={formStyles.select}
                value={newType}
                onChange={(event) => setNewType(event.target.value as FieldType)}
              >
                {FieldType.options.map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" icon="plus" loading={busy}>
              Add field
            </Button>
            {newType === 'singleSelect' || newType === 'multiSelect' ? (
              <div className={styles.choices}>
                <label className={formStyles.label} htmlFor="new-field-choices">
                  Options
                </label>
                <input
                  id="new-field-choices"
                  className={formStyles.input}
                  placeholder="Comma separated, e.g. SaaS, Retail, Health"
                  value={newChoices}
                  onChange={(event) => setNewChoices(event.target.value)}
                />
              </div>
            ) : null}
          </form>
        </>
      )}
    </Dialog>
  );
}

function ImpactReview({
  changes,
  impact,
  fields,
}: {
  changes: SchemaChange[];
  impact: SchemaImpact;
  fields: Field[];
}) {
  return (
    <div className={styles.review}>
      <ul className={styles.changeList}>
        {changes.map((change, index) => (
          <li key={index}>{describeChange(change, fields)}</li>
        ))}
      </ul>
      <p className={styles.summary}>
        <Icon name="alert" size={16} />
        {impact.summary}
      </p>
      {impact.conversions.map((conversion) => (
        <section key={conversion.fieldId} className={styles.section}>
          <h3>Value conversion</h3>
          <p>
            {plural(conversion.convertible, 'value')} will convert.{' '}
            {conversion.failed
              ? `${plural(conversion.failed, 'value')} can’t be converted and will be flagged for review.`
              : ''}
          </p>
          {conversion.examples.length ? (
            <ul className={styles.examples}>
              {conversion.examples.map((example) => (
                <li key={example.recordId}>
                  <code>{example.value}</code> — {example.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {impact.dependents.length ? (
        <section className={styles.section}>
          <h3>Affected charts and actions</h3>
          <ul className={styles.dependents}>
            {impact.dependents.map((dependent) => (
              <li key={dependent.id}>
                <Pill
                  tone={
                    dependent.effect === 'unaffected'
                      ? 'green'
                      : dependent.effect === 'broken'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {dependent.effect === 'unaffected'
                    ? 'Unaffected'
                    : dependent.effect === 'broken'
                      ? 'Will break'
                      : 'Needs attention'}
                </Pill>
                <span>
                  <strong>{dependent.name}</strong> — {dependent.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
