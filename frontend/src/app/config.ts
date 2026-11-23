import { selectEndpoints, type EndpointName } from '@/api/contract';

/**
 * - `mock`:   every request is answered by the in-browser mock backend.
 * - `hybrid`: endpoints listed in `VITE_LIVE_ENDPOINTS` go to the real backend
 *             (via the Vite dev proxy); everything else stays mocked.
 * - `http`:   everything goes to the real backend.
 */
export type ApiMode = 'mock' | 'hybrid' | 'http';

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
  /** Endpoints served by the real backend (all of them in `http` mode, none in `mock`). */
  liveEndpoints: ReadonlySet<EndpointName>;
}

/** Reads build-time configuration (see `.env.example`). */
export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const apiMode: ApiMode =
    env.VITE_API_MODE === 'http' || env.VITE_API_MODE === 'hybrid' ? env.VITE_API_MODE : 'mock';
  const live =
    apiMode === 'http'
      ? selectEndpoints('*').names
      : apiMode === 'hybrid'
        ? selectEndpoints(env.VITE_LIVE_ENDPOINTS).names
        : new Set<EndpointName>();
  return {
    apiMode,
    // Mock and hybrid use same-origin requests: the mock intercepts them and the Vite
    // proxy forwards the rest. `http` may point at another origin (CORS + credentials).
    apiBaseUrl: apiMode === 'http' ? (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') : '',
    liveEndpoints: live,
  };
}
