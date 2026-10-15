import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Field } from '@/api/contract';
import styles from './DataGrid.module.css';

export interface CellEditorProps {
  field: Field;
  draft: string;
  error: string | null;
  onChange: (draft: string) => void;
  /** Commit with the key that ended editing (Enter / Tab / blur). */
  onCommit: (key: 'Enter' | 'Tab' | 'blur', shift: boolean) => void;
  onCancel: () => void;
}

/** In-cell editor. Select/date fields use native controls for accessibility and mobile keyboards. */
export function CellEditor({ field, draft, error, onChange, onCommit, onCancel }: CellEditorProps) {
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    if (element instanceof HTMLInputElement && ['text', 'search', 'url'].includes(element.type)) {
      const end = element.value.length;
      element.setSelectionRange(end, end);
    }
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      committed.current = true;
      onCancel();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      committed.current = true;
      onCommit(event.key, event.shiftKey);
    }
    event.stopPropagation();
  };

  const common = {
    ref,
    'aria-label': `Edit ${field.name}`,
    'aria-invalid': error ? true : undefined,
    className: styles.editor,
    onKeyDown,
    onBlur: () => {
      if (!committed.current) onCommit('blur', false);
    },
  };

  let control;
  if (field.type === 'singleSelect') {
    control = (
      <select {...common} value={draft} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {field.config.choices?.map((choice) => (
          <option key={choice.id} value={choice.label}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'boolean') {
    control = (
      <select {...common} value={draft} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  } else {
    const type = field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text';
    const inputMode =
      field.type === 'number' || field.type === 'money' || field.type === 'percent' ? 'decimal' : undefined;
    control = (
      <input
        {...common}
        type={type}
        inputMode={inputMode}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className={styles.editorWrap}>
      {control}
      {error ? (
        <span className={styles.editorError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
