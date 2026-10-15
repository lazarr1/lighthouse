import { ApiErrorBody, buildPath } from '../contract';
import type { EndpointDefinition, RequestOptions, ResponseOf } from '../contract';
import { ApiError } from './ApiError';
import { readEventStream } from './sse';

export interface ApiClientOptions {
  /** e.g. `https://api.lighthouse.app`. Empty string = same origin. */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Called on 401 so the app can route to sign-in. */
  onUnauthenticated?: () => void;
  generateId?: () => string;
}

/**
 * Thin, typed transport over the contract in `../contract/endpoints.ts`.
 *
 * - Validates every response against its schema (backend drift surfaces as
 *   `contract_violation` instead of a crash deep inside a component).
 * - Adds `Idempotency-Key` for idempotent endpoints, `If-Match` for revisioned ones.
 * - Converts every failure into an `ApiError` with a stable `code`.
 */
export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly generateId: () => string;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
  }

  async request<E extends EndpointDefinition>(
    endpoint: E,
    request: RequestOptions<E>,
  ): Promise<ResponseOf<E>> {
    const response = await this.send(endpoint, request, 'application/json');
    const payload: unknown = response.status === 204 ? {} : await response.json().catch(() => undefined);
    return this.validate(endpoint, payload, response);
  }

  /**
   * Opens an SSE endpoint and yields validated events until the server closes
   * the stream or `signal` aborts.
   */
  async *stream<E extends EndpointDefinition>(
    endpoint: E,
    request: RequestOptions<E>,
  ): AsyncGenerator<ResponseOf<E>, void, undefined> {
    const response = await this.send(endpoint, request, 'text/event-stream');
    if (!response.body) throw new ApiError('contract_violation', 'Event stream had no body', response.status);
    for await (const event of readEventStream(response.body, request.signal)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        throw new ApiError('contract_violation', `Malformed event data on ${endpoint.path}`, response.status);
      }
      yield this.validate(endpoint, parsed, response);
    }
  }

  private async send<E extends EndpointDefinition>(
    endpoint: E,
    request: RequestOptions<E>,
    accept: string,
  ): Promise<Response> {
    const url = new URL(
      this.options.baseUrl + buildPath(endpoint.path, request.params),
      globalThis.location?.origin,
    );
    if (request.query) {
      for (const [key, value] of Object.entries(request.query as Record<string, unknown>)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({ Accept: accept });
    if (endpoint.body) headers.set('Content-Type', 'application/json');
    if (endpoint.idempotent) headers.set('Idempotency-Key', request.idempotencyKey ?? this.generateId());
    if (endpoint.ifMatch && request.ifMatch !== undefined) headers.set('If-Match', `"${request.ifMatch}"`);

    let body: string | undefined;
    if (endpoint.body) {
      // Validate outgoing bodies too: a programming error should fail loudly here, not as a 400.
      const parsed = endpoint.body.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(
          'validation_failed',
          `Invalid request body for ${endpoint.path}: ${parsed.error.message}`,
          0,
        );
      }
      body = JSON.stringify(parsed.data);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: endpoint.method,
        headers,
        body,
        credentials: 'include',
        signal: request.signal ?? null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError('network_error', 'Network request failed', 0);
    }

    if (!response.ok) throw await this.toError(response);
    return response;
  }

  private async toError(response: Response): Promise<ApiError> {
    if (response.status === 401) this.options.onUnauthenticated?.();
    const payload: unknown = await response.json().catch(() => undefined);
    const parsed = ApiErrorBody.safeParse(payload);
    const requestId = response.headers.get('X-Request-Id') ?? undefined;
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiError(code, message, response.status, details, parsed.data.error.requestId ?? requestId);
    }
    return new ApiError(
      fallbackCode(response.status),
      `HTTP ${response.status}`,
      response.status,
      {},
      requestId,
    );
  }

  private validate<E extends EndpointDefinition>(
    endpoint: E,
    payload: unknown,
    response: Response,
  ): ResponseOf<E> {
    const parsed = endpoint.response.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        'contract_violation',
        `Response from ${endpoint.method} ${endpoint.path} did not match the contract: ${parsed.error.message}`,
        response.status,
        { issues: parsed.error.issues },
      );
    }
    return parsed.data as ResponseOf<E>;
  }
}

function fallbackCode(status: number): ApiError['code'] {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'revision_conflict';
  if (status === 422 || status === 400) return 'validation_failed';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  return 'internal';
}
