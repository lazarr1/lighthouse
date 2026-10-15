export type ApiMode = 'mock' | 'http';

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
}

/** Reads build-time configuration (see `.env.example`). */
export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const apiMode: ApiMode = env.VITE_API_MODE === 'http' ? 'http' : 'mock';
  return {
    apiMode,
    // The mock intercepts same-origin requests; a real backend usually lives elsewhere.
    apiBaseUrl: apiMode === 'mock' ? '' : (env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  };
}
