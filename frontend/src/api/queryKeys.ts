import type { RecordQuery } from './contract';

/**
 * Central TanStack Query key factory. Hierarchical so invalidating a prefix
 * (e.g. `queryKeys.dataset(id)`) refreshes everything derived from it.
 */
export const queryKeys = {
  session: () => ['session'] as const,
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,

  dataset: (datasetId: string) => ['dataset', datasetId] as const,
  records: (datasetId: string, query?: Omit<RecordQuery, 'cursor'>) =>
    query
      ? (['dataset', datasetId, 'records', query] as const)
      : (['dataset', datasetId, 'records'] as const),
  record: (datasetId: string, recordId: string) => ['dataset', datasetId, 'record', recordId] as const,

  dashboard: (dashboardId: string) => ['dashboard', dashboardId] as const,
  widgetData: (dashboardId: string, widgetId: string, chartVersionId: string) =>
    ['dashboard', dashboardId, 'widget', widgetId, chartVersionId] as const,

  actions: (workspaceId: string) => ['actions', workspaceId] as const,
  action: (actionId: string) => ['action', actionId] as const,
  runs: (actionId: string) => ['action', actionId, 'runs'] as const,
  run: (runId: string) => ['run', runId] as const,
};
