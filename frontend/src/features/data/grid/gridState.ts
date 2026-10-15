/**
 * Pure state machine for grid selection and editing. Rendering, data and
 * side effects (saving) live in the component; this file only answers
 * "given this key / click, where are we now?" — which makes the spreadsheet
 * keyboard model exhaustively unit-testable.
 */

export interface CellPosition {
  row: number;
  col: number;
}

export interface GridState {
  active: CellPosition | null;
  editing: boolean;
  draft: string;
  error: string | null;
}

export const initialGridState: GridState = { active: null, editing: false, draft: '', error: null };

export type GridAction =
  | { type: 'select'; position: CellPosition }
  | { type: 'move'; rowDelta: number; colDelta: number; rows: number; cols: number }
  | { type: 'jump'; to: 'rowStart' | 'rowEnd' | 'top' | 'bottom'; rows: number; cols: number }
  | { type: 'startEdit'; draft: string }
  | { type: 'changeDraft'; draft: string }
  | { type: 'rejectDraft'; error: string }
  | { type: 'endEdit' }
  | { type: 'clear' };

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'select':
      return { ...state, active: action.position, editing: false, error: null };
    case 'move': {
      if (action.rows === 0 || action.cols === 0) return state;
      const current = state.active ?? { row: 0, col: 0 };
      return {
        ...state,
        editing: false,
        error: null,
        active: {
          row: clamp(current.row + action.rowDelta, action.rows - 1),
          col: clamp(current.col + action.colDelta, action.cols - 1),
        },
      };
    }
    case 'jump': {
      if (action.rows === 0 || action.cols === 0) return state;
      const current = state.active ?? { row: 0, col: 0 };
      const next = {
        rowStart: { row: current.row, col: 0 },
        rowEnd: { row: current.row, col: action.cols - 1 },
        top: { row: 0, col: current.col },
        bottom: { row: action.rows - 1, col: current.col },
      }[action.to];
      return { ...state, editing: false, error: null, active: next };
    }
    case 'startEdit':
      return state.active ? { ...state, editing: true, draft: action.draft, error: null } : state;
    case 'changeDraft':
      return { ...state, draft: action.draft, error: null };
    case 'rejectDraft':
      return { ...state, error: action.error };
    case 'endEdit':
      return { ...state, editing: false, draft: '', error: null };
    case 'clear':
      return initialGridState;
  }
}

/** Key → navigation action when NOT editing. Returns null for keys the grid doesn't own. */
export function navigationFor(
  key: string,
  modifiers: { shift: boolean; meta: boolean },
  rows: number,
  cols: number,
): GridAction | null {
  const jump = (to: 'rowStart' | 'rowEnd' | 'top' | 'bottom'): GridAction => ({
    type: 'jump',
    to,
    rows,
    cols,
  });
  const move = (rowDelta: number, colDelta: number): GridAction => ({
    type: 'move',
    rowDelta,
    colDelta,
    rows,
    cols,
  });
  switch (key) {
    case 'ArrowUp':
      return modifiers.meta ? jump('top') : move(-1, 0);
    case 'ArrowDown':
      return modifiers.meta ? jump('bottom') : move(1, 0);
    case 'ArrowLeft':
      return modifiers.meta ? jump('rowStart') : move(0, -1);
    case 'ArrowRight':
      return modifiers.meta ? jump('rowEnd') : move(0, 1);
    case 'Tab':
      return move(0, modifiers.shift ? -1 : 1);
    case 'Home':
      return modifiers.meta ? jump('top') : jump('rowStart');
    case 'End':
      return modifiers.meta ? jump('bottom') : jump('rowEnd');
    case 'PageUp':
      return move(-10, 0);
    case 'PageDown':
      return move(10, 0);
    default:
      return null;
  }
}

/** Where focus goes after committing an edit with this key. */
export function afterCommit(key: string, shift: boolean): { rowDelta: number; colDelta: number } {
  if (key === 'Tab') return { rowDelta: 0, colDelta: shift ? -1 : 1 };
  if (key === 'Enter') return { rowDelta: shift ? -1 : 1, colDelta: 0 };
  return { rowDelta: 0, colDelta: 0 };
}

/** A single printable character starts editing and replaces the content (spreadsheet behaviour). */
export const isPrintable = (event: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }) =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

/** Parse clipboard text (TSV from spreadsheets) into rows of cells. */
export function parseClipboard(text: string): string[][] {
  const trimmed = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (trimmed === '') return [['']];
  return trimmed.split('\n').map((line) => line.split('\t'));
}
