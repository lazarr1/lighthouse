import { createContext, useContext, type ReactNode } from 'react';
import type { Session, Workspace } from '@/api/contract';

interface WorkspaceContextValue {
  workspace: Workspace;
  user: Session['user'];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** The active workspace. Only available inside a `/w/:workspaceId` route. */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside a workspace route');
  return context;
}
