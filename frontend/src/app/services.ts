import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { ApiClient, isApiError } from '@/api/client';
import type { AppConfig } from './config';

/** Tiny observable flag so any 401 anywhere can switch the app to the signed-out screen. */
export function createAuthState() {
  let signedOut = false;
  const listeners = new Set<() => void>();
  return {
    isSignedOut: () => signedOut,
    signOut: () => {
      if (signedOut) return;
      signedOut = true;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
export type AuthState = ReturnType<typeof createAuthState>;

export interface AppServices {
  api: ApiClient;
  queryClient: QueryClient;
  auth: AuthState;
  config: AppConfig;
}

/** Composition root: everything with side effects is created here and injected. */
export function createAppServices(config: AppConfig, overrides: { fetch?: typeof fetch } = {}): AppServices {
  const auth = createAuthState();
  const api = new ApiClient({
    baseUrl: config.apiBaseUrl,
    fetch: overrides.fetch,
    onUnauthenticated: auth.signOut,
  });
  const onError = (error: unknown) => {
    if (isApiError(error) && error.code === 'contract_violation') console.error(error.message, error.details);
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry only transient failures; a 404 or contract violation won't fix itself.
        retry: (count, error) => count < 2 && isApiError(error) && error.isTransient,
      },
      mutations: { retry: false },
    },
  });
  return { api, queryClient, auth, config };
}
