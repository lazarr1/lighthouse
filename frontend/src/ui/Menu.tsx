import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import styles from './Menu.module.css';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  tone?: 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  /** Renders the trigger; spread the given props onto a button. */
  trigger: (props: {
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
    ref: (element: HTMLButtonElement | null) => void;
  }) => ReactNode;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
}

/** Accessible menu button (WAI-ARIA menu pattern): arrows, Home/End, Escape, outside click. */
export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const focusItem = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    if (!buttons?.length) return;
    buttons[(index + buttons.length) % buttons.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const buttons = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') focusItem(current + 1);
    else if (event.key === 'ArrowUp') focusItem(current - 1);
    else if (event.key === 'Home') focusItem(0);
    else if (event.key === 'End') focusItem(buttons.length - 1);
    else if (event.key === 'Escape' || event.key === 'Tab') close(event.key === 'Escape');
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={styles.wrap}>
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
        onClick: () => setOpen((value) => !value),
        ref: (element) => {
          triggerRef.current = element;
        },
      })}
      {open ? (
        <div
          ref={listRef}
          id={id}
          role="menu"
          className={cx(styles.menu, styles[align])}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) =>
            item === 'separator' ? (
              <div key={`sep-${index}`} role="separator" className={styles.separator} />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cx(styles.item, item.tone === 'danger' && styles.danger)}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon ? <Icon name={item.icon} size={15} /> : null}
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
