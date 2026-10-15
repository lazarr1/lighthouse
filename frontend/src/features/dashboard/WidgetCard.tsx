import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { ChartWidget, DataHealthWidget, Widget } from '@/api/contract';
import { cx } from '@/lib/cx';
import { formatCount, formatRelative, plural } from '@/lib/format';
import { Button, Dialog, ErrorState, Icon, IconButton, LoadingState, Menu, type MenuItem } from '@/ui';
import { ChartDataTable, ChartView } from '../charts/ChartView';
import { useDataset } from '../data/hooks';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { useWidgetData } from './hooks';
import styles from './WidgetCard.module.css';
import { widgetTitle } from './widgetTitle';

export interface WidgetCardProps {
  dashboardId: string;
  widget: Widget;
  editing: boolean;
  /** Extra menu items (move/resize) supplied by the grid in edit mode. */
  layoutItems: MenuItem[];
  onDuplicate: () => void;
  onRemove: () => void;
}

export function WidgetCard({
  dashboardId,
  widget,
  editing,
  layoutItems,
  onDuplicate,
  onRemove,
}: WidgetCardProps) {
  const [showData, setShowData] = useState(false);
  const title = widgetTitle(widget);
  const subtitle = widget.kind === 'chart' ? widget.definition.subtitle : 'Quality score';
  const isMetric = widget.kind === 'chart' && widget.definition.type === 'metric';

  const items: (MenuItem | 'separator')[] = [
    ...(widget.kind === 'chart'
      ? [{ id: 'data', label: 'View data', icon: 'table' as const, onSelect: () => setShowData(true) }]
      : []),
    { id: 'duplicate', label: 'Duplicate', icon: 'copy', onSelect: onDuplicate },
    ...(layoutItems.length ? (['separator', ...layoutItems] as const) : []),
    'separator',
    { id: 'remove', label: 'Remove from dashboard', icon: 'trash', tone: 'danger', onSelect: onRemove },
  ];

  return (
    <article
      className={cx(
        styles.card,
        isMetric && styles.metric,
        widget.status === 'needs_attention' && styles.attention,
      )}
      aria-label={title}
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          {editing ? (
            <span className={cx(styles.dragHandle, 'drag-handle')} title="Drag to move" aria-hidden="true">
              <Icon name="grip" size={16} />
            </span>
          ) : null}
          <div className={styles.titles}>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <Menu
          items={items}
          trigger={(props) => <IconButton {...props} icon="more" label={`${title} options`} size="sm" />}
        />
      </header>
      <div className={styles.body}>
        {widget.kind === 'chart' ? (
          <ChartWidgetBody dashboardId={dashboardId} widget={widget} />
        ) : (
          <DataHealthBody widget={widget} />
        )}
      </div>
      {widget.kind === 'chart' ? (
        <WidgetDataDialog
          open={showData}
          onClose={() => setShowData(false)}
          dashboardId={dashboardId}
          widget={widget}
        />
      ) : null}
    </article>
  );
}

function ChartWidgetBody({ dashboardId, widget }: { dashboardId: string; widget: ChartWidget }) {
  const data = useWidgetData(dashboardId, widget);
  if (widget.status === 'needs_attention') return <NeedsAttention issues={widget.issues} />;
  if (data.isPending) return <LoadingState compact label="Loading chart…" />;
  if (data.isError) return <ErrorState compact error={data.error} onRetry={() => data.refetch()} />;
  return <ChartView definition={widget.definition} result={data.data} />;
}

function NeedsAttention({ issues }: { issues: string[] }) {
  return (
    <div className={styles.needsAttention} role="alert">
      <span>
        <Icon name="alert" size={16} />
        Needs attention
      </span>
      <p>
        A schema change affected this chart. Its last approved version is kept, but it can’t run until it’s
        updated.
      </p>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function DataHealthBody({ widget }: { widget: DataHealthWidget }) {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const dataset = useDataset(widget.datasetId);
  if (dataset.isPending) return <LoadingState compact />;
  if (dataset.isError) return <ErrorState compact error={dataset.error} onRetry={() => dataset.refetch()} />;
  const { score, recordsNeedingReview } = dataset.data.health;
  const good = score >= 90;
  return (
    <div className={styles.health}>
      <div
        className={styles.ring}
        style={{ '--score': `${score}%` } as CSSProperties}
        role="img"
        aria-label={`Quality score ${score} out of 100`}
      >
        <div>
          <strong>{score}</strong>
          <span>/100</span>
        </div>
      </div>
      <div className={styles.healthCopy}>
        <strong>{good ? 'Looking good' : 'Needs some care'}</strong>
        <p>
          {recordsNeedingReview
            ? `${plural(recordsNeedingReview, 'record')} ${recordsNeedingReview === 1 ? 'needs' : 'need'} a little attention.`
            : 'Every record passes validation.'}
        </p>
        {recordsNeedingReview ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/w/${workspace.id}/data/${widget.datasetId}?issues=1`)}
          >
            Review records
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WidgetDataDialog({
  open,
  onClose,
  dashboardId,
  widget,
}: {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  widget: ChartWidget;
}) {
  const data = useWidgetData(dashboardId, widget);
  let content: ReactNode;
  if (data.isPending) content = <LoadingState />;
  else if (data.isError) content = <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  else
    content = (
      <>
        <ChartDataTable
          columns={data.data.columns}
          rows={data.data.rows}
          caption={widget.definition.accessibilitySummary}
        />
        <p className={styles.provenance}>
          Data revision {formatCount(data.data.meta.datasetRevision)} · generated{' '}
          {formatRelative(data.data.meta.generatedAt)}
          {data.data.meta.truncated ? ' · truncated to the chart limit' : ''}
        </p>
      </>
    );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={widget.definition.title}
      description={widget.definition.accessibilitySummary}
      kicker={{ icon: 'table', label: 'Underlying data', tone: 'data' }}
    >
      <div className={styles.dataDialog}>{content}</div>
    </Dialog>
  );
}
