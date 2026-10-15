import styles from './Feedback.module.css';

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Indeterminate progress bar for long-running AI and run work. */
export function ProgressLine({ label }: { label: string }) {
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <p>{label}</p>
      <div className={styles.progressTrack}>
        <i />
      </div>
    </div>
  );
}
