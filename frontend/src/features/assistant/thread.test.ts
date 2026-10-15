import { describe, expect, it } from 'vitest';
import type { ActionDraft } from '@/api/contract';
import { initialThread, promptWithContext, threadReducer } from './thread';

const draft = (status: ActionDraft['status']): ActionDraft => ({
  id: 'd1',
  workspaceId: 'w',
  actionId: null,
  prompt: 'help me',
  attachmentIds: [],
  status,
  title: 't',
  interpretation: '',
  steps: [],
  manifest: {
    inputs: [],
    outputs: [],
    permissions: [],
    limits: { maxRecordsWritten: 1, timeoutSeconds: 1, maxNetworkRequests: 0 },
  },
  hash: 'h',
  questions: [],
  rejectionReason: null,
  createdAt: '2026-10-15T00:00:00Z',
});

describe('assistant thread', () => {
  it('carries context only while a draft needs input', () => {
    let state = threadReducer(initialThread, {
      type: 'userSent',
      id: '1',
      text: 'help me',
      attachment: null,
    });
    state = threadReducer(state, { type: 'draftReceived', id: '2', draft: draft('needs_input') });
    expect(promptWithContext(state, 'dedupe')).toBe('help me\n\nMore detail: dedupe');
    state = threadReducer(state, { type: 'draftReceived', id: '3', draft: { ...draft('ready'), id: 'd2' } });
    expect(promptWithContext(state, 'next')).toBe('next');
    expect(state.entries).toHaveLength(3);
    expect(threadReducer(state, { type: 'reset' })).toBe(initialThread);
  });
});
