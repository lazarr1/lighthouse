import type { ActionDraft } from '@/api/contract';

/** Conversation state for the assistant panel. Pure so it can be unit tested. */
export type ThreadEntry =
  | { id: string; kind: 'user'; text: string; attachment: string | null }
  | { id: string; kind: 'assistant'; text: string; detail?: string; tone?: 'error' }
  | { id: string; kind: 'draft'; draft: ActionDraft };

export interface ThreadState {
  entries: ThreadEntry[];
  /** Draft that a follow-up message should refine (needs_input). */
  pendingDraftId: string | null;
}

export type ThreadAction =
  | { type: 'userSent'; id: string; text: string; attachment: string | null }
  | { type: 'draftReceived'; id: string; draft: ActionDraft }
  | { type: 'assistantSaid'; id: string; text: string; detail?: string; tone?: 'error' }
  | { type: 'reset' };

export const initialThread: ThreadState = { entries: [], pendingDraftId: null };

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case 'userSent':
      return {
        ...state,
        entries: [
          ...state.entries,
          { id: action.id, kind: 'user', text: action.text, attachment: action.attachment },
        ],
      };
    case 'draftReceived':
      return {
        entries: [...state.entries, { id: action.id, kind: 'draft', draft: action.draft }],
        pendingDraftId: action.draft.status === 'needs_input' ? action.draft.id : null,
      };
    case 'assistantSaid':
      return {
        ...state,
        entries: [
          ...state.entries,
          { id: action.id, kind: 'assistant', text: action.text, detail: action.detail, tone: action.tone },
        ],
      };
    case 'reset':
      return initialThread;
  }
}

/**
 * When the previous draft asked clarifying questions, the follow-up is sent
 * together with the original request so the planner has full context.
 */
export function promptWithContext(state: ThreadState, text: string): string {
  if (!state.pendingDraftId) return text;
  const pending = state.entries.find(
    (entry) => entry.kind === 'draft' && entry.draft.id === state.pendingDraftId,
  );
  return pending?.kind === 'draft' ? `${pending.draft.prompt}\n\nMore detail: ${text}` : text;
}
