import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { describeError } from '@/api/client';
import type { Upload } from '@/api/contract';
import { cx } from '@/lib/cx';
import { Icon, IconButton, ProgressLine, Spinner } from '@/ui';
import { useCreateActionDraft } from '../actions/hooks';
import { isAllowedUpload, useUploadFile } from '../uploads/useUploadFile';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { ActionDraftCard } from './ActionDraftCard';
import { useAssistant } from './AssistantContext';
import styles from './AssistantPanel.module.css';
import { initialThread, promptWithContext, threadReducer } from './thread';

const SUGGESTIONS = [
  {
    icon: 'search' as const,
    text: 'Find new companies that match our ideal customer profile and add them as leads.',
    label: 'Find new companies',
  },
  {
    icon: 'refresh' as const,
    text: 'Clean duplicate leads and keep the most complete record.',
    label: 'Clean duplicates',
  },
  {
    icon: 'image' as const,
    text: 'Turn this business card image into a new lead.',
    label: 'Import from an image',
  },
];

let entryCounter = 0;
const entryId = () => `entry-${(entryCounter += 1)}`;

/** Right-hand AI panel for building actions in plain language. */
export function AssistantPanel() {
  const { open, setOpen, composerRef, prefill, consumePrefill } = useAssistant();
  const { workspace } = useWorkspace();
  const [thread, dispatch] = useReducer(threadReducer, initialThread);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{
    file: File;
    upload: Upload | null;
    error: string | null;
  } | null>(null);
  const createDraft = useCreateActionDraft();
  const upload = useUploadFile();
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefill) {
      setText(prefill);
      consumePrefill();
    }
  }, [prefill, consumePrefill]);

  useEffect(() => {
    threadRef.current?.scrollTo?.({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread.entries.length, createDraft.isPending]);

  if (!open) return null;

  const attach = (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedUpload(file)) {
      setAttachment({ file, upload: null, error: 'Use an image, PDF or CSV under 20 MB.' });
      return;
    }
    setAttachment({ file, upload: null, error: null });
    upload.mutate(file, {
      onSuccess: (result) =>
        setAttachment((current) =>
          current?.file === file ? { file, upload: result, error: null } : current,
        ),
      onError: (error) =>
        setAttachment((current) =>
          current?.file === file ? { file, upload: null, error: describeError(error) } : current,
        ),
    });
    if (!text.trim()) setText('Turn this image into a new record.');
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message || createDraft.isPending || upload.isPending) return;
    if (attachment && !attachment.upload) return;
    dispatch({ type: 'userSent', id: entryId(), text: message, attachment: attachment?.file.name ?? null });
    createDraft.mutate(
      {
        prompt: promptWithContext(thread, message),
        attachmentIds: attachment?.upload ? [attachment.upload.id] : [],
        datasetId: workspace.datasets[0]?.id,
      },
      {
        onSuccess: (draft) => dispatch({ type: 'draftReceived', id: entryId(), draft }),
        onError: (error) =>
          dispatch({
            type: 'assistantSaid',
            id: entryId(),
            text: 'I couldn’t plan that.',
            detail: describeError(error),
            tone: 'error',
          }),
      },
    );
    setText('');
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <aside className={styles.panel} aria-label="Assistant">
      <header className={styles.header}>
        <span className={styles.aiMark}>
          <Icon name="sparkle" size={15} />
        </span>
        <div>
          <h2>Assistant</h2>
          <p>Build repeatable work from plain language</p>
        </div>
        <IconButton icon="close" label="Close assistant" size="sm" onClick={() => setOpen(false)} />
      </header>

      <div ref={threadRef} className={styles.thread} aria-live="polite">
        <div className={styles.message}>
          <span className={styles.miniAi}>
            <Icon name="sparkle" size={13} />
          </span>
          <div className={styles.bubble}>
            <p>What would you like to do with your data?</p>
            <span>
              I’ll show you exactly what I plan to do — and preview the changes — before anything is saved.
            </span>
          </div>
        </div>
        {thread.entries.length === 0 ? (
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => {
                  setText(suggestion.text);
                  if (suggestion.icon === 'image') fileRef.current?.click();
                  else composerRef.current?.focus();
                }}
              >
                <Icon name={suggestion.icon} size={14} />
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        {thread.entries.map((entry) =>
          entry.kind === 'user' ? (
            <div key={entry.id} className={cx(styles.message, styles.user)}>
              <div className={styles.userBubble}>
                {entry.text}
                {entry.attachment ? (
                  <span className={styles.attachmentNote}>
                    <Icon name="image" size={12} /> {entry.attachment}
                  </span>
                ) : null}
              </div>
            </div>
          ) : entry.kind === 'assistant' ? (
            <div key={entry.id} className={styles.message}>
              <span className={cx(styles.miniAi, entry.tone === 'error' && styles.miniError)}>
                <Icon name={entry.tone === 'error' ? 'alert' : 'sparkle'} size={13} />
              </span>
              <div className={styles.bubble}>
                <p>{entry.text}</p>
                {entry.detail ? <span>{entry.detail}</span> : null}
              </div>
            </div>
          ) : (
            <ActionDraftCard key={entry.id} draft={entry.draft} />
          ),
        )}
        {createDraft.isPending ? <ProgressLine label="Planning a safe action…" /> : null}
      </div>

      <form className={styles.composer} onSubmit={send}>
        {attachment ? (
          <div className={cx(styles.attachment, attachment.error && styles.attachmentError)}>
            <span className={styles.fileIcon}>
              {upload.isPending ? (
                <Spinner size={11} />
              ) : (
                <Icon name={attachment.error ? 'alert' : 'image'} size={12} />
              )}
            </span>
            <span className={styles.attachmentName}>{attachment.error ?? attachment.file.name}</span>
            <IconButton
              icon="close"
              label="Remove attachment"
              size="sm"
              onClick={() => {
                setAttachment(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
          </div>
        ) : null}
        <textarea
          ref={composerRef}
          aria-label="Ask Lighthouse to build an action"
          placeholder="Ask Lighthouse to build an action…"
          rows={2}
          maxLength={4000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className={styles.controls}>
          <label className={styles.attach} title="Attach an image or file">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,text/csv"
              hidden
              onChange={(event) => attach(event.target.files?.[0])}
            />
            <Icon name="upload" size={14} />
            <span>Attach</span>
          </label>
          <span className={styles.hint}>Shift + Enter for a new line</span>
          <button
            type="submit"
            className={styles.send}
            aria-label="Send"
            disabled={
              !text.trim() ||
              createDraft.isPending ||
              upload.isPending ||
              (!!attachment && !attachment.upload)
            }
          >
            <Icon name="send" size={15} />
          </button>
        </div>
      </form>
    </aside>
  );
}
