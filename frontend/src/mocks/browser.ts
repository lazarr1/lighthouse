import { setupWorker } from 'msw/browser';
import { MockDb } from './db';
import { createHandlers } from './handlers';

/** Starts the in-browser mock backend. Only imported when `VITE_API_MODE=mock`. */
export async function startMockBackend(baseUrl: string) {
  const db = new MockDb();
  const worker = setupWorker(...createHandlers(db, { baseUrl, latencyMs: 180, strict: false }));
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  // Handy for poking at state from devtools.
  (window as unknown as { __lighthouseMockDb: MockDb }).__lighthouseMockDb = db;
  return db;
}
