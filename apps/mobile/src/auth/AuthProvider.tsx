import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, isLoading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, isLoading: false });
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Never show one user's cached data to the next person who signs in.
      if (event === 'SIGNED_OUT') queryClient.clear();
      if (active) setState({ session, isLoading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
