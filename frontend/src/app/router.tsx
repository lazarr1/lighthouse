import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { LoadingState } from '@/ui';
import { NotFound, RouteError } from './screens';
import { RootRedirect, WorkspaceLayout } from './WorkspaceLayout';

/** Pages are code-split; the shell loads first and each view on demand. */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingState label="Loading…" />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        path: '/w/:workspaceId',
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          {
            path: 'dashboard',
            lazy: async () => ({
              Component: (await import('@/features/dashboard/DashboardPage')).DashboardPage,
            }),
          },
          {
            path: 'data/:datasetId?',
            lazy: async () => ({ Component: (await import('@/features/data/DataPage')).DataPage }),
          },
          {
            path: 'actions/:actionId?',
            lazy: async () => ({ Component: (await import('@/features/actions/ActionsPage')).ActionsPage }),
          },
        ],
      },
      {
        path: '/dev/api',
        lazy: async () => ({
          Component: (await import('@/features/devtools/ContractExplorerPage')).ContractExplorerPage,
        }),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
