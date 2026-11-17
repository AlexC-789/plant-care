import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The app's one cache of server data. Screens show what they loaded last time instantly
 * and refresh in the background (loading rules, 2026-11-17). Kept for a day; cleared on
 * sign-out.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: DAY_MS },
  },
});

// React Native has no window focus: refresh stale data when the app returns to the foreground.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
  return () => subscription.remove();
});
