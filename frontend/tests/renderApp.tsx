import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/router';
import { createAppServices } from '@/app/services';
import { WORKSPACE_ID } from '@/mocks/fixtures';
import { TEST_BASE_URL } from './testBackend';

export const ws = (path: string) => `/w/${WORKSPACE_ID}${path}`;

/** Renders the whole app (real router, real API client) against the strict mock backend. */
export function renderApp(path = ws('/dashboard')) {
  const services = createAppServices({ apiMode: 'http', apiBaseUrl: TEST_BASE_URL });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <Providers services={services}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, user, router, services };
}
