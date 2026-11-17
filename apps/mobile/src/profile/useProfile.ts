import { useCallback, useEffect, useState } from 'react';

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

type Loaded = { forUser: string | null; profile: Profile | null; error: string | null };

export function useProfile(): ProfileState {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  // State is tagged with the user it was loaded for, so a user switch shows
  // "loading" immediately instead of the previous user's profile.
  const [loaded, setLoaded] = useState<Loaded>({ forUser: null, profile: null, error: null });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        setLoaded({
          forUser: userId,
          profile: error ? null : data,
          error: error ? "Couldn't load your profile." : null,
        });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: ProfileUpdate) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId)
        .select('*')
        .single();
      setLoaded((prev) =>
        error || !data
          ? { ...prev, error: "Couldn't save your changes. Please try again." }
          : { forUser: userId, profile: data, error: null },
      );
    },
    [userId],
  );

  const current = loaded.forUser === userId;
  return {
    profile: current ? loaded.profile : null,
    isLoading: !!userId && !current,
    error: current ? loaded.error : null,
    update,
  };
}
