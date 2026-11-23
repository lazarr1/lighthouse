/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'hybrid' | 'http';
  /** Absolute backend URL for `http` mode. Leave empty to use the dev proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** Dev server only: forward `/v1` to this backend, e.g. http://localhost:8080. */
  readonly VITE_API_PROXY_TARGET?: string;
  /** `hybrid` mode: endpoint names, tags or `*`, e.g. "Session, Records, getDashboard". */
  readonly VITE_LIVE_ENDPOINTS?: string;
}
