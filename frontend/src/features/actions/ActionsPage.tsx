import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { describeError } from '@/api/client';
import type { Action, Run } from '@/api/contract';
import { cx } from '@/lib/cx';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Button, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Pill, useToast } from '@/ui';
import { useAssistant } from '../assistant/AssistantContext';
import { useDataset } from '../data/hooks';
import { useWorkspace } from '../workspace/WorkspaceContext';
import styles from './ActionsPage.module.css';
import {
  isTerminal,
  useAction,
  useActions,
  useCancelRun,
  useRun,
  useRuns,
  useStartRun,
  useUpdateAction,
} from './hooks';
import {
  ChangesSummary,
  PermissionList,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  RunLog,
  StepList,
} from './RunDetails';
import { ScheduleEditor } from './ScheduleEditor';

export function ActionsPage() {
  const { actionId } = useParams();
  const { workspace } = useWorkspace();
  const assistant = useAssistant();
  const navigate = useNavigate();
  const actions = useActions();

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Actions"
        note="Approved, repeatable work. Every run uses the exact version you approved."
        actions={
          <Button variant="primary" icon="sparkle" onClick={() => assistant.focus('')}>
            New action
          </Button>
        }
      />
      {actions.isPending ? (
        <LoadingState label="Loading actions…" />
      ) : actions.isError ? (
        <ErrorState error={actions.error} onRetry={() => actions.refetch()} />
      ) : actions.data.length === 0 ? (
        <EmptyState
          icon="bolt"
          title="No actions yet"
          action={
            <Button variant="primary" icon="sparkle" onClick={() => assistant.focus()}>
              Describe an action
            </Button>
          }
        >
          Describe what you want done in plain language. You’ll review the plan and preview its changes before
          approving.
        </EmptyState>
      ) : (
        <div className={styles.layout}>
          <nav className={styles.list} aria-label="Actions">
            {actions.data.map((action) => (
              <Link
                key={action.id}
                to={`/w/${workspace.id}/actions/${action.id}`}
                className={cx(styles.listItem, action.id === actionId && styles.selected)}
                aria-current={action.id === actionId ? 'page' : undefined}
              >
                <span className={styles.listTitle}>
                  <strong>{action.name}</strong>
                  <Pill tone={action.status === 'active' ? 'green' : 'grey'}>
                    {action.status === 'active' ? 'Active' : 'Paused'}
                  </Pill>
                </span>
                <span className={styles.listMeta}>
                  <Icon name="clock" size={12} />
                  {action.schedule?.enabled ? action.schedule.description : 'Manual only'}
                </span>
                {action.lastRun ? (
                  <span className={styles.listMeta}>
                    <i className={styles[`dot-${action.lastRun.status}`]} />
                    Last run {RUN_STATUS_LABEL[action.lastRun.status].toLowerCase()}{' '}
                    {formatRelative(action.lastRun.createdAt)}
                  </span>
                ) : (
                  <span className={styles.listMeta}>Never run</span>
                )}
              </Link>
            ))}
          </nav>
          <div className={styles.detail}>
            {actionId ? (
              <ActionDetail key={actionId} actionId={actionId} />
            ) : (
              <EmptyState icon="bolt" title="Select an action">
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => actions.data[0] && navigate(actions.data[0].id)}
                >
                  Open {actions.data[0]?.name}
                </button>
              </EmptyState>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ActionDetail({ actionId }: { actionId: string }) {
  const toast = useToast();
  const action = useAction(actionId);
  const runs = useRuns(actionId);
  const startRun = useStartRun();
  const updateAction = useUpdateAction();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (action.isPending) return <LoadingState />;
  if (action.isError) return <ErrorState error={action.error} onRetry={() => action.refetch()} />;
  const data = action.data;
  const version = data.currentVersion;
  const paused = data.status === 'paused';
  const runId = selectedRunId ?? runs.data?.[0]?.id ?? null;

  return (
    <article className={styles.detailCard} aria-label={data.name}>
      <header className={styles.detailHeader}>
        <div>
          <h2>{data.name}</h2>
          <p>{data.description}</p>
        </div>
        <div className={styles.detailActions}>
          <Button
            icon={paused ? 'play' : 'pause'}
            loading={updateAction.isPending}
            onClick={() =>
              updateAction.mutate(
                { actionId, status: paused ? 'active' : 'paused' },
                {
                  onSuccess: () =>
                    toast.success(paused ? 'Action resumed.' : 'Action paused. Scheduled runs are on hold.'),
                  onError: (e) => toast.error(describeError(e)),
                },
              )
            }
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="primary"
            icon="play"
            disabled={paused}
            title={paused ? 'Resume the action to run it' : undefined}
            loading={startRun.isPending}
            onClick={() =>
              startRun.mutate(actionId, {
                onSuccess: (run) => {
                  setSelectedRunId(run.id);
                  toast.success('Run started.');
                },
                onError: (e) => toast.error(describeError(e)),
              })
            }
          >
            Run now
          </Button>
        </div>
      </header>

      <div className={styles.sections}>
        <section className={styles.section}>
          <h3>How it works</h3>
          <StepList steps={version.steps} />
        </section>
        <section className={styles.section}>
          <h3>What it can access</h3>
          <PermissionList manifest={version.manifest} />
        </section>
        <section className={styles.section}>
          <h3>Approved version</h3>
          <dl className={styles.facts}>
            <dt>Version</dt>
            <dd>v{version.version}</dd>
            <dt>Content hash</dt>
            <dd>
              <code>{version.hash}</code>
            </dd>
            <dt>Approved</dt>
            <dd>
              {version.approvedBy}, {formatDateTime(version.approvedAt)}
            </dd>
          </dl>
          <p className={styles.note}>
            Any change to steps, permissions or destinations needs a new approval.
          </p>
        </section>
        <section className={styles.section}>
          <h3>Schedule</h3>
          <ScheduleEditor action={data} />
        </section>
      </div>

      <section className={styles.history}>
        <h3>Run history</h3>
        {runs.isPending ? (
          <LoadingState compact />
        ) : runs.isError ? (
          <ErrorState compact error={runs.error} onRetry={() => runs.refetch()} />
        ) : runs.data.length === 0 ? (
          <p className={styles.note}>No runs yet.</p>
        ) : (
          <div className={styles.historyLayout}>
            <ol className={styles.runList}>
              {runs.data.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    className={cx(styles.runItem, run.id === runId && styles.selected)}
                    onClick={() => setSelectedRunId(run.id)}
                    aria-pressed={run.id === runId}
                  >
                    <Pill tone={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Pill>
                    <span>
                      {formatDateTime(run.createdAt)}
                      <small>
                        {run.trigger === 'schedule'
                          ? 'Scheduled'
                          : run.trigger === 'approval'
                            ? 'On approval'
                            : 'Manual'}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {runId ? <RunPanel key={runId} runId={runId} action={data} /> : null}
          </div>
        )}
      </section>
    </article>
  );
}

function RunPanel({ runId, action }: { runId: string; action: Action }) {
  const toast = useToast();
  const run = useRun(runId);
  const cancel = useCancelRun();
  const dataset = useDataset(action.currentVersion.manifest.outputs[0] ?? '');
  if (run.isPending) return <LoadingState compact />;
  if (run.isError) return <ErrorState compact error={run.error} onRetry={() => run.refetch()} />;
  const data: Run = run.data;
  return (
    <div className={styles.runPanel} aria-label="Run details">
      <header>
        <Pill tone={RUN_STATUS_TONE[data.status]}>{RUN_STATUS_LABEL[data.status]}</Pill>
        <span>
          {data.finishedAt
            ? `Finished ${formatRelative(data.finishedAt)}`
            : data.startedAt
              ? `Started ${formatRelative(data.startedAt)}`
              : 'Waiting to start'}
        </span>
        {!isTerminal(data) ? (
          <Button
            size="sm"
            variant="danger"
            loading={cancel.isPending}
            onClick={() => cancel.mutate(runId, { onError: (e) => toast.error(describeError(e)) })}
          >
            Cancel
          </Button>
        ) : null}
      </header>
      <StepList steps={action.currentVersion.steps} run={data} />
      {data.error ? (
        <p className={styles.runError} role="alert">
          <Icon name="alert" size={14} /> {data.error.message} No data was changed.
        </p>
      ) : null}
      {data.changes ? <ChangesSummary changes={data.changes} fields={dataset.data?.fields ?? []} /> : null}
      <RunLog logs={run.logs} />
      <p className={styles.note}>
        Ran version <code>{data.artifactHash}</code>
      </p>
    </div>
  );
}
