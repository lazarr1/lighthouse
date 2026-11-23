import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { selectEndpoints } from './api/contract';
import { App } from './app/App';
import { readConfig } from './app/config';
import { createAppServices } from './app/services';
import './styles/global.css';

async function bootstrap() {
  const config = readConfig();
  if (config.apiMode !== 'http') {
    // Contract mock runs in a service worker; it is code-split out of http builds.
    const { startMockBackend } = await import('./mocks/browser');
    await startMockBackend(config.apiBaseUrl, config.liveEndpoints);
    if (config.apiMode === 'hybrid') logHybridSetup(config.liveEndpoints);
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App services={createAppServices(config)} />
    </StrictMode>,
  );
}

function logHybridSetup(live: ReadonlySet<string>) {
  const { unknown } = selectEndpoints(import.meta.env.VITE_LIVE_ENDPOINTS);
  console.info(
    `[lighthouse] Hybrid API: ${live.size} live endpoint(s) via the dev proxy:`,
    [...live].join(', ') || '(none)',
  );
  if (unknown.length)
    console.warn('[lighthouse] Unknown entries in VITE_LIVE_ENDPOINTS:', unknown.join(', '));
}

void bootstrap();
