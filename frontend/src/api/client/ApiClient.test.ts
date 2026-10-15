import { describe, expect, it, vi } from 'vitest';
import { endpoints } from '../contract';
import { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';
import { SseParser } from './sse';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function clientWith(response: Response | (() => Promise<Response>)) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    typeof response === 'function' ? response : async () => response,
  );
  return {
    fetch,
    client: new ApiClient({ baseUrl: 'http://x.test', fetch, generateId: () => 'generated-key' }),
  };
}

const SESSION = { user: { id: 'u', name: 'A', email: 'a@b.co' }, workspaces: [] };

describe('ApiClient', () => {
  it('builds URLs from path params and encodes them', async () => {
    const { fetch, client } = clientWith(json({}, 404));
    await client.request(endpoints.getWorkspace, { params: { workspaceId: 'a/b' } }).catch(() => {});
    expect(fetch.mock.calls[0]?.[0]).toBe('http://x.test/v1/workspaces/a%2Fb');
  });

  it('sends Idempotency-Key for idempotent endpoints and If-Match for revisioned ones', async () => {
    const { fetch, client } = clientWith(json({}, 500));
    await client.request(endpoints.startRun, { params: { actionId: 'a' } }).catch(() => {});
    await client
      .request(endpoints.updateRecord, {
        params: { datasetId: 'd', recordId: 'r' },
        body: { values: {} },
        ifMatch: 7,
      })
      .catch(() => {});
    const [, startInit] = fetch.mock.calls[0]!;
    const [, updateInit] = fetch.mock.calls[1]!;
    expect(new Headers(startInit?.headers).get('Idempotency-Key')).toBe('generated-key');
    expect(new Headers(updateInit?.headers).get('If-Match')).toBe('"7"');
    expect(new Headers(updateInit?.headers).get('Idempotency-Key')).toBeNull();
  });

  it('returns parsed, validated responses', async () => {
    const { client } = clientWith(json(SESSION));
    await expect(client.request(endpoints.getSession, {})).resolves.toEqual(SESSION);
  });

  it('raises contract_violation when the server response does not match the schema', async () => {
    const { client } = clientWith(json({ user: { id: 'u' } }));
    await expect(client.request(endpoints.getSession, {})).rejects.toMatchObject({
      code: 'contract_violation',
    });
  });

  it('maps error bodies to ApiError with code, details and request id', async () => {
    const { client } = clientWith(
      json(
        {
          error: {
            code: 'revision_conflict',
            message: 'Changed',
            details: { current: 1 },
            requestId: 'req_1',
          },
        },
        409,
      ),
    );
    const error = (await client.request(endpoints.getSession, {}).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'revision_conflict',
      status: 409,
      details: { current: 1 },
      requestId: 'req_1',
    });
  });

  it('falls back to a status-derived code for non-contract error bodies', async () => {
    const { client } = clientWith(new Response('<html>Bad gateway</html>', { status: 503 }));
    await expect(client.request(endpoints.getSession, {})).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports network failures as network_error and notifies on 401', async () => {
    const { client } = clientWith(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(client.request(endpoints.getSession, {})).rejects.toMatchObject({ code: 'network_error' });

    const onUnauthenticated = vi.fn();
    const unauth = new ApiClient({ baseUrl: '', fetch: async () => json({}, 401), onUnauthenticated });
    await expect(unauth.request(endpoints.getSession, {})).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('refuses to send a body that violates the contract', async () => {
    const { fetch, client } = clientWith(json({}));
    await expect(
      // Types allow any string; the schema requires a non-empty prompt.
      client.request(endpoints.createChartDraft, { body: { datasetId: 'd', prompt: '' } }),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('SseParser', () => {
  it('parses events split across arbitrary chunk boundaries', () => {
    const parser = new SseParser();
    const input = 'event: log\ndata: {"a":\ndata: 1}\nid: 3\n\n: comment\ndata: second\r\n\r\n';
    const events = [...input].flatMap((char) => parser.push(char));
    expect(events).toEqual([
      { event: 'log', data: '{"a":\n1}', id: '3' },
      { event: 'message', data: 'second', id: '3' },
    ]);
  });
});
