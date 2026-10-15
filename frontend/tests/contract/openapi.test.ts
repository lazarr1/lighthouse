import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '@/api/contract/openapi';
import { endpoints } from '@/api/contract';

describe('OpenAPI document', () => {
  const document = buildOpenApiDocument();

  it('documents every endpoint with a resolvable schema', () => {
    const operations = Object.values(document.paths).flatMap((methods) => Object.values(methods));
    expect(operations).toHaveLength(Object.keys(endpoints).length);
    const refs = [...JSON.stringify(document).matchAll(/"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]!);
    for (const ref of refs) expect(document.components.schemas, ref).toHaveProperty(ref);
  });

  it('docs/openapi.json is up to date (run `npm run contract:openapi`)', () => {
    const committed = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/openapi.json'), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
