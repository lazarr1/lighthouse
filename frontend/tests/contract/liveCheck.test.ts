import { describe, expect, it } from 'vitest';
import { runLiveCheck } from '@/api/liveCheck';
import { endpoints, selectEndpoints } from '@/api/contract';
import { createTestClient, server, TEST_BASE_URL } from '../testBackend';
import { http, HttpResponse } from 'msw';

describe('runLiveCheck (backend contract checker)', () => {
  it('passes every read and write check against a conforming backend', async () => {
    const results = await runLiveCheck(createTestClient(), { writes: true });
    expect(results.filter((r) => r.status === 'fail')).toEqual([]);
    expect(results.filter((r) => r.status === 'pass').length).toBeGreaterThan(15);
    expect(results.map((r) => r.label)).toContain('PATCH with stale If-Match → 409');
  });

  it('reports contract violations with the offending path', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/v1/datasets/:datasetId`, () =>
        HttpResponse.json({ id: 'ds_leads', name: 42 }),
      ),
    );
    const results = await runLiveCheck(createTestClient());
    const failure = results.find((r) => r.endpoint === 'getDataset');
    expect(failure?.status).toBe('fail');
    expect(failure?.detail).toMatch(/violates contract — .*name/);
  });

  it('marks unimplemented routes as missing and can focus on a subset', async () => {
    server.use(
      http.get(
        `${TEST_BASE_URL}/v1/dashboards/:dashboardId`,
        () => new HttpResponse('Not Found', { status: 404 }),
      ),
    );
    const results = await runLiveCheck(createTestClient(), { only: selectEndpoints('Dashboards').names });
    expect(results.every((r) => r.endpoint === 'getDashboard' || r.endpoint === 'getWidgetData')).toBe(true);
    expect(results.find((r) => r.endpoint === 'getDashboard')?.status).toBe('missing');
  });
});

describe('selectEndpoints', () => {
  it('accepts names, tags (any case) and *, and reports typos', () => {
    const { names, unknown } = selectEndpoints('getDashboard, records  sesion');
    expect(names.has('getDashboard')).toBe(true);
    expect(names.has('updateRecord')).toBe(true);
    expect(unknown).toEqual(['sesion']);
    expect(selectEndpoints('*').names.size).toBe(Object.keys(endpoints).length);
  });
});
