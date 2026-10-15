import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { ApiError } from '@/api/client';
import { ALLOWED_UPLOAD_TYPES, endpoints, MAX_UPLOAD_BYTES, type Upload } from '@/api/contract';
import { useWorkspace } from '../workspace/WorkspaceContext';

export const isAllowedUpload = (file: File) =>
  (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type) &&
  file.size > 0 &&
  file.size <= MAX_UPLOAD_BYTES;

/** Three-step direct upload: request a signed URL, PUT the bytes, confirm. */
export function useUploadFile() {
  const api = useApi();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (file: File): Promise<Upload> => {
      if (!isAllowedUpload(file)) {
        throw new ApiError(
          'validation_failed',
          'Upload a PNG, JPEG, WebP, HEIC, PDF or CSV file under 20 MB.',
          0,
        );
      }
      const ticket = await api.request(endpoints.createUpload, {
        params: { workspaceId: workspace.id },
        body: {
          filename: file.name,
          contentType: file.type as (typeof ALLOWED_UPLOAD_TYPES)[number],
          size: file.size,
        },
      });
      const put = await fetch(ticket.uploadUrl, {
        method: ticket.method,
        headers: ticket.headers,
        body: file,
      }).catch(() => null);
      if (!put?.ok) throw new ApiError('network_error', 'The file couldn’t be uploaded.', put?.status ?? 0);
      return api.request(endpoints.completeUpload, { params: { uploadId: ticket.upload.id }, body: {} });
    },
  });
}
