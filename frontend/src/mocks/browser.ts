import { setupWorker } from 'msw/browser';
import type { EndpointName } from '@/api/contract';
import { MockDb } from './db';
import { createHandlers } from './handlers';

/**
 * Starts the in-browser mock backend. Endpoints in `live` get no handler, so
 * their requests continue to the network (the Vite proxy → your backend).
 */
export async function startMockBackend(baseUrl: string, live: ReadonlySet<EndpointName> = new Set()) {
  const db = new MockDb();
  const worker = setupWorker(...createHandlers(db, { baseUrl, latencyMs: 180, strict: false }, live));
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  // Handy for poking at state from devtools.
  (window as unknown as { __lighthouseMockDb: MockDb }).__lighthouseMockDb = db;
  return db;
}
