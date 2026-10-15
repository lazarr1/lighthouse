import { z } from 'zod';
import { Id, Revision, Timestamp } from './common';
import { ChartDefinition } from './charts';

export const Breakpoint = z.enum(['lg', 'md', 'sm']);
export type Breakpoint = z.infer<typeof Breakpoint>;

/** Grid columns per breakpoint. lg/md are 12-column, sm is single-column. */
export const GRID_COLUMNS: Record<Breakpoint, number> = { lg: 12, md: 12, sm: 1 };

export const LayoutItem = z.object({
  /** Widget ID */
  i: Id,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type LayoutItem = z.infer<typeof LayoutItem>;

/** Layouts are stored independently per breakpoint. */
export const Layouts = z.object({
  lg: z.array(LayoutItem),
  md: z.array(LayoutItem),
  sm: z.array(LayoutItem),
});
export type Layouts = z.infer<typeof Layouts>;

const WidgetBase = z.object({
  id: Id,
  /** `needs_attention` when a schema change made the widget incompatible. */
  status: z.enum(['ok', 'needs_attention']),
  issues: z.array(z.string()),
  createdAt: Timestamp,
});

export const ChartWidget = WidgetBase.extend({
  kind: z.literal('chart'),
  /** Immutable chart version. Moving/resizing never changes it. */
  chartVersionId: Id,
  definition: ChartDefinition,
});

export const DataHealthWidget = WidgetBase.extend({
  kind: z.literal('dataHealth'),
  datasetId: Id,
  title: z.string(),
});

export const Widget = z.discriminatedUnion('kind', [ChartWidget, DataHealthWidget]);
export type Widget = z.infer<typeof Widget>;
export type ChartWidget = z.infer<typeof ChartWidget>;
export type DataHealthWidget = z.infer<typeof DataHealthWidget>;

export const Dashboard = z.object({
  id: Id,
  workspaceId: Id,
  name: z.string(),
  /** Increments on any change; send as `expectedVersion` on writes. */
  version: Revision,
  widgets: z.array(Widget),
  layouts: Layouts,
  updatedAt: Timestamp,
});
export type Dashboard = z.infer<typeof Dashboard>;

export const UpdateLayoutBody = z.object({
  expectedVersion: Revision,
  layouts: Layouts,
});

export const AddWidgetBody = z.object({
  /** Publishes this draft as an immutable chart version and places it on the dashboard. */
  chartDraftId: Id,
});

export const WidgetMutationResult = z.object({
  dashboard: Dashboard,
  widgetId: Id,
});
