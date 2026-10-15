import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { CellValue, DataRecord, Field, RecordSort } from '@/api/contract';
import { cx } from '@/lib/cx';
import {
  displayText,
  editText,
  FIELD_TYPE_GLYPHS,
  FIELD_TYPE_LABELS,
  isNumericType,
  parseInput,
  sameValue,
} from '@/lib/fieldValues';
import { Spinner } from '@/ui';
import { CellContent } from './CellContent';
import { CellEditor } from './CellEditor';
import { defaultColumnWidth } from './columns';
import styles from './DataGrid.module.css';
import {
  afterCommit,
  gridReducer,
  initialGridState,
  isPrintable,
  navigationFor,
  parseClipboard,
} from './gridState';

export const ROW_HEIGHT = 34;
const ROW_HEADER_WIDTH = 56;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface CellChange {
  record: DataRecord;
  values: Record<string, CellValue>;
}

export interface DataGridProps {
  fields: Field[];
  records: DataRecord[];
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  sort: RecordSort | null;
  onSortChange: (sort: RecordSort | null) => void;
  /** Called with one change per record (paste can touch several). */
  onCommit: (changes: CellChange[]) => void;
  onOpenRecord: (record: DataRecord) => void;
  onUndo: () => void;
  /** Non-fatal problems (e.g. some pasted values were invalid). */
  onProblem: (message: string) => void;
  /** Column widths persisted by the caller (field ID → px). */
  columnWidths: Record<string, number>;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

/**
 * Spreadsheet-like editor over server-paged records. Virtualised rows keep it
 * responsive on very large datasets; this component is the only place that
 * knows how the grid is drawn, so it can be replaced by a commercial grid
 * behind the same props.
 */
export function DataGrid(props: DataGridProps) {
  const {
    fields,
    records,
    totalCount,
    hasMore,
    loadingMore,
    onLoadMore,
    sort,
    onSortChange,
    onCommit,
    onOpenRecord,
    onUndo,
    onProblem,
  } = props;
  const [state, dispatch] = useReducer(gridReducer, initialGridState);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const rows = records.length;
  const cols = fields.length;

  const widths = useMemo(
    () =>
      fields.map((field, index) => props.columnWidths[field.id] ?? defaultColumnWidth(field, index === 0)),
    [fields, props.columnWidths],
  );
  const template = `${ROW_HEADER_WIDTH}px ${widths.map((width) => `${width}px`).join(' ')}`;
  const totalWidth = ROW_HEADER_WIDTH + widths.reduce((sum, width) => sum + width, 0);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    initialRect: { width: 1200, height: 640 },
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVisible = virtualRows.at(-1)?.index ?? 0;

  useEffect(() => {
    if (hasMore && !loadingMore && lastVisible >= rows - 25) onLoadMore();
  }, [hasMore, loadingMore, lastVisible, rows, onLoadMore]);

  // Keep the selection valid when the data underneath changes (filters, deletes).
  useEffect(() => {
    if (state.active && (state.active.row >= rows || state.active.col >= cols)) dispatch({ type: 'clear' });
  }, [rows, cols, state.active]);

  const cellId = (row: number, col: number) => `${idPrefix}-r${row}-c${col}`;
  const activeRecord = state.active ? records[state.active.row] : undefined;
  const activeField = state.active ? fields[state.active.col] : undefined;

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  const commitValue = useCallback(
    (record: DataRecord, field: Field, value: CellValue) => {
      if (sameValue(record.values[field.id], value)) return;
      onCommit([{ record, values: { [field.id]: value } }]);
    },
    [onCommit],
  );

  const moveBy = (rowDelta: number, colDelta: number) => {
    dispatch({ type: 'move', rowDelta, colDelta, rows, cols });
    if (state.active) virtualizer.scrollToIndex(Math.max(0, Math.min(rows - 1, state.active.row + rowDelta)));
  };

  const commitEdit = (key: 'Enter' | 'Tab' | 'blur', shift: boolean) => {
    if (!activeRecord || !activeField) return;
    const parsed = parseInput(activeField, state.draft);
    if (!parsed.ok) {
      if (key === 'blur') dispatch({ type: 'endEdit' });
      else dispatch({ type: 'rejectDraft', error: parsed.error });
      return;
    }
    commitValue(activeRecord, activeField, parsed.value);
    dispatch({ type: 'endEdit' });
    if (key !== 'blur') {
      const { rowDelta, colDelta } = afterCommit(key, shift);
      moveBy(rowDelta, colDelta);
      focusGrid();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (state.editing || rows === 0) return;
    const meta = event.metaKey || event.ctrlKey;

    const navigation = navigationFor(event.key, { shift: event.shiftKey, meta }, rows, cols);
    if (navigation) {
      event.preventDefault();
      dispatch(navigation);
      const next = gridReducer(state, navigation).active;
      if (next) virtualizer.scrollToIndex(next.row);
      return;
    }
    if (!activeRecord || !activeField) {
      if (event.key === 'Enter' || isPrintable(event))
        dispatch({ type: 'select', position: { row: 0, col: 0 } });
      return;
    }
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      onUndo();
    } else if (meta && event.key.toLowerCase() === 'd' && state.active && state.active.row > 0) {
      // Fill down from the row above.
      event.preventDefault();
      const above = records[state.active.row - 1];
      if (above) commitValue(activeRecord, activeField, above.values[activeField.id] ?? null);
    } else if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      onOpenRecord(activeRecord);
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      dispatch({ type: 'startEdit', draft: editText(activeField, activeRecord.values[activeField.id]) });
    } else if (event.key === ' ' && activeField.type === 'boolean') {
      event.preventDefault();
      commitValue(activeRecord, activeField, activeRecord.values[activeField.id] !== true);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (activeField.required) onProblem(`${activeField.name} can’t be empty.`);
      else commitValue(activeRecord, activeField, null);
    } else if (isPrintable(event) && activeField.type !== 'boolean' && activeField.type !== 'singleSelect') {
      event.preventDefault();
      dispatch({ type: 'startEdit', draft: event.key });
    }
  };

  const onCopy = (event: ClipboardEvent) => {
    if (state.editing || !activeRecord || !activeField) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', displayText(activeField, activeRecord.values[activeField.id]));
  };

  const onPaste = (event: ClipboardEvent) => {
    if (state.editing || !state.active) return;
    event.preventDefault();
    const block = parseClipboard(event.clipboardData.getData('text/plain'));
    const changes = new Map<string, CellChange>();
    let rejected = 0;
    block.forEach((line, rowOffset) => {
      const record = records[state.active!.row + rowOffset];
      if (!record) return;
      line.forEach((text, colOffset) => {
        const field = fields[state.active!.col + colOffset];
        if (!field) return;
        const parsed = parseInput(field, text);
        if (!parsed.ok) {
          rejected += 1;
          return;
        }
        if (sameValue(record.values[field.id], parsed.value)) return;
        const change = changes.get(record.id) ?? { record, values: {} };
        change.values[field.id] = parsed.value;
        changes.set(record.id, change);
      });
    });
    if (changes.size) onCommit([...changes.values()]);
    if (rejected)
      onProblem(
        `${rejected} pasted value${rejected === 1 ? '' : 's'} didn’t match the field type and ${rejected === 1 ? 'was' : 'were'} skipped.`,
      );
  };

  return (
    <div className={styles.frame}>
      <div ref={scrollRef} className={styles.scroller}>
        <div
          ref={gridRef}
          role="grid"
          aria-label="Records"
          aria-rowcount={totalCount + 1}
          aria-colcount={cols + 1}
          aria-activedescendant={
            state.active && !state.editing ? cellId(state.active.row, state.active.col) : undefined
          }
          aria-multiselectable={false}
          tabIndex={0}
          className={styles.grid}
          style={{ width: totalWidth }}
          onKeyDown={onKeyDown}
          onCopy={onCopy}
          onPaste={onPaste}
          onFocus={(event) => {
            if (event.target === event.currentTarget && !state.active && rows)
              dispatch({ type: 'select', position: { row: 0, col: 0 } });
          }}
        >
          <div className={styles.head} role="rowgroup">
            <div className={styles.letterRow} style={{ gridTemplateColumns: template }} aria-hidden="true">
              <span />
              {fields.map((field, index) => (
                <span key={field.id}>{LETTERS[index] ?? ''}</span>
              ))}
            </div>
            <div
              role="row"
              aria-rowindex={1}
              className={styles.headerRow}
              style={{ gridTemplateColumns: template }}
            >
              <div role="columnheader" className={styles.rowHeaderCorner}>
                <span className="visually-hidden">Row</span>#
              </div>
              {fields.map((field, index) => (
                <ColumnHeader
                  key={field.id}
                  field={field}
                  sort={sort?.fieldId === field.id ? sort.direction : null}
                  onSort={() =>
                    onSortChange(
                      sort?.fieldId !== field.id
                        ? { fieldId: field.id, direction: 'asc' }
                        : sort.direction === 'asc'
                          ? { fieldId: field.id, direction: 'desc' }
                          : null,
                    )
                  }
                  width={widths[index] ?? 160}
                  onResize={(width) =>
                    props.onColumnWidthsChange({ ...props.columnWidths, [field.id]: width })
                  }
                />
              ))}
            </div>
          </div>

          <div role="rowgroup" className={styles.body} style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const record = records[virtualRow.index];
              if (!record) return null;
              const issueFields = new Set(record.issues.map((issue) => issue.fieldId));
              return (
                <div
                  key={record.id}
                  role="row"
                  aria-rowindex={virtualRow.index + 2}
                  className={cx(styles.row, state.active?.row === virtualRow.index && styles.activeRow)}
                  style={{ gridTemplateColumns: template, transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div role="rowheader" className={styles.rowHeader}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onOpenRecord(record)}
                      aria-label={`Open record ${virtualRow.index + 1}`}
                    >
                      {virtualRow.index + 1}
                    </button>
                  </div>
                  {fields.map((field, col) => {
                    const active = state.active?.row === virtualRow.index && state.active.col === col;
                    const value = record.values[field.id];
                    const issue = record.issues.find((item) => item.fieldId === field.id);
                    return (
                      <div
                        key={field.id}
                        id={cellId(virtualRow.index, col)}
                        role="gridcell"
                        aria-selected={active}
                        aria-invalid={issue ? true : undefined}
                        title={issue?.message}
                        className={cx(
                          styles.cell,
                          isNumericType(field.type) && styles.numeric,
                          active && styles.activeCell,
                          active && state.editing && styles.editingCell,
                          issueFields.has(field.id) && styles.issue,
                        )}
                        onPointerDown={() => {
                          if (!active) dispatch({ type: 'select', position: { row: virtualRow.index, col } });
                        }}
                        onDoubleClick={() => {
                          if (field.type === 'boolean') commitValue(record, field, value !== true);
                          else dispatch({ type: 'startEdit', draft: editText(field, value) });
                        }}
                      >
                        {active && state.editing ? (
                          <CellEditor
                            field={field}
                            draft={state.draft}
                            error={state.error}
                            onChange={(draft) => dispatch({ type: 'changeDraft', draft })}
                            onCommit={commitEdit}
                            onCancel={() => {
                              dispatch({ type: 'endEdit' });
                              focusGrid();
                            }}
                          />
                        ) : (
                          <CellContent field={field} value={value} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {loadingMore ? (
          <div className={styles.loadingMore} role="status">
            <Spinner size={14} /> Loading more records…
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColumnHeader({
  field,
  sort,
  onSort,
  width,
  onResize,
}: {
  field: Field;
  sort: 'asc' | 'desc' | null;
  onSort: () => void;
  width: number;
  onResize: (width: number) => void;
}) {
  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const move = (moveEvent: PointerEvent) =>
      onResize(Math.max(72, Math.min(640, width + moveEvent.clientX - startX)));
    const up = () => document.removeEventListener('pointermove', move);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
  };

  return (
    <div
      role="columnheader"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}
      className={styles.columnHeader}
    >
      <button
        type="button"
        tabIndex={-1}
        className={styles.sortButton}
        onClick={onSort}
        title={`Sort by ${field.name}`}
      >
        <span
          className={cx(styles.typeGlyph, styles[`type-${field.type}`])}
          title={FIELD_TYPE_LABELS[field.type]}
          aria-hidden="true"
        >
          {FIELD_TYPE_GLYPHS[field.type]}
        </span>
        <span className={styles.fieldName}>{field.name}</span>
        {sort ? <span aria-hidden="true">{sort === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${field.name} column`}
        aria-valuenow={width}
        tabIndex={0}
        className={styles.resizer}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            onResize(Math.max(72, Math.min(640, width + (event.key === 'ArrowRight' ? 16 : -16))));
          }
        }}
      />
    </div>
  );
}
