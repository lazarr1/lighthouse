import type { EndpointDefinition } from './endpoint';
import { endpoints, type EndpointName } from './endpoints';

/**
 * Parses an endpoint selection such as `"Session, Records, getDashboard"`.
 * Each comma/space separated token is an endpoint name (`getDashboard`), a tag
 * (`Records`, case-insensitive) or `*` for everything. Unknown tokens are
 * reported so typos don't silently fall back to the mock.
 */
export function selectEndpoints(spec: string | undefined): { names: Set<EndpointName>; unknown: string[] } {
  const names = new Set<EndpointName>();
  const unknown: string[] = [];
  const all = Object.entries(endpoints) as [EndpointName, EndpointDefinition][];
  for (const token of (spec ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (token === '*') {
      all.forEach(([name]) => names.add(name));
      continue;
    }
    const byName = all.find(([name]) => name === token);
    const byTag = all.filter(([, endpoint]) => endpoint.tag.toLowerCase() === token.toLowerCase());
    if (byName) names.add(byName[0]);
    else if (byTag.length) byTag.forEach(([name]) => names.add(name));
    else unknown.push(token);
  }
  return { names, unknown };
}

/** `METHOD /path/:param` — the shape MSW reports for a handler, used to match handlers to endpoints. */
export const handlerKey = (endpoint: Pick<EndpointDefinition, 'method' | 'path'>, baseUrl = '') =>
  `${endpoint.method} ${baseUrl}${endpoint.path.replace(/\{(\w+)\}/g, ':$1')}`;
