import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { AssistantProvider, useAssistant } from '@/features/assistant/AssistantContext';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { useWorkspace } from '@/features/workspace/WorkspaceContext';
import { cx } from '@/lib/cx';
import { formatCount, initials } from '@/lib/format';
import { useMediaQuery } from '@/lib/hooks';
import { Icon, IconButton, Menu } from '@/ui';
import styles from './AppShell.module.css';
import { readConfig } from './config';

export function AppShell({ children }: { children: ReactNode }) {
  const wide = useMediaQuery('(min-width: 1101px)');
  return (
    <AssistantProvider defaultOpen={wide}>
      <ShellFrame>{children}</ShellFrame>
    </AssistantProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { workspace, user } = useWorkspace();
  const assistant = useAssistant();
  const navigate = useNavigate();
  const saving = useIsMutating();
  const loading = useIsFetching();
  const base = `/w/${workspace.id}`;
  const recordCount = workspace.datasets.reduce((sum, dataset) => sum + dataset.recordCount, 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        assistant.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [assistant]);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.topbar}>
        <Link className={styles.brand} to={`${base}/dashboard`} aria-label="Lighthouse home">
          <span className={styles.brandMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Lighthouse</span>
        </Link>
        <div className={styles.workspaceName}>
          <span>{workspace.name}</span>
          <span className={styles.savedState} role="status" aria-live="polite">
            <span className={cx(styles.savedDot, saving > 0 && styles.savingDot)} />
            {saving > 0 ? 'Saving…' : loading > 0 ? 'Syncing…' : 'All changes saved'}
          </span>
        </div>
        <div className={styles.topbarActions}>
          <IconButton
            icon="search"
            label="Search records"
            variant="onDark"
            onClick={() => navigate(`${base}/data`)}
          />
          <IconButton
            icon="sparkle"
            label={assistant.open ? 'Hide assistant' : 'Show assistant'}
            variant="onDark"
            aria-pressed={assistant.open}
            onClick={() => assistant.setOpen(!assistant.open)}
          />
          <Menu
            items={[
              { id: 'contract', label: 'API contract', icon: 'code', onSelect: () => navigate('/dev/api') },
              'separator',
              {
                id: 'signout',
                label: 'Sign out',
                icon: 'close',
                onSelect: () => window.location.assign(`${readConfig().apiBaseUrl}/v1/auth/logout`),
              },
            ]}
            trigger={(props) => (
              <button {...props} type="button" className={styles.avatar} aria-label={`Account: ${user.name}`}>
                {initials(user.name)}
              </button>
            )}
          />
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Workspace views">
        <NavLink
          to={`${base}/dashboard`}
          className={({ isActive }) => cx(styles.tab, isActive && styles.activeTab)}
        >
          <Icon name="grid" size={16} />
          Dashboard
        </NavLink>
        <NavLink
          to={`${base}/data`}
          className={({ isActive }) => cx(styles.tab, isActive && styles.activeTab)}
        >
          <Icon name="table" size={16} />
          Data <span className={styles.badge}>{formatCount(recordCount)}</span>
        </NavLink>
        <NavLink
          to={`${base}/actions`}
          className={({ isActive }) => cx(styles.tab, isActive && styles.activeTab)}
        >
          <Icon name="bolt" size={16} />
          Actions
        </NavLink>
        <span className={styles.spacer} />
        <button type="button" className={styles.hint} onClick={() => assistant.focus()}>
          <kbd>⌘</kbd>
          <kbd>K</kbd> Ask AI
        </button>
      </nav>

      <div className={styles.body}>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <AssistantPanel />
      </div>
    </div>
  );
}
