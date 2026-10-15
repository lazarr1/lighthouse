import { useMemo, useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router';
import { Providers } from './Providers';
import { createRouter } from './router';
import { SignedOut } from './screens';
import type { AppServices } from './services';

export function App({ services }: { services: AppServices }) {
  const router = useMemo(() => createRouter(), []);
  const signedOut = useSyncExternalStore(services.auth.subscribe, services.auth.isSignedOut);
  return (
    <Providers services={services}>
      {signedOut ? (
        <SignedOut
          loginUrl={`${services.config.apiBaseUrl}/v1/auth/login?return_to=${encodeURIComponent(window.location.href)}`}
        />
      ) : (
        <RouterProvider router={router} />
      )}
    </Providers>
  );
}
