import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useApi } from '@/api/ApiProvider';
import { endpoints, TERMINAL_RUN_STATUSES, type Run, type RunEvent } from '@/api/contract';
import { queryKeys } from '@/api/queryKeys';
import { useWorkspace } from '../workspace/WorkspaceContext';

export const isTerminal = (run: Pick<Run, 'status'> | undefined) =>
  !!run && TERMINAL_RUN_STATUSES.includes(run.status);

export function useActions() {
  const api = useApi();
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: queryKeys.actions(workspace.id),
    queryFn: ({ signal }) =>
      api.request(endpoints.listActions, { params: { workspaceId: workspace.id }, signal }),
    select: (data) => data.items,
  });
}

export function useAction(actionId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.action(actionId ?? ''),
    queryFn: ({ signal }) =>
      api.request(endpoints.getAction, { params: { actionId: actionId ?? '' }, signal }),
    enabled: !!actionId,
  });
}

export function useRuns(actionId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.runs(actionId ?? ''),
    queryFn: ({ signal }) =>
      api.request(endpoints.listRuns, { params: { actionId: actionId ?? '' }, query: { limit: 20 }, signal }),
    enabled: !!actionId,
    select: (data) => data.items,
  });
}

type LogEvent = Extract<RunEvent, { type: 'log' }>;

/**
 * Live view of a run: subscribes to its SSE stream, mirrors snapshots into
 * the query cache, and falls back to polling if the stream drops.
 */
export function useRun(runId: string | undefined) {
  const api = useApi();
  const client = useQueryClient();
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [streamFailed, setStreamFailed] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.run(runId ?? ''),
    queryFn: ({ signal }) => api.request(endpoints.getRun, { params: { runId: runId ?? '' }, signal }),
    enabled: !!runId,
    refetchInterval: (q) => (streamFailed && !isTerminal(q.state.data) ? 2000 : false),
  });

  const terminal = isTerminal(query.data);

  useEffect(() => {
    if (!runId || terminal) return;
    const controller = new AbortController();
    setLogs([]);
    setStreamFailed(false);
    (async () => {
      try {
        for await (const event of api.stream(endpoints.streamRunEvents, {
          params: { runId },
          signal: controller.signal,
        })) {
          if (event.type === 'log') setLogs((list) => [...list, event]);
          else client.setQueryData(queryKeys.run(runId), event.run);
        }
      } catch (error) {
        if (!controller.signal.aborted) setStreamFailed(true);
        if (!(error instanceof DOMException)) return;
      }
    })();
    return () => controller.abort();
  }, [api, client, runId, terminal]);

  // When a run finishes, everything it may have touched is stale.
  useEffect(() => {
    if (!terminal || !query.data) return;
    const run = query.data;
    if (run.mode === 'live') {
      void client.invalidateQueries({ queryKey: ['dataset'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
      void client.invalidateQueries({ queryKey: ['workspace'] });
    }
    void client.invalidateQueries({ queryKey: ['actions'] });
    if (run.actionId) {
      void client.invalidateQueries({ queryKey: queryKeys.action(run.actionId) });
    }
  }, [client, terminal, query.data]);

  return { ...query, logs };
}

export function useCreateActionDraft() {
  const api = useApi();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: (input: { prompt: string; attachmentIds: string[]; datasetId?: string; actionId?: string }) =>
      api.request(endpoints.createActionDraft, { params: { workspaceId: workspace.id }, body: input }),
  });
}

export function useStartDryRun() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => api.request(endpoints.startDryRun, { params: { draftId } }),
    onSuccess: (run) => client.setQueryData(queryKeys.run(run.id), run),
  });
}

export function useApproveDraft() {
  const api = useApi();
  const client = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: (input: { draftId: string; hash: string; dryRunId: string; runNow: boolean }) =>
      api.request(endpoints.approveDraft, {
        params: { draftId: input.draftId },
        body: { hash: input.hash, dryRunId: input.dryRunId, runNow: input.runNow },
      }),
    onSuccess: ({ action, run }) => {
      client.setQueryData(queryKeys.action(action.id), action);
      if (run) client.setQueryData(queryKeys.run(run.id), run);
      void client.invalidateQueries({ queryKey: queryKeys.actions(workspace.id) });
    },
  });
}

function useActionMutation<TInput, TResult>(
  run: (api: ReturnType<typeof useApi>, input: TInput) => Promise<TResult>,
) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(api, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['actions'] }),
        client.invalidateQueries({ queryKey: ['action'] }),
      ]);
    },
  });
}

export const useStartRun = () =>
  useActionMutation((api, actionId: string) => api.request(endpoints.startRun, { params: { actionId } }));

export const useUpdateAction = () =>
  useActionMutation((api, input: { actionId: string; status: 'active' | 'paused' }) =>
    api.request(endpoints.updateAction, {
      params: { actionId: input.actionId },
      body: { status: input.status },
    }),
  );

export const useSetSchedule = () =>
  useActionMutation((api, input: { actionId: string; cron: string; timezone: string; enabled: boolean }) =>
    api.request(endpoints.setSchedule, {
      params: { actionId: input.actionId },
      body: { cron: input.cron, timezone: input.timezone, enabled: input.enabled },
    }),
  );

export const useCancelRun = () =>
  useActionMutation((api, runId: string) => api.request(endpoints.cancelRun, { params: { runId } }));
