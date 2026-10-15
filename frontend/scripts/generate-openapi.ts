/**
 * Writes docs/openapi.json from the Zod contract.
 *   npm run contract:openapi
 * `tests/contract/openapi.test.ts` fails if the committed file is out of date.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/api/contract/openapi';

const target = fileURLToPath(new URL('../docs/openapi.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`Wrote ${target}`);
