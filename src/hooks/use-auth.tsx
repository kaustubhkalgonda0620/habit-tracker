import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** The signed-in user's session, or null when signed out. */
  session: Session | null;
  /** False until the saved session (if any) has been read from storage. */
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthContextValue>({ session: null, ready: false });

  useEffect(() => {
    // Fires INITIAL_SESSION once the saved session is loaded, then on every sign-in, sign-out and
    // token refresh. Don't call other supabase.auth methods inside it: they wait on this callback.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ session, ready: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
