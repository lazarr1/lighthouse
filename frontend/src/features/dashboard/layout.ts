import { GRID_COLUMNS, type Breakpoint, type LayoutItem, type Layouts } from '@/api/contract';

/**
 * Pure layout operations. These give keyboard and touch users the same power
 * as drag-and-drop (design requirement: "mouse, touch, and keyboard alternatives").
 */

export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 940, md: 600, sm: 0 };
export const MIN_SIZE = { w: 3, h: 2 };

/** Reading order: top-to-bottom, then left-to-right. */
export const readingOrder = (layout: LayoutItem[]) => [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

/** Strip anything react-grid-layout adds (moved, static, …) so it matches the contract. */
export function toContractLayout(
  items: readonly { i: string; x: number; y: number; w: number; h: number }[],
): LayoutItem[] {
  return items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

/** Swap a widget's position with its neighbour in reading order. */
export function moveWidget(layout: LayoutItem[], id: string, direction: 'earlier' | 'later'): LayoutItem[] {
  const ordered = readingOrder(layout);
  const index = ordered.findIndex((item) => item.i === id);
  const neighbourIndex = direction === 'earlier' ? index - 1 : index + 1;
  const current = ordered[index];
  const neighbour = ordered[neighbourIndex];
  if (!current || !neighbour) return layout;
  return layout.map((item) => {
    if (item.i === current.i) return { ...item, x: neighbour.x, y: neighbour.y };
    if (item.i === neighbour.i) return { ...item, x: current.x, y: current.y };
    return item;
  });
}

export function resizeWidget(
  layout: LayoutItem[],
  id: string,
  delta: { w?: number; h?: number },
  columns: number,
): LayoutItem[] {
  return layout.map((item) => {
    if (item.i !== id) return item;
    const minW = Math.min(MIN_SIZE.w, columns);
    const w = Math.min(columns - item.x, Math.max(minW, item.w + (delta.w ?? 0)));
    const h = Math.max(MIN_SIZE.h, item.h + (delta.h ?? 0));
    return { ...item, w, h };
  });
}

export function canMove(layout: LayoutItem[], id: string, direction: 'earlier' | 'later') {
  const ordered = readingOrder(layout);
  const index = ordered.findIndex((item) => item.i === id);
  return direction === 'earlier' ? index > 0 : index >= 0 && index < ordered.length - 1;
}

export const columnsFor = (breakpoint: Breakpoint) => GRID_COLUMNS[breakpoint];

/** Ensures every widget has a slot in every breakpoint (new widgets from other clients). */
export function completeLayouts(layouts: Layouts, widgetIds: string[]): Layouts {
  const fill = (breakpoint: Breakpoint) => {
    const items = layouts[breakpoint].filter((item) => widgetIds.includes(item.i));
    let bottom = items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    for (const id of widgetIds) {
      if (items.some((item) => item.i === id)) continue;
      const w = breakpoint === 'sm' ? 1 : 6;
      items.push({ i: id, x: 0, y: bottom, w, h: 5 });
      bottom += 5;
    }
    return items;
  };
  return { lg: fill('lg'), md: fill('md'), sm: fill('sm') };
}
