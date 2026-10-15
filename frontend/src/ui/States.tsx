import type { ReactNode } from 'react';
import { describeError, isApiError } from '@/api/client';
import { cx } from '@/lib/cx';
import { Button } from './Button';
import styles from './Feedback.module.css';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

export function LoadingState({ label = 'Loading…', compact }: { label?: string; compact?: boolean }) {
  return (
    <div className={cx(styles.state, compact && styles.compact)} role="status">
      <Spinner size={18} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx(styles.state, compact && styles.compact)}>
      <span className={styles.stateIcon}>
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  title = 'Couldn’t load this',
  onRetry,
  compact,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cx(styles.state, styles.stateError, compact && styles.compact)} role="alert">
      <span className={styles.stateIcon}>
        <Icon name="alert" />
      </span>
      <h3>{title}</h3>
      <p>{describeError(error)}</p>
      {isApiError(error) ? (
        <span className={styles.code}>
          {error.code}
          {error.requestId ? ` · ${error.requestId}` : ''}
        </span>
      ) : null}
      {onRetry ? (
        <Button size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
