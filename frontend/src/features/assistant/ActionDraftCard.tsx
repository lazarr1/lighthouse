import { useState } from 'react';
import { Link } from 'react-router';
import { describeError, hasCode } from '@/api/client';
import type { ActionDraft } from '@/api/contract';
import { plural } from '@/lib/format';
import { Button, Icon, ProgressLine, useToast } from '@/ui';
import { isTerminal, useApproveDraft, useRun, useStartDryRun } from '../actions/hooks';
import { ChangesSummary, PermissionList, RunLog, StepList } from '../actions/RunDetails';
import { useDataset, useRevertChangeSet } from '../data/hooks';
import { useWorkspace } from '../workspace/WorkspaceContext';
import styles from './AssistantPanel.module.css';

/**
 * One proposed action, through its whole safety lifecycle:
 * plan → preview (dry run on a snapshot) → approve exact hash → live run → undo.
 */
export function ActionDraftCard({ draft }: { draft: ActionDraft }) {
  if (draft.status === 'rejected') {
    return (
      <section className={styles.plan} data-tone="error" aria-label={draft.title}>
        <h3>
          <Icon name="shield" size={14} />I can’t do that as an action
        </h3>
        <p>{draft.rejectionReason}</p>
      </section>
    );
  }
  if (draft.status === 'needs_input') {
    return (
      <section className={styles.plan} aria-label={draft.title}>
        <h3>
          <Icon name="sparkle" size={14} />
          {draft.title}
        </h3>
        <p>{draft.interpretation}</p>
        <ul className={styles.questions}>
          {draft.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
        <p className={styles.hint}>Reply below and I’ll update the plan.</p>
      </section>
    );
  }
  return <ReadyDraft draft={draft} />;
}

function ReadyDraft({ draft }: { draft: ActionDraft }) {
  const toast = useToast();
  const { workspace } = useWorkspace();
  const datasetId = draft.manifest.outputs[0] ?? draft.manifest.inputs[0] ?? '';
  const dataset = useDataset(datasetId);
  const startDryRun = useStartDryRun();
  const approve = useApproveDraft();
  const revert = useRevertChangeSet(datasetId);
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const dryRun = useRun(dryRunId ?? undefined);
  const liveRun = useRun(liveRunId ?? undefined);
  const fields = dataset.data?.fields ?? [];

  const preview = () =>
    startDryRun.mutate(draft.id, {
      onSuccess: (run) => setDryRunId(run.id),
      onError: (error) => toast.error(describeError(error)),
    });

  const onApprove = (runNow: boolean) => {
    if (!dryRunId) return;
    approve.mutate(
      { draftId: draft.id, hash: draft.hash, dryRunId, runNow },
      {
        onSuccess: ({ action, run }) => {
          setActionId(action.id);
          if (run) setLiveRunId(run.id);
          else toast.success(`Saved “${action.name}”. Run it any time from Actions.`);
        },
        onError: (error) =>
          toast.error(
            hasCode(error, 'approval_invalidated')
              ? 'This plan changed after you previewed it. Preview it again before approving.'
              : describeError(error),
          ),
      },
    );
  };

  const dry = dryRun.data;
  const live = liveRun.data;
  const dryDone = dry?.status === 'succeeded';
  const committed = live?.status === 'succeeded' ? live.changes : null;

  return (
    <section className={styles.plan} aria-label={draft.title}>
      <h3>
        <Icon name="sparkle" size={14} />
        {draft.title}
      </h3>
      <p>{draft.interpretation}</p>

      <StepList steps={draft.steps} run={live ?? dry} />

      <details className={styles.permissionsBox} open={!dryRunId}>
        <summary>
          <Icon name="shield" size={13} /> What this action can access
        </summary>
        <PermissionList manifest={draft.manifest} />
      </details>

      {dry && !isTerminal(dry) ? <ProgressLine label="Previewing on a read-only copy of your data…" /> : null}
      {dry?.status === 'failed' ? <p className={styles.error}>Preview failed: {dry.error?.message}</p> : null}
      {dryDone && dry.changes && !live ? <ChangesSummary changes={dry.changes} fields={fields} /> : null}

      {live && !isTerminal(live) ? <ProgressLine label="Running your approved action…" /> : null}
      {live?.status === 'failed' ? (
        <p className={styles.error}>The run failed and nothing was changed: {live.error?.message}</p>
      ) : null}
      {committed ? (
        <div className={styles.done} role="status">
          <Icon name="check" size={15} />
          <span>
            Done — {plural(committed.inserts, 'record')} added
            {committed.updates ? `, ${plural(committed.updates, 'record')} updated` : ''}.
          </span>
          {committed.changeSetId ? (
            <Button
              size="sm"
              variant="ghost"
              icon="undo"
              loading={revert.isPending}
              disabled={revert.isSuccess}
              onClick={() =>
                revert.mutate(committed.changeSetId!, {
                  onSuccess: () => toast.success('Action changes undone.'),
                  onError: (error) => toast.error(describeError(error)),
                })
              }
            >
              {revert.isSuccess ? 'Undone' : 'Undo'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <RunLog logs={live ? liveRun.logs : dryRun.logs} />

      <footer className={styles.planFooter}>
        {!dryRunId ? (
          <>
            <span>Nothing changes until you approve.</span>
            <Button size="sm" variant="ai" icon="eye" loading={startDryRun.isPending} onClick={preview}>
              Preview changes
            </Button>
          </>
        ) : dryDone && !actionId ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              loading={approve.isPending && !approve.variables?.runNow}
              onClick={() => onApprove(false)}
            >
              Save for later
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon="check"
              loading={approve.isPending && approve.variables?.runNow}
              onClick={() => onApprove(true)}
            >
              Approve &amp; run
            </Button>
          </>
        ) : actionId ? (
          <>
            <span>Approved version {draft.hash.slice(0, 10)}</span>
            <Link className={styles.link} to={`/w/${workspace.id}/actions/${actionId}`}>
              Open in Actions →
            </Link>
          </>
        ) : null}
      </footer>
    </section>
  );
}
