import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one cache of server data. Screens show what they loaded last time instantly
 * and refresh in the background (loading rules, 2026-11-17). Cleared on sign-out.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
