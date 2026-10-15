import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiProvider } from '@/api/ApiProvider';
import { ToastProvider } from '@/ui';
import type { AppServices } from './services';

export function Providers({ services, children }: { services: AppServices; children: ReactNode }) {
  return (
    <ApiProvider client={services.api}>
      <QueryClientProvider client={services.queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ApiProvider>
  );
}
