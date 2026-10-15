import { useState, type FormEvent } from 'react';
import { describeError } from '@/api/client';
import type { ChartDraft } from '@/api/contract';
import { Button, Dialog, Icon, ProgressLine, formStyles, useToast } from '@/ui';
import { useAddWidget } from '../dashboard/hooks';
import styles from './ChartBuilderDialog.module.css';
import { ChartView } from './ChartView';
import { useCreateChartDraft } from './hooks';

const SUGGESTIONS = [
  'Opportunities by stage',
  'New leads by month',
  'Pipeline value by owner',
  'Share of leads by source',
];

const TYPE_LABELS: Record<ChartDraft['definition']['type'], string> = {
  bar: 'Bar chart',
  horizontalBar: 'Bar chart',
  line: 'Line chart',
  area: 'Area chart',
  donut: 'Donut chart',
  metric: 'Single number',
  table: 'Table',
};

export interface ChartBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  datasetId: string;
  dashboardId: string;
}

/**
 * Describe → preview → refine → add. Nothing reaches the dashboard until the
 * user confirms; the server publishes the exact previewed definition.
 */
export function ChartBuilderDialog({ open, onClose, datasetId, dashboardId }: ChartBuilderDialogProps) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [refinement, setRefinement] = useState('');
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const createDraft = useCreateChartDraft();
  const addWidget = useAddWidget(dashboardId);

  const close = () => {
    setPrompt('');
    setRefinement('');
    setDraft(null);
    createDraft.reset();
    onClose();
  };

  const generate = (text: string, refineDraftId?: string) => {
    if (!text.trim()) return;
    createDraft.mutate(
      { datasetId, prompt: text.trim(), refineDraftId },
      {
        onSuccess: (result) => {
          setDraft(result);
          setRefinement('');
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    generate(prompt);
  };

  const confirm = () => {
    if (!draft) return;
    addWidget.mutate(draft.id, {
      onSuccess: () => {
        toast.success(`${draft.definition.title} is now on your dashboard.`);
        close();
      },
      onError: (error) => toast.error(describeError(error)),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      kicker={{ icon: 'sparkle', label: 'AI chart builder', tone: 'ai' }}
      title="Describe the chart you need"
      description="Lighthouse uses the fields in your data and shows a preview before anything is added to your dashboard."
      footer={
        <>
          <span className={styles.confirmation}>
            <Icon name="check" size={14} />
            You can move, resize or remove it later.
          </span>
          <div className={styles.footerButtons}>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!draft || createDraft.isPending}
              loading={addWidget.isPending}
              onClick={confirm}
            >
              Add to dashboard
            </Button>
          </div>
        </>
      }
    >
      <div className={styles.body}>
        <form className={styles.step} onSubmit={onSubmit}>
          <span className={styles.stepNumber}>1</span>
          <div>
            <label className={formStyles.label} htmlFor="chart-prompt">
              What would you like to see?
            </label>
            <div className={styles.promptRow}>
              <textarea
                id="chart-prompt"
                className={formStyles.textarea}
                rows={2}
                value={prompt}
                maxLength={2000}
                placeholder="e.g. Show pipeline value by owner"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    generate(prompt);
                  }
                }}
              />
              <Button
                type="submit"
                variant="ai"
                icon="sparkle"
                loading={createDraft.isPending && !draft}
                disabled={!prompt.trim()}
              >
                Preview
              </Button>
            </div>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setPrompt(suggestion);
                    generate(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </form>

        <section className={styles.step} aria-label="Preview">
          <span className={styles.stepNumber}>2</span>
          <div className={styles.preview} aria-busy={createDraft.isPending}>
            {createDraft.isPending && !draft ? (
              <ProgressLine label="Designing your chart…" />
            ) : createDraft.isError ? (
              <p className={styles.error} role="alert">
                <Icon name="alert" size={15} />
                {describeError(createDraft.error)}
              </p>
            ) : draft ? (
              <>
                <header className={styles.previewHeader}>
                  <div>
                    <small>AI suggestion</small>
                    <h3>{draft.definition.title}</h3>
                    <p>{draft.definition.subtitle}</p>
                  </div>
                  <span className={styles.tag}>{TYPE_LABELS[draft.definition.type]}</span>
                </header>
                <div className={styles.previewChart}>
                  <ChartView definition={draft.definition} result={draft.preview} dense />
                </div>
                <p className={styles.explain}>
                  <Icon name="sparkle" size={13} />
                  <span>{draft.explanation}</span>
                </p>
                {draft.warnings.map((warning) => (
                  <p key={warning} className={styles.warning}>
                    <Icon name="info" size={13} />
                    {warning}
                  </p>
                ))}
                <form
                  className={styles.refine}
                  onSubmit={(event) => {
                    event.preventDefault();
                    generate(refinement, draft.id);
                  }}
                >
                  <input
                    className={formStyles.input}
                    aria-label="Refine the chart"
                    placeholder="Refine it — e.g. “as a line chart” or “only won deals”"
                    value={refinement}
                    onChange={(event) => setRefinement(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    loading={createDraft.isPending}
                    disabled={!refinement.trim()}
                  >
                    Update
                  </Button>
                </form>
              </>
            ) : (
              <p className={styles.placeholder}>Your preview will appear here.</p>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
