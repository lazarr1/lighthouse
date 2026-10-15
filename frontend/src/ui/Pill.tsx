import type { ReactNode } from 'react';
import type { ChoiceColor } from '@/api/contract';
import { cx } from '@/lib/cx';
import styles from './Pill.module.css';

export type PillTone = ChoiceColor;

export function Pill({
  tone = 'grey',
  dot = true,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return <span className={cx(styles.pill, styles[tone], dot && styles.dot)}>{children}</span>;
}
