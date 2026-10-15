import { Navigate, Outlet, useParams } from 'react-router';
import { hasCode } from '@/api/client';
import { useSession, useWorkspaceQuery } from '@/features/workspace/hooks';
import { WorkspaceProvider } from '@/features/workspace/WorkspaceContext';
import { ErrorState, LoadingState } from '@/ui';
import { AppShell } from './AppShell';
import { NotFound } from './screens';
import styles from './AppShell.module.css';

/** `/` — send the user to their first workspace. */
export function RootRedirect() {
  const session = useSession();
  if (session.isPending) return <LoadingState label="Signing you in…" />;
  if (session.isError)
    return (
      <div className={styles.centered}>
        <ErrorState error={session.error} onRetry={() => session.refetch()} />
      </div>
    );
  const first = session.data.workspaces[0];
  return first ? <Navigate to={`/w/${first.id}/dashboard`} replace /> : <NotFound />;
}

/** `/w/:workspaceId/*` — loads the workspace and renders the shell around the page. */
export function WorkspaceLayout() {
  const { workspaceId = '' } = useParams();
  const session = useSession();
  const workspace = useWorkspaceQuery(workspaceId);

  if (session.isPending || workspace.isPending) {
    return (
      <div className={styles.centered}>
        <LoadingState label="Opening workspace…" />
      </div>
    );
  }
  if (workspace.isError && hasCode(workspace.error, 'not_found')) return <NotFound />;
  const error = session.error ?? workspace.error;
  if (error || !session.data || !workspace.data) {
    return (
      <div className={styles.centered}>
        <ErrorState
          error={error}
          onRetry={() => void Promise.all([session.refetch(), workspace.refetch()])}
        />
      </div>
    );
  }

  return (
    <WorkspaceProvider value={{ workspace: workspace.data, user: session.data.user }}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
