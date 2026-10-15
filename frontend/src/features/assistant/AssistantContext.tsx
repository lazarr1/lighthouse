import { createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

interface AssistantContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Open the panel and focus the composer (⌘K). */
  focus: (prefill?: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  prefill: string | null;
  consumePrefill: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prefill, setPrefill] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const value = useMemo<AssistantContextValue>(
    () => ({
      open,
      setOpen,
      composerRef,
      prefill,
      consumePrefill: () => setPrefill(null),
      focus: (text) => {
        setOpen(true);
        if (text) setPrefill(text);
        requestAnimationFrame(() => composerRef.current?.focus());
      },
    }),
    [open, prefill],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return context;
}
