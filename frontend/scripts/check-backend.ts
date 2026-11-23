/**
 * Validates a running backend against the API contract.
 *
 *   npm run contract:check                         # http://localhost:8080 (or VITE_API_PROXY_TARGET)
 *   npm run contract:check -- http://localhost:9000 --writes
 *   npm run contract:check -- --only "Session, Records"
 *   LIGHTHOUSE_COOKIE="lh_session=…" npm run contract:check
 *   npm run contract:check -- --header "Authorization: Bearer …"
 *
 * Exit code 1 if any implemented endpoint returns something the web client
 * would reject. Endpoints the server doesn't implement yet are listed as "missing".
 */
import { ApiClient } from '../src/api/client';
import { selectEndpoints } from '../src/api/contract/selectEndpoints';
import { runLiveCheck, type CheckStatus } from '../src/api/liveCheck';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args.splice(index, 2)[1] : undefined;
};
const writes = args.includes('--writes');
const only = flag('--only');
const header = flag('--header');
const baseUrl = (
  args.find((arg) => !arg.startsWith('--')) ??
  process.env.VITE_API_PROXY_TARGET ??
  'http://localhost:8080'
).replace(/\/$/, '');

const extraHeaders = new Headers();
if (process.env.LIGHTHOUSE_COOKIE) extraHeaders.set('Cookie', process.env.LIGHTHOUSE_COOKIE);
if (header) {
  const colon = header.indexOf(':');
  extraHeaders.set(header.slice(0, colon).trim(), header.slice(colon + 1).trim());
}

const api = new ApiClient({
  baseUrl,
  fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    extraHeaders.forEach((value, key) => headers.set(key, value));
    return fetch(input, { ...init, headers });
  },
});

const selection = only ? selectEndpoints(only) : undefined;
if (selection?.unknown.length)
  console.warn(`Unknown endpoints/tags ignored: ${selection.unknown.join(', ')}`);

console.log(
  `Checking ${baseUrl} against the Lighthouse API contract${writes ? ' (including writes)' : ''}…\n`,
);
const results = await runLiveCheck(api, { writes, only: selection?.names });

const ICON: Record<CheckStatus, string> = { pass: '✓', fail: '✗', missing: '·', skipped: '–' };
const width = Math.max(...results.map((r) => r.label.length));
for (const result of results) {
  console.log(
    `${ICON[result.status]} ${result.label.padEnd(width)}  ${result.endpoint.padEnd(20)} ${result.detail}`,
  );
}
const count = (status: CheckStatus) => results.filter((r) => r.status === status).length;
console.log(
  `\n${count('pass')} passed · ${count('fail')} failed · ${count('missing')} not implemented · ${count('skipped')} skipped`,
);
process.exit(count('fail') ? 1 : 0);
