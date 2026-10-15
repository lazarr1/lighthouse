import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { hasCode } from '@/api/client';
import {
  endpoints,
  type CellValue,
  type DataRecord,
  type RecordPage,
  type RecordQuery,
  type SchemaChange,
} from '@/api/contract';
import { queryKeys } from '@/api/queryKeys';

export const RECORD_PAGE_SIZE = 100;

export function useDataset(datasetId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dataset(datasetId),
    queryFn: ({ signal }) => api.request(endpoints.getDataset, { params: { datasetId }, signal }),
  });
}

export type RecordFilterQuery = Omit<RecordQuery, 'cursor' | 'limit'>;

/** Server-side, cursor-paginated records. Pages load as the grid scrolls. */
export function useRecords(datasetId: string, query: RecordFilterQuery) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.records(datasetId, query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.request(endpoints.queryRecords, {
        params: { datasetId },
        body: { ...query, cursor: pageParam, limit: RECORD_PAGE_SIZE },
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}

/** Replace one record in every cached records page for the dataset. */
function patchCachedRecord(client: ReturnType<typeof useQueryClient>, datasetId: string, record: DataRecord) {
  client.setQueriesData<InfiniteData<RecordPage>>({ queryKey: queryKeys.records(datasetId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === record.id ? record : item)),
          })),
        }
      : data,
  );
}

export interface UpdateRecordInput {
  record: DataRecord;
  values: Record<string, CellValue>;
}

/**
 * Optimistic cell edit with `If-Match`. On `revision_conflict` the cache is
 * replaced with the server's current record (sent in the error details).
 */
export function useUpdateRecord(datasetId: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ record, values }: UpdateRecordInput) =>
      api.request(endpoints.updateRecord, {
        params: { datasetId, recordId: record.id },
        body: { values },
        ifMatch: record.revision,
      }),
    onMutate: ({ record, values }) => {
      patchCachedRecord(client, datasetId, { ...record, values: { ...record.values, ...values } });
      return { previous: record };
    },
    onSuccess: (result) => {
      patchCachedRecord(client, datasetId, result.record);
      void client.invalidateQueries({ queryKey: queryKeys.dataset(datasetId), exact: true });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error, _input, context) => {
      if (hasCode(error, 'revision_conflict') && error.details.current) {
        patchCachedRecord(client, datasetId, error.details.current as DataRecord);
      } else if (context) {
        patchCachedRecord(client, datasetId, context.previous);
      }
    },
  });
}

function useInvalidateData(datasetId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.dataset(datasetId) }),
      client.invalidateQueries({ queryKey: ['workspace'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateRecord(datasetId: string) {
  const api = useApi();
  const invalidate = useInvalidateData(datasetId);
  return useMutation({
    mutationFn: (values: Record<string, CellValue>) =>
      api.request(endpoints.createRecord, { params: { datasetId }, body: { values } }),
    onSuccess: invalidate,
  });
}

export function useDeleteRecord(datasetId: string) {
  const api = useApi();
  const invalidate = useInvalidateData(datasetId);
  return useMutation({
    mutationFn: (record: DataRecord) =>
      api.request(endpoints.deleteRecord, {
        params: { datasetId, recordId: record.id },
        ifMatch: record.revision,
      }),
    onSuccess: invalidate,
  });
}

/** Undo any change set (record edit, delete, schema change, action commit). */
export function useRevertChangeSet(datasetId: string) {
  const api = useApi();
  const invalidate = useInvalidateData(datasetId);
  return useMutation({
    mutationFn: (changeSetId: string) => api.request(endpoints.revertChangeSet, { params: { changeSetId } }),
    onSuccess: invalidate,
  });
}

export function usePreviewSchemaChange(datasetId: string) {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { expectedSchemaVersion: number; changes: SchemaChange[] }) =>
      api.request(endpoints.previewSchemaChange, { params: { datasetId }, body: input }),
  });
}

export function useApplySchemaChange(datasetId: string) {
  const api = useApi();
  const client = useQueryClient();
  const invalidate = useInvalidateData(datasetId);
  return useMutation({
    mutationFn: (input: { expectedSchemaVersion: number; changes: SchemaChange[] }) =>
      api.request(endpoints.applySchemaChange, { params: { datasetId }, body: input }),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.dataset(datasetId), result.dataset);
      return invalidate();
    },
    onError: (error) => {
      if (hasCode(error, 'revision_conflict'))
        void client.invalidateQueries({ queryKey: queryKeys.dataset(datasetId) });
    },
  });
}
