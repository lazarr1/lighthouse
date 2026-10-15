import { useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { describeError, hasCode } from '@/api/client';
import { GRID_COLUMNS, type Breakpoint, type Dashboard, type LayoutItem, type Layouts } from '@/api/contract';
import { cx } from '@/lib/cx';
import { useToast, type MenuItem } from '@/ui';
import styles from './DashboardGrid.module.css';
import { useDeleteWidget, useDuplicateWidget, useRestoreWidget, useSaveLayout } from './hooks';
import {
  BREAKPOINTS,
  canMove,
  completeLayouts,
  moveWidget,
  MIN_SIZE,
  resizeWidget,
  toContractLayout,
} from './layout';
import { WidgetCard } from './WidgetCard';
import { widgetTitle } from './widgetTitle';

const ResponsiveGrid = WidthProvider(Responsive);
const ROW_HEIGHT = 52;

export interface DashboardGridProps {
  dashboard: Dashboard;
  editing: boolean;
}

/**
 * 12-column responsive canvas (react-grid-layout). Layouts are stored per
 * breakpoint; saving never touches chart versions.
 */
export function DashboardGrid({ dashboard, editing }: DashboardGridProps) {
  const toast = useToast();
  const saveLayout = useSaveLayout(dashboard.id);
  const duplicate = useDuplicateWidget(dashboard.id);
  const remove = useDeleteWidget(dashboard.id);
  const restore = useRestoreWidget(dashboard.id);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg');
  const pending = useRef<Layouts | null>(null);

  const layouts = useMemo(
    () =>
      completeLayouts(
        dashboard.layouts,
        dashboard.widgets.map((widget) => widget.id),
      ),
    [dashboard.layouts, dashboard.widgets],
  );

  const persist = (next: Layouts) => {
    saveLayout.mutate(
      { expectedVersion: dashboard.version, layouts: next },
      {
        onError: (error) =>
          toast.error(
            hasCode(error, 'revision_conflict')
              ? 'Someone else changed this dashboard. We’ve loaded their version.'
              : describeError(error),
          ),
      },
    );
  };

  const onInteractionStop = () => {
    if (pending.current) persist(pending.current);
    pending.current = null;
  };

  const updateCurrent = (transform: (layout: LayoutItem[]) => LayoutItem[]) =>
    persist({ ...layouts, [breakpoint]: transform(layouts[breakpoint]) });

  const layoutMenu = (id: string): MenuItem[] => {
    if (!editing) return [];
    const current = layouts[breakpoint];
    const columns = GRID_COLUMNS[breakpoint];
    const item = current.find((entry) => entry.i === id);
    const items: MenuItem[] = [
      {
        id: 'up',
        label: 'Move earlier',
        icon: 'arrowUp',
        disabled: !canMove(current, id, 'earlier'),
        onSelect: () => updateCurrent((l) => moveWidget(l, id, 'earlier')),
      },
      {
        id: 'down',
        label: 'Move later',
        icon: 'arrowDown',
        disabled: !canMove(current, id, 'later'),
        onSelect: () => updateCurrent((l) => moveWidget(l, id, 'later')),
      },
      {
        id: 'taller',
        label: 'Make taller',
        icon: 'plus',
        onSelect: () => updateCurrent((l) => resizeWidget(l, id, { h: 1 }, columns)),
      },
      {
        id: 'shorter',
        label: 'Make shorter',
        icon: 'chevronDown',
        disabled: (item?.h ?? 0) <= MIN_SIZE.h,
        onSelect: () => updateCurrent((l) => resizeWidget(l, id, { h: -1 }, columns)),
      },
    ];
    if (columns > 1) {
      items.push(
        {
          id: 'wider',
          label: 'Make wider',
          icon: 'chevronRight',
          disabled: !item || item.x + item.w >= columns,
          onSelect: () => updateCurrent((l) => resizeWidget(l, id, { w: 1 }, columns)),
        },
        {
          id: 'narrower',
          label: 'Make narrower',
          icon: 'columns',
          disabled: (item?.w ?? 0) <= MIN_SIZE.w,
          onSelect: () => updateCurrent((l) => resizeWidget(l, id, { w: -1 }, columns)),
        },
      );
    }
    return items;
  };

  const onRemove = (widgetId: string, title: string) =>
    remove.mutate(widgetId, {
      onSuccess: () =>
        toast.success(`Removed ${title}.`, {
          label: 'Undo',
          onClick: () => restore.mutate(widgetId, { onError: (error) => toast.error(describeError(error)) }),
        }),
      onError: (error) => toast.error(describeError(error)),
    });

  return (
    <div className={cx(styles.canvas, editing && styles.editing)}>
      <ResponsiveGrid
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={GRID_COLUMNS}
        rowHeight={ROW_HEIGHT}
        margin={[14, 14]}
        containerPadding={[14, 14]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".drag-handle"
        resizeHandles={['se']}
        compactType="vertical"
        onBreakpointChange={(next) => setBreakpoint(next as Breakpoint)}
        onLayoutChange={(_current: Layout[], all: Partial<Record<string, Layout[]>>) => {
          if (!editing) return;
          pending.current = {
            lg: toContractLayout(all.lg ?? layouts.lg),
            md: toContractLayout(all.md ?? layouts.md),
            sm: toContractLayout(all.sm ?? layouts.sm),
          };
        }}
        onDragStop={onInteractionStop}
        onResizeStop={onInteractionStop}
      >
        {dashboard.widgets.map((widget) => (
          <div key={widget.id} className={styles.cell} data-testid={`widget-${widget.id}`}>
            <WidgetCard
              dashboardId={dashboard.id}
              widget={widget}
              editing={editing}
              layoutItems={layoutMenu(widget.id)}
              onDuplicate={() =>
                duplicate.mutate(widget.id, {
                  onSuccess: () => toast.success(`Duplicated ${widgetTitle(widget)}.`),
                  onError: (error) => toast.error(describeError(error)),
                })
              }
              onRemove={() => onRemove(widget.id, widgetTitle(widget))}
            />
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  );
}
