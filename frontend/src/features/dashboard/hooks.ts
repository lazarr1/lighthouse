import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { hasCode } from '@/api/client';
import { endpoints, type ChartWidget, type Dashboard, type Layouts } from '@/api/contract';
import { queryKeys } from '@/api/queryKeys';

export function useDashboard(dashboardId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard(dashboardId),
    queryFn: ({ signal }) => api.request(endpoints.getDashboard, { params: { dashboardId }, signal }),
  });
}

/**
 * Widget data is keyed by chart version, so moving/resizing never refetches and
 * a new chart version never shows stale results.
 */
export function useWidgetData(dashboardId: string, widget: ChartWidget) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.widgetData(dashboardId, widget.id, widget.chartVersionId),
    queryFn: ({ signal }) =>
      api.request(endpoints.getWidgetData, { params: { dashboardId, widgetId: widget.id }, signal }),
    enabled: widget.status === 'ok',
  });
}

export function useSaveLayout(dashboardId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedVersion: number; layouts: Layouts }) =>
      api.request(endpoints.updateDashboardLayout, { params: { dashboardId }, body: input }),
    onMutate: ({ layouts }) => {
      client.setQueryData<Dashboard>(queryKeys.dashboard(dashboardId), (current) =>
        current ? { ...current, layouts } : current,
      );
    },
    onSuccess: (dashboard) => client.setQueryData(queryKeys.dashboard(dashboardId), dashboard),
    onError: (error) => {
      if (hasCode(error, 'revision_conflict'))
        void client.invalidateQueries({ queryKey: queryKeys.dashboard(dashboardId), exact: true });
    },
  });
}

function useWidgetMutation<TInput>(
  dashboardId: string,
  run: (api: ReturnType<typeof useApi>, input: TInput) => Promise<{ dashboard: Dashboard; widgetId: string }>,
) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(api, input),
    onSuccess: ({ dashboard }) => client.setQueryData(queryKeys.dashboard(dashboardId), dashboard),
  });
}

export const useAddWidget = (dashboardId: string) =>
  useWidgetMutation(dashboardId, (api, chartDraftId: string) =>
    api.request(endpoints.addWidget, { params: { dashboardId }, body: { chartDraftId } }),
  );

export const useDuplicateWidget = (dashboardId: string) =>
  useWidgetMutation(dashboardId, (api, widgetId: string) =>
    api.request(endpoints.duplicateWidget, { params: { dashboardId, widgetId } }),
  );

export const useDeleteWidget = (dashboardId: string) =>
  useWidgetMutation(dashboardId, (api, widgetId: string) =>
    api.request(endpoints.deleteWidget, { params: { dashboardId, widgetId } }),
  );

export const useRestoreWidget = (dashboardId: string) =>
  useWidgetMutation(dashboardId, (api, widgetId: string) =>
    api.request(endpoints.restoreWidget, { params: { dashboardId, widgetId } }),
  );
