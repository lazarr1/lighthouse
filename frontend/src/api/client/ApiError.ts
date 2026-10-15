import type { ApiErrorCode } from '../contract';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
    readonly requestId?: string,
  ) {
    super(message);
  }

  /** Errors worth retrying automatically (reads only). */
  get isTransient(): boolean {
    return this.code === 'network_error' || this.code === 'unavailable' || this.code === 'rate_limited';
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const hasCode = (error: unknown, code: ApiErrorCode): error is ApiError =>
  isApiError(error) && error.code === code;

/** A short, user-facing explanation. Messages from the server are preferred when present. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'network_error':
      return 'Can’t reach Lighthouse. Check your connection and try again.';
    case 'unauthenticated':
      return 'Your session has ended. Please sign in again.';
    case 'forbidden':
      return 'You don’t have permission to do that.';
    case 'revision_conflict':
      return 'Someone else changed this just now. We’ve loaded the latest version.';
    case 'contract_violation':
      return 'The server sent a response this version of the app doesn’t understand.';
    case 'rate_limited':
      return 'Too many requests. Please wait a moment.';
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}
