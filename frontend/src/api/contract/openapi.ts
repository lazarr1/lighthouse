import { z } from 'zod';
import * as actions from './actions';
import * as charts from './charts';
import { ApiErrorBody, ApiErrorCode } from './common';
import * as dashboards from './dashboards';
import * as datasets from './datasets';
import type { EndpointDefinition } from './endpoint';
import { endpoints } from './endpoints';
import * as records from './records';
import * as uploads from './uploads';
import * as workspace from './workspace';

/**
 * Builds an OpenAPI 3.1 document from the Zod contract. Used by
 * `npm run contract:openapi` (writes docs/openapi.json) and the in-app
 * contract explorer. Nothing here is hand-maintained.
 */

/** Schemas that get a stable name under `components.schemas`. */
const NAMED: Record<string, z.ZodType> = {
  ApiError: ApiErrorBody,
  ErrorCode: ApiErrorCode,
  Session: workspace.Session,
  Workspace: workspace.Workspace,
  DatasetSummary: workspace.DatasetSummary,
  Dataset: datasets.Dataset,
  Field: datasets.Field,
  FieldType: datasets.FieldType,
  FieldConfig: datasets.FieldConfig,
  Choice: datasets.Choice,
  SchemaChange: datasets.SchemaChange,
  SchemaImpact: datasets.SchemaImpact,
  CellValue: records.CellValue,
  DataRecord: records.DataRecord,
  RecordIssue: records.RecordIssue,
  Filter: records.Filter,
  RecordSort: records.RecordSort,
  QueryDefinition: charts.QueryDefinition,
  SelectItem: charts.SelectItem,
  QueryResult: charts.QueryResult,
  ChartDefinition: charts.ChartDefinition,
  ChartDraft: charts.ChartDraft,
  ValueFormat: charts.ValueFormat,
  Dashboard: dashboards.Dashboard,
  Widget: dashboards.Widget,
  Layouts: dashboards.Layouts,
  LayoutItem: dashboards.LayoutItem,
  PlanStep: actions.PlanStep,
  Permission: actions.Permission,
  ActionManifest: actions.ActionManifest,
  ActionDraft: actions.ActionDraft,
  ActionVersion: actions.ActionVersion,
  Action: actions.Action,
  Schedule: actions.Schedule,
  Run: actions.Run,
  RunEvent: actions.RunEvent,
  ProposedChanges: actions.ProposedChanges,
  Upload: uploads.Upload,
  UploadTicket: uploads.UploadTicket,
};

const registry = z.registry<{ id: string }>();
for (const [id, schema] of Object.entries(NAMED)) registry.add(schema, { id });

type Json = Record<string, unknown>;

/** Convert a schema, returning its body and the named definitions it references. */
export function toJsonSchema(
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): { schema: Json; defs: Record<string, Json> } {
  const converted = z.toJSONSchema(schema, { metadata: registry, io, unrepresentable: 'any' }) as Json;
  const { $defs = {}, $schema: _ignored, ...rest } = converted as Json & { $defs?: Record<string, Json> };
  return {
    schema: simplify(rest) as Json,
    defs: Object.fromEntries(Object.entries($defs).map(([key, value]) => [key, simplify(value) as Json])),
  };
}

/**
 * Readability/compatibility clean-up:
 * - drops zod's very long date-time regex (the `format` already says it);
 * - drops `additionalProperties: false` — clients ignore unknown fields, so the
 *   backend may add fields without a breaking change.
 */
function simplify(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(simplify);
  if (!value || typeof value !== 'object') return value;
  const object = value as Json;
  const result: Json = {};
  for (const [key, child] of Object.entries(object)) {
    if (key === 'pattern' && object.format === 'date-time') continue;
    if (key === 'additionalProperties' && child === false) continue;
    result[key] = simplify(child);
  }
  return result;
}

function rewriteRefs(value: unknown, rename: (name: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteRefs(item, rename));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) =>
      key === '$ref' && typeof child === 'string' && child.startsWith('#/$defs/')
        ? [key, `#/components/schemas/${rename(child.slice('#/$defs/'.length))}`]
        : [key, rewriteRefs(child, rename)],
    ),
  );
}

export function buildOpenApiDocument() {
  const components: Record<string, Json> = {};

  /** Hoist $defs into components. Input-mode variants that differ get an `Input` suffix. */
  const hoist = (converted: { schema: Json; defs: Record<string, Json> }, io: 'input' | 'output') => {
    const names: Record<string, string> = {};
    for (const [name, def] of Object.entries(converted.defs)) {
      let target = name;
      if (io === 'input' && components[name] && JSON.stringify(components[name]) !== JSON.stringify(def))
        target = `${name}Input`;
      names[name] = target;
    }
    const rename = (name: string) => names[name] ?? name;
    for (const [name, def] of Object.entries(converted.defs))
      components[rename(name)] = rewriteRefs(def, rename) as Json;
    return rewriteRefs(converted.schema, rename) as Json;
  };

  // Seed components with output-mode named schemas so names stay stable.
  for (const schema of Object.values(NAMED)) hoist(toJsonSchema(schema, 'output'), 'output');

  const paths: Record<string, Record<string, Json>> = {};
  for (const [operationId, endpoint] of Object.entries(endpoints) as [string, EndpointDefinition][]) {
    const parameters: Json[] = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    if (endpoint.query) {
      const query = toJsonSchema(endpoint.query, 'input').schema as {
        properties?: Record<string, Json>;
        required?: string[];
      };
      for (const [name, schema] of Object.entries(query.properties ?? {})) {
        parameters.push({ name, in: 'query', required: query.required?.includes(name) ?? false, schema });
      }
    }
    if (endpoint.ifMatch) {
      parameters.push({
        name: 'If-Match',
        in: 'header',
        required: endpoint.method === 'PATCH',
        description: 'Quoted revision being edited, e.g. "3".',
        schema: { type: 'string' },
      });
    }
    if (endpoint.idempotent) {
      parameters.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        description: 'Unique per logical operation; retries reuse it.',
        schema: { type: 'string', maxLength: 128 },
      });
    }

    const response = hoist(toJsonSchema(endpoint.response, 'output'), 'output');
    const success = String(endpoint.successStatus ?? 200);
    const operation: Json = {
      operationId,
      tags: [endpoint.tag],
      summary: endpoint.summary,
      parameters,
      responses: {
        [success]: {
          description: endpoint.stream
            ? 'Server-sent event stream; each `data:` line is one JSON event.'
            : 'Success',
          content: endpoint.stream
            ? { 'text/event-stream': { schema: response } }
            : { 'application/json': { schema: response } },
        },
        default: {
          description: `Error. Possible codes include: ${['unauthenticated', 'forbidden', 'not_found', ...(endpoint.errors ?? [])].join(', ')}.`,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
      },
    };
    if (endpoint.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: hoist(toJsonSchema(endpoint.body, 'input'), 'input') } },
      };
    }
    paths[endpoint.path] ??= {};
    paths[endpoint.path]![endpoint.method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Lighthouse API',
      version: '1.0.0-draft',
      description:
        'Contract required by the Lighthouse web client. Generated from frontend/src/api/contract — edit the Zod schemas, not this file.',
    },
    servers: [{ url: 'https://api.lighthouse.example' }],
    tags: ['Session', 'Datasets', 'Records', 'Charts', 'Dashboards', 'Actions', 'Runs', 'Uploads'].map(
      (name) => ({ name }),
    ),
    paths,
    components: {
      schemas: Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))),
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'lh_session' } },
    },
    security: [{ session: [] }],
  };
}
