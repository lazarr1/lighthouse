import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { endpoints } from '@/api/contract';
import { queryKeys } from '@/api/queryKeys';

export function useSession() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: ({ signal }) => api.request(endpoints.getSession, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useWorkspaceQuery(workspaceId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: ({ signal }) => api.request(endpoints.getWorkspace, { params: { workspaceId }, signal }),
  });
}
