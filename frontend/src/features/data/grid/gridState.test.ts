import { describe, expect, it } from 'vitest';
import {
  afterCommit,
  gridReducer,
  initialGridState,
  isPrintable,
  navigationFor,
  parseClipboard,
  type GridState,
} from './gridState';

const at = (row: number, col: number): GridState => ({ ...initialGridState, active: { row, col } });
const nav = (state: GridState, key: string, mods = { shift: false, meta: false }) => {
  const action = navigationFor(key, mods, 10, 4);
  return action ? gridReducer(state, action).active : null;
};

describe('gridState', () => {
  it('moves with arrows and clamps at the edges', () => {
    expect(nav(at(0, 0), 'ArrowDown')).toEqual({ row: 1, col: 0 });
    expect(nav(at(0, 0), 'ArrowUp')).toEqual({ row: 0, col: 0 });
    expect(nav(at(9, 3), 'ArrowRight')).toEqual({ row: 9, col: 3 });
    expect(nav(at(5, 1), 'PageDown')).toEqual({ row: 9, col: 1 });
  });

  it('jumps with Home/End and ⌘+arrows', () => {
    expect(nav(at(4, 2), 'Home')).toEqual({ row: 4, col: 0 });
    expect(nav(at(4, 2), 'End')).toEqual({ row: 4, col: 3 });
    expect(nav(at(4, 2), 'ArrowDown', { shift: false, meta: true })).toEqual({ row: 9, col: 2 });
    expect(nav(at(4, 2), 'Home', { shift: false, meta: true })).toEqual({ row: 0, col: 2 });
  });

  it('tabs forward and back', () => {
    expect(nav(at(1, 1), 'Tab')).toEqual({ row: 1, col: 2 });
    expect(nav(at(1, 1), 'Tab', { shift: true, meta: false })).toEqual({ row: 1, col: 0 });
  });

  it('ignores keys it does not own', () => {
    expect(navigationFor('a', { shift: false, meta: false }, 10, 4)).toBeNull();
  });

  it('runs the edit lifecycle', () => {
    let state = gridReducer(at(0, 0), { type: 'startEdit', draft: 'x' });
    expect(state).toMatchObject({ editing: true, draft: 'x' });
    state = gridReducer(state, { type: 'rejectDraft', error: 'bad' });
    expect(state.error).toBe('bad');
    state = gridReducer(state, { type: 'changeDraft', draft: 'xy' });
    expect(state.error).toBeNull();
    state = gridReducer(state, { type: 'endEdit' });
    expect(state).toMatchObject({ editing: false, draft: '', active: { row: 0, col: 0 } });
    expect(gridReducer(initialGridState, { type: 'startEdit', draft: '' }).editing).toBe(false);
  });

  it('knows where focus goes after commit', () => {
    expect(afterCommit('Enter', false)).toEqual({ rowDelta: 1, colDelta: 0 });
    expect(afterCommit('Enter', true)).toEqual({ rowDelta: -1, colDelta: 0 });
    expect(afterCommit('Tab', false)).toEqual({ rowDelta: 0, colDelta: 1 });
  });

  it('detects printable keys and parses TSV', () => {
    expect(isPrintable({ key: 'a', metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(isPrintable({ key: 'c', metaKey: true, ctrlKey: false, altKey: false })).toBe(false);
    expect(isPrintable({ key: 'Enter', metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
    expect(parseClipboard('a\tb\r\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});
