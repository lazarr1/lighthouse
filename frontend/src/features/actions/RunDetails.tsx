import type { ActionManifest, Field, PlanStep, ProposedChanges, Run, RunEvent } from '@/api/contract';
import { cx } from '@/lib/cx';
import { displayText } from '@/lib/fieldValues';
import { formatCount, formatDateTime } from '@/lib/format';
import { Icon, Pill, Spinner, type IconName } from '@/ui';
import styles from './RunDetails.module.css';

const PERMISSION_ICONS: Record<ActionManifest['permissions'][number]['kind'], IconName> = {
  read: 'eye',
  write: 'edit',
  network: 'globe',
  secret: 'key',
};

/** What an action is allowed to touch — shown before every approval. */
export function PermissionList({ manifest }: { manifest: ActionManifest }) {
  return (
    <div className={styles.permissions}>
      <ul aria-label="Permissions">
        {manifest.permissions.map((permission) => (
          <li
            key={`${permission.kind}-${permission.target}`}
            className={cx(permission.kind !== 'read' && styles.elevated)}
          >
            <Icon name={PERMISSION_ICONS[permission.kind]} size={14} />
            <span>{permission.description}</span>
          </li>
        ))}
      </ul>
      <p className={styles.limits}>
        Limits: up to {formatCount(manifest.limits.maxRecordsWritten)} records written ·{' '}
        {manifest.limits.timeoutSeconds}s ·{' '}
        {manifest.limits.maxNetworkRequests
          ? `${formatCount(manifest.limits.maxNetworkRequests)} web requests`
          : 'no internet access'}
      </p>
    </div>
  );
}

export const RUN_STATUS_TONE = {
  queued: 'grey',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'grey',
} as const;

export const RUN_STATUS_LABEL = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const;

const STEP_ICON: Record<Run['steps'][number]['status'], IconName | null> = {
  pending: null,
  running: null,
  succeeded: 'check',
  failed: 'alert',
  skipped: 'chevronRight',
};

/** Ordered step list with live status from a run. */
export function StepList({ steps, run }: { steps: PlanStep[]; run?: Run }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => {
        const status = run?.steps.find((item) => item.stepId === step.id);
        const icon = status ? STEP_ICON[status.status] : null;
        return (
          <li key={step.id} className={cx(status && styles[`step-${status.status}`])}>
            <span className={styles.stepMarker} aria-hidden="true">
              {status?.status === 'running' ? (
                <Spinner size={10} />
              ) : icon ? (
                <Icon name={icon} size={11} />
              ) : (
                index + 1
              )}
            </span>
            <span>
              <strong>{step.title}</strong>
              <small>{status?.message ?? step.detail}</small>
            </span>
            {status ? <span className="visually-hidden">{status.status}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function RunLog({ logs }: { logs: Extract<RunEvent, { type: 'log' }>[] }) {
  if (!logs.length) return null;
  return (
    <details className={styles.log}>
      <summary>Activity log ({logs.length})</summary>
      <ol>
        {logs.map((log, index) => (
          <li key={index} className={styles[`log-${log.level}`]}>
            <time dateTime={log.at}>{formatDateTime(log.at)}</time> {log.message}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Staged (dry run) or committed changes: counts plus a sample diff. */
export function ChangesSummary({ changes, fields }: { changes: ProposedChanges; fields: Field[] }) {
  const counts = [
    { label: 'new', value: changes.inserts, tone: 'green' as const },
    { label: 'updated', value: changes.updates, tone: 'blue' as const },
    { label: 'duplicates skipped', value: changes.duplicatesSkipped, tone: 'grey' as const },
    { label: 'rejected', value: changes.rejected, tone: 'red' as const },
  ].filter((count) => count.value > 0);
  const columns = [...new Set(changes.sample.flatMap((sample) => Object.keys(sample.values)))]
    .map((id) => fields.find((field) => field.id === id))
    .filter((field): field is Field => !!field)
    .slice(0, 3);
  const reasons = [
    ...new Set(changes.sample.map((sample) => sample.reason).filter((reason): reason is string => !!reason)),
  ].slice(0, 3);

  return (
    <div className={styles.changes}>
      <p className={styles.changesHeading}>
        {changes.committed ? 'Committed changes' : 'Proposed changes'}
        {!changes.committed ? <span> — nothing has been saved yet</span> : null}
      </p>
      {counts.length ? (
        <div className={styles.counts}>
          {counts.map((count) => (
            <Pill key={count.label} tone={count.tone} dot={false}>
              {formatCount(count.value)} {count.label}
            </Pill>
          ))}
        </div>
      ) : (
        <p className={styles.none}>No changes to make.</p>
      )}
      {changes.sample.length && columns.length ? (
        <div className={styles.sampleWrap}>
          <table className={styles.sample}>
            <thead>
              <tr>
                <th scope="col">Change</th>
                {columns.map((field) => (
                  <th key={field.id} scope="col">
                    {field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {changes.sample.slice(0, 8).map((sample, index) => (
                <tr
                  key={index}
                  className={styles[`sample-${sample.kind}`]}
                  title={sample.reason ?? undefined}
                >
                  <td>
                    {sample.kind === 'insert'
                      ? 'Add'
                      : sample.kind === 'update'
                        ? 'Update'
                        : sample.kind === 'duplicate'
                          ? 'Skip'
                          : 'Reject'}
                  </td>
                  {columns.map((field) => (
                    <td key={field.id}>{displayText(field, sample.values[field.id]) || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {reasons.length ? (
            <ul className={styles.reasons}>
              {reasons.map((reason) => (
                <li key={reason}>
                  <Icon name="info" size={12} /> {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
