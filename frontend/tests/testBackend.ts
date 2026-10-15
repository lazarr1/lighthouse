import { setupServer } from 'msw/node';
import { ApiClient } from '@/api/client';
import { MockDb, type MockDbOptions } from '@/mocks/db';
import { createHandlers } from '@/mocks/handlers';

export const TEST_BASE_URL = 'http://api.test';

export const server = setupServer();

let db: MockDb;

/** Fresh, strict, zero-latency mock backend. Called before every test. */
export function resetTestBackend(options: MockDbOptions = {}) {
  db = new MockDb({ stepDelayMs: 0, recordCount: 300, ...options });
  server.resetHandlers(...createHandlers(db, { baseUrl: TEST_BASE_URL, latencyMs: 0, strict: true }));
  return db;
}

/** The mock database behind the current test's backend. */
export const testDb = () => db;

export const createTestClient = () => new ApiClient({ baseUrl: TEST_BASE_URL });
