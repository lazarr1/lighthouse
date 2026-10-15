import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/ui';
import { ChartBuilderDialog } from '../charts/ChartBuilderDialog';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { DashboardGrid } from './DashboardGrid';
import styles from './DashboardPage.module.css';
import { useDashboard } from './hooks';

export function DashboardPage() {
  const { workspace } = useWorkspace();
  if (!workspace.defaultDashboardId) {
    return (
      <EmptyState icon="grid" title="No dashboard yet">
        Dashboards appear here once your workspace has data.
      </EmptyState>
    );
  }
  return <Dashboard dashboardId={workspace.defaultDashboardId} />;
}

function Dashboard({ dashboardId }: { dashboardId: string }) {
  const { workspace } = useWorkspace();
  const dashboard = useDashboard(dashboardId);
  const [editing, setEditing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const datasetId = workspace.datasets[0]?.id;

  if (dashboard.isPending) return <LoadingState label="Loading dashboard…" />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={dashboard.data.name}
        note="A live picture of the data your team is tracking."
        actions={
          <>
            <Button
              icon={editing ? 'check' : 'layout'}
              variant={editing ? 'secondary' : 'quiet'}
              aria-pressed={editing}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Done editing' : 'Edit layout'}
            </Button>
            {datasetId ? (
              <Button variant="primary" icon="sparkle" onClick={() => setBuilderOpen(true)}>
                Add chart with AI
              </Button>
            ) : null}
          </>
        }
      />
      {editing ? (
        <p className={styles.editHint} role="status">
          Drag cards by their handle and pull the corner to resize. Keyboard users can use each card’s menu to
          move or resize it.
        </p>
      ) : null}
      {dashboard.data.widgets.length ? (
        <DashboardGrid dashboard={dashboard.data} editing={editing} />
      ) : (
        <EmptyState
          icon="sparkle"
          title="Your dashboard is empty"
          action={
            datasetId ? (
              <Button variant="primary" icon="sparkle" onClick={() => setBuilderOpen(true)}>
                Add your first chart
              </Button>
            ) : null
          }
        >
          Describe a chart in plain language and Lighthouse will build it from your data.
        </EmptyState>
      )}
      {datasetId ? (
        <ChartBuilderDialog
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          datasetId={datasetId}
          dashboardId={dashboardId}
        />
      ) : null}
    </>
  );
}
