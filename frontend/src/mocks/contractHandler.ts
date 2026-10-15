import { http, HttpResponse, delay, type HttpHandler } from 'msw';
import type { BodyOf, EndpointDefinition, PathParams, ResponseOf } from '@/api/contract';
import { MockApiError } from './db';

export interface MockContext<E extends EndpointDefinition> {
  params: PathParams<E['path']>;
  body: BodyOf<E>;
  query: URLSearchParams;
  ifMatch: number | null;
  idempotencyKey: string | null;
  request: Request;
}

export interface ContractHandlerOptions {
  /** Base URL the client is configured with ('' = same origin). */
  baseUrl: string;
  /** Artificial latency so loading states are visible in dev. 0 in tests. */
  latencyMs: number;
  /**
   * When true (tests), a response that violates the contract throws instead of
   * being returned. This keeps the mock honest: it can never drift from the
   * schema that the real backend must implement.
   */
  strict: boolean;
}

const toMswPath = (baseUrl: string, path: string) => `${baseUrl}${path.replace(/\{(\w+)\}/g, ':$1')}`;

const errorResponse = (status: number, code: string, message: string, details?: Record<string, unknown>) =>
  HttpResponse.json(
    { error: { code, message, details, requestId: `req_mock_${Date.now().toString(36)}` } },
    { status },
  );

/** Recorded idempotent responses, keyed by `Idempotency-Key`. */
const idempotencyCache = new Map<string, { status: number; body: unknown }>();

/**
 * Binds a resolver to a contract endpoint. The resolver is type-checked against
 * the endpoint's schemas; request bodies are parsed (400 on invalid input, as a
 * strict server would) and responses are validated before they leave.
 */
export function contractHandler<E extends EndpointDefinition>(
  endpoint: E,
  options: ContractHandlerOptions,
  resolve: (context: MockContext<E>) => ResponseOf<E> | Promise<ResponseOf<E>>,
): HttpHandler {
  const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
  return http[method](toMswPath(options.baseUrl, endpoint.path), async ({ request, params }) => {
    if (options.latencyMs) await delay(options.latencyMs);

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (endpoint.idempotent && !idempotencyKey) {
      return errorResponse(400, 'validation_failed', 'Idempotency-Key header is required');
    }
    const cacheKey = idempotencyKey ? `${endpoint.method} ${request.url} ${idempotencyKey}` : null;
    const cached = cacheKey ? idempotencyCache.get(cacheKey) : undefined;
    if (cached) return HttpResponse.json(cached.body as never, { status: cached.status });

    let body: unknown = undefined;
    if (endpoint.body) {
      const raw: unknown = await request.json().catch(() => undefined);
      const parsed = endpoint.body.safeParse(raw);
      if (!parsed.success) return errorResponse(400, 'validation_failed', parsed.error.message);
      body = parsed.data;
    }

    const ifMatchHeader = request.headers.get('If-Match');
    const ifMatch = ifMatchHeader ? Number(ifMatchHeader.replaceAll('"', '')) : null;

    try {
      const result = await resolve({
        params: params as PathParams<E['path']>,
        body: body as BodyOf<E>,
        query: new URL(request.url).searchParams,
        ifMatch: Number.isFinite(ifMatch) ? ifMatch : null,
        idempotencyKey,
        request,
      });
      const checked = endpoint.response.safeParse(result);
      if (!checked.success) {
        const message = `Mock response for ${endpoint.method} ${endpoint.path} violates the contract: ${checked.error.message}`;
        if (options.strict) throw new Error(message);
        console.error(message);
      }
      const status = endpoint.successStatus ?? 200;
      // Snapshot so later in-memory mutations don't leak into an already-sent response.
      const payload = structuredClone(result) as never;
      if (cacheKey) idempotencyCache.set(cacheKey, { status, body: payload });
      return HttpResponse.json(payload, { status });
    } catch (error) {
      if (error instanceof MockApiError)
        return errorResponse(error.status, error.code, error.message, error.details);
      throw error;
    }
  });
}

/** SSE variant: the resolver pushes validated events and returns a cleanup function. */
export function contractStreamHandler<E extends EndpointDefinition>(
  endpoint: E,
  options: ContractHandlerOptions,
  subscribe: (
    context: { params: PathParams<E['path']> },
    send: (event: ResponseOf<E>) => void,
    close: () => void,
  ) => () => void,
): HttpHandler {
  return http.get(toMswPath(options.baseUrl, endpoint.path), ({ params, request }) => {
    const encoder = new TextEncoder();
    let cleanup: (() => void) | undefined;
    let closed = false;
    try {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const close = () => {
            if (closed) return;
            closed = true;
            // Defer so a synchronous close inside subscribe() can still clean up.
            queueMicrotask(() => cleanup?.());
            controller.close();
          };
          const send = (event: ResponseOf<E>) => {
            if (closed) return;
            const checked = endpoint.response.safeParse(event);
            if (!checked.success && options.strict)
              throw new Error(`Mock event violates the contract: ${checked.error.message}`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };
          cleanup = subscribe({ params: params as PathParams<E['path']> }, send, close);
          request.signal.addEventListener('abort', () => {
            closed = true;
            cleanup?.();
          });
        },
        cancel() {
          closed = true;
          cleanup?.();
        },
      });
      return new HttpResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    } catch (error) {
      if (error instanceof MockApiError)
        return errorResponse(error.status, error.code, error.message, error.details);
      throw error;
    }
  });
}

export function resetIdempotencyCache() {
  idempotencyCache.clear();
}
