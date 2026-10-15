import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { readConfig } from './app/config';
import { createAppServices } from './app/services';
import './styles/global.css';

async function bootstrap() {
  const config = readConfig();
  if (config.apiMode === 'mock') {
    // Contract mock runs in a service worker; it is code-split out of http builds.
    const { startMockBackend } = await import('./mocks/browser');
    await startMockBackend(config.apiBaseUrl);
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <App services={createAppServices(config)} />
    </StrictMode>,
  );
}

void bootstrap();
