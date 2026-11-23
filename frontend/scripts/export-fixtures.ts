/**
 * Writes the mock backend's seed data to fixtures/seed.json so a real backend
 * can load the same workspace, dataset, records, dashboard and actions with
 * the same IDs. That keeps hybrid mode coherent: live and mocked endpoints
 * then agree on every ID.
 *
 *   npm run fixtures:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MockDb } from '../src/mocks/db';
import { WORKSPACE_ID } from '../src/mocks/fixtures';

const db = new MockDb();
const seed = {
  description: 'Seed data matching the Lighthouse web client mock backend. Values are keyed by field ID.',
  session: db.session,
  workspace: db.workspace(WORKSPACE_ID),
  datasets: [{ ...db.dataset, records: db.records }],
  dashboards: [db.dashboard],
  actions: [...db.actions.values()],
  runs: [...db.runs.values()],
};

const dir = fileURLToPath(new URL('../fixtures/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}seed.json`, `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Wrote ${dir}seed.json (${db.records.length} records)`);
