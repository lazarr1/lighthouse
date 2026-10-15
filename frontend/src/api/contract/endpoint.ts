import type { z } from 'zod';
import type { ApiErrorCode } from './common';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A single HTTP operation in the contract. Everything the client, the mock
 * backend, the OpenAPI generator and the tests know about an endpoint comes
 * from one of these objects.
 *
 * Paths use OpenAPI-style `{param}` placeholders.
 */
export interface EndpointDefinition {
  method: HttpMethod;
  path: string;
  summary: string;
  tag: 'Session' | 'Datasets' | 'Records' | 'Charts' | 'Dashboards' | 'Actions' | 'Runs' | 'Uploads';
  body?: z.ZodType;
  query?: z.ZodType;
  /** Response body schema (for SSE endpoints: the schema of each event's `data`). */
  response: z.ZodType;
  /** HTTP status on success. Defaults to 200. */
  successStatus?: 200 | 201 | 202;
  /** `text/event-stream` endpoint. */
  stream?: boolean;
  /** Endpoint honours `If-Match: "<revision>"` for optimistic concurrency. */
  ifMatch?: boolean;
  /** Endpoint requires an `Idempotency-Key` header; the client generates one if not given. */
  idempotent?: boolean;
  /** Error codes this endpoint can return besides the universal ones. */
  errors?: readonly ApiErrorCode[];
}

export const defineEndpoint = <const E extends EndpointDefinition>(endpoint: E): E => endpoint;

// ── Type-level helpers ───────────────────────────────────────────────────────

type ParamNames<P extends string> = P extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

export type PathParams<P extends string> = { [K in ParamNames<P>]: string };

type ParamsPart<E extends EndpointDefinition> = [ParamNames<E['path']>] extends [never]
  ? { params?: undefined }
  : { params: PathParams<E['path']> };

type BodyPart<E extends EndpointDefinition> = E['body'] extends z.ZodType
  ? { body: z.input<E['body']> }
  : { body?: undefined };

type QueryPart<E extends EndpointDefinition> = E['query'] extends z.ZodType
  ? { query?: z.input<E['query']> }
  : { query?: undefined };

type IfMatchPart<E extends EndpointDefinition> = E['ifMatch'] extends true
  ? { ifMatch: number }
  : { ifMatch?: undefined };

export type RequestOptions<E extends EndpointDefinition> = ParamsPart<E> &
  BodyPart<E> &
  QueryPart<E> &
  IfMatchPart<E> & {
    idempotencyKey?: string;
    signal?: AbortSignal;
  };

export type ResponseOf<E extends EndpointDefinition> = z.output<E['response']>;
export type BodyOf<E extends EndpointDefinition> = E['body'] extends z.ZodType ? z.output<E['body']> : never;

/** Expand `{param}` placeholders. Values are URI-encoded. */
export function buildPath(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(value);
  });
}
