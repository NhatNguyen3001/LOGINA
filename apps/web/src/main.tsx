import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { queryClient } from './lib/query';
import { router } from './router';
import { checkForUpdate } from './lib/app-version';

/** A code file that fails to load after a deploy is the clearest sign this tab is out of date. */
window.addEventListener('vite:preloadError', () => void checkForUpdate());
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
