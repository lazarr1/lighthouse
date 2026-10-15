import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { endpoints } from '@/api/contract';

export function useCreateChartDraft() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { datasetId: string; prompt: string; refineDraftId?: string }) =>
      api.request(endpoints.createChartDraft, { body: input }),
  });
}
