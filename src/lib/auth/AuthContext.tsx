"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type SendMagicLinkResult = { success: boolean; error?: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  sendMagicLink: (email: string) => Promise<SendMagicLinkResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: false,
  isSupabaseConfigured: false,
  sendMagicLink: async () => ({ success: false, error: "Supabase not configured" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Supabase未設定の場合、確認する意味がないので最初からloading=falseにする
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // パスワード管理の手間・漏洩リスクを避けるため、メールのマジックリンクのみに絞る
  const sendMagicLink = useCallback(async (email: string): Promise<SendMagicLinkResult> => {
    if (!supabase) return { success: false, error: "Supabase not configured" };
    const trimmed = email.trim();
    if (!trimmed) return { success: false, error: "empty email" };

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/mypage" : undefined,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isSupabaseConfigured,
    sendMagicLink,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
