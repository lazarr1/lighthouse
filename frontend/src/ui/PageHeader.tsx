import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({
  eyebrow,
  title,
  note,
  actions,
}: {
  eyebrow: string;
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
