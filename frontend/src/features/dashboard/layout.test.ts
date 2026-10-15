import { describe, expect, it } from 'vitest';
import { canMove, completeLayouts, moveWidget, resizeWidget, toContractLayout } from './layout';

const layout = [
  { i: 'a', x: 0, y: 0, w: 4, h: 2 },
  { i: 'b', x: 4, y: 0, w: 4, h: 2 },
  { i: 'c', x: 0, y: 2, w: 8, h: 5 },
];

describe('dashboard layout ops', () => {
  it('swaps with the neighbour in reading order', () => {
    const moved = moveWidget(layout, 'b', 'earlier');
    expect(moved.find((i) => i.i === 'b')).toMatchObject({ x: 0, y: 0 });
    expect(moved.find((i) => i.i === 'a')).toMatchObject({ x: 4, y: 0 });
    expect(moveWidget(layout, 'a', 'earlier')).toBe(layout);
    expect(canMove(layout, 'a', 'earlier')).toBe(false);
    expect(canMove(layout, 'c', 'later')).toBe(false);
  });

  it('resizes within column and minimum bounds', () => {
    expect(resizeWidget(layout, 'b', { w: 10 }, 12).find((i) => i.i === 'b')?.w).toBe(8);
    expect(resizeWidget(layout, 'a', { w: -10, h: -10 }, 12).find((i) => i.i === 'a')).toMatchObject({
      w: 3,
      h: 2,
    });
    expect(resizeWidget(layout, 'a', { w: 1 }, 1).find((i) => i.i === 'a')?.w).toBe(1);
  });

  it('strips library-only props and fills missing widgets', () => {
    expect(
      toContractLayout([{ i: 'a', x: 0, y: 0, w: 1, h: 1, moved: false, static: true } as never]),
    ).toEqual([{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]);
    const completed = completeLayouts({ lg: layout, md: [], sm: [] }, ['a', 'c', 'new']);
    expect(completed.lg.map((i) => i.i)).toEqual(['a', 'c', 'new']);
    expect(completed.lg.find((i) => i.i === 'new')?.y).toBe(7);
    expect(completed.sm.every((i) => i.w === 1)).toBe(true);
  });
});
