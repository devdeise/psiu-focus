import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = {
  id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  nome_profissional: string | null;
  pin: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[auth] fetchProfile", error);
    return null;
  }
  if (data) return data as ProfileRow;
  // Fallback: create profile if trigger didn't run
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId })
    .select("*")
    .maybeSingle();
  if (insertError) {
    console.error("[auth] create profile", insertError);
    return null;
  }
  return (created as ProfileRow) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => {
          if (!mounted) return;
          fetchProfile(newSession.user.id).then((p) => mounted && setProfile(p));
        }, 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).then((p) => {
          if (!mounted) return;
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: async () => {
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
