import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type SessionContextValue = {
  session: Session | null;
  /** True until the initial session has been read (bounded by a failsafe). */
  initializing: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, initializing: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let done = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        done = true;
        setSession(data.session);
        setInitializing(false);
      })
      .catch(() => {
        done = true;
        setInitializing(false);
      });

    // Never stay "initializing" forever if getSession wedges.
    const failsafe = setTimeout(() => {
      if (!done) setInitializing(false);
    }, 4000);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => {
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={{ session, initializing }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
