import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button, EmptyState, ErrorState } from '@/ui';
import styles from './AppShell.module.css';

export function NotFound() {
  return (
    <div className={styles.centered}>
      <EmptyState icon="search" title="Page not found" action={<Link to="/">Go to your workspace</Link>}>
        The link may be out of date, or you may not have access.
      </EmptyState>
    </div>
  );
}

export function SignedOut({ loginUrl }: { loginUrl: string }) {
  return (
    <div className={styles.centered}>
      <EmptyState
        icon="key"
        title="You’re signed out"
        action={
          <Button variant="primary" onClick={() => window.location.assign(loginUrl)}>
            Sign in
          </Button>
        }
      >
        Your session ended. Sign in again to continue — unsaved edits in open forms may need to be re-entered.
      </EmptyState>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <div className={styles.centered}>
      <ErrorState title="Something went wrong" error={error} onRetry={() => window.location.reload()} />
    </div>
  );
}
