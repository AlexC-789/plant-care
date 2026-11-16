import { useProfile } from './useProfile';

/**
 * The single place the app decides whether the user has a paid subscription.
 * v1: `profiles.subscription_status` is set by hand. Later: RevenueCat webhook.
 */
export function useEntitlement(): { isSubscribed: boolean; isLoading: boolean } {
  const { profile, isLoading } = useProfile();
  return { isSubscribed: profile?.subscription_status === 'active', isLoading };
}
