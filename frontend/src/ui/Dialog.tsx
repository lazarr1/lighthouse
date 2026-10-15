import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { IconButton } from './Button';
import styles from './Dialog.module.css';
import { Icon, type IconName } from './Icon';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  kicker?: { icon: IconName; label: string; tone?: 'ai' | 'data' };
  size?: 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
}

/** Modal dialog built on native `<dialog>` (focus trapping, Escape, inert background). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  kicker,
  size = 'md',
  children,
  footer,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className={styles.shell}>
          <header className={styles.header}>
            <div>
              {kicker ? (
                <span className={cx(styles.kicker, kicker.tone === 'data' && styles.kickerData)}>
                  <Icon name={kicker.icon} size={14} />
                  {kicker.label}
                </span>
              ) : null}
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <IconButton icon="close" label="Close" variant="quiet" onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
