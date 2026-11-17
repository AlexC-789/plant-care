import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useSession } from '@/auth/AuthProvider';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type ProfilesTable = Database['public']['Tables']['profiles'];

export type Profile = ProfilesTable['Row'];
export type ProfileUpdate = Pick<
  ProfilesTable['Update'],
  'display_name' | 'units' | 'notification_prefs' | 'quiet_hours_start' | 'quiet_hours_end'
>;

type ProfileState = {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  update: (patch: ProfileUpdate) => Promise<void>;
};

export const profileKey = (userId: string | null) => ['profile', userId] as const;

/** The signed-in user's profile, served from the client cache and refreshed in the background. */
export function useProfile(): ProfileState {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId!)
        .select('*')
        .single();
      if (error || !data) throw error ?? new Error('No profile returned');
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(profileKey(userId), data),
  });

  const { mutateAsync } = mutation;
  const update = useCallback(
    async (patch: ProfileUpdate) => {
      if (!userId) return;
      try {
        await mutateAsync(patch);
      } catch {
        // Reported through `error` below.
      }
    },
    [userId, mutateAsync],
  );

  return {
    profile: userId ? (query.data ?? null) : null,
    isLoading: !!userId && query.isPending,
    error: mutation.isError
      ? "Couldn't save your changes. Please try again."
      : query.isError
        ? "Couldn't load your profile."
        : null,
    update,
  };
}
