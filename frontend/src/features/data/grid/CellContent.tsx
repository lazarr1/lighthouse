import type { CellValue, Field } from '@/api/contract';
import { choiceFor, displayText } from '@/lib/fieldValues';
import { Icon, Pill } from '@/ui';
import styles from './DataGrid.module.css';

/** Read-only rendering of a cell value by field type. */
export function CellContent({ field, value }: { field: Field; value: CellValue | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  switch (field.type) {
    case 'singleSelect': {
      const choice = choiceFor(field, String(value));
      return <Pill tone={choice?.color ?? 'grey'}>{choice?.label ?? String(value)}</Pill>;
    }
    case 'multiSelect':
      return (
        <span className={styles.pills}>
          {(Array.isArray(value) ? value : [String(value)]).map((id) => {
            const choice = choiceFor(field, id);
            return (
              <Pill key={id} tone={choice?.color ?? 'grey'} dot={false}>
                {choice?.label ?? id}
              </Pill>
            );
          })}
        </span>
      );
    case 'boolean':
      return value ? (
        <span className={styles.check}>
          <Icon name="check" size={14} label="Yes" />
        </span>
      ) : (
        <span className={styles.no}>No</span>
      );
    case 'url':
      return (
        <a
          className={styles.link}
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          onClick={(event) => {
            // A plain click selects the cell; ⌘/Ctrl-click follows the link.
            if (!event.metaKey && !event.ctrlKey) event.preventDefault();
          }}
        >
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      );
    default:
      return <>{displayText(field, value)}</>;
  }
}
