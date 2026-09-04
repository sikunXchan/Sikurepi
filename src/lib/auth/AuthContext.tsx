"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type AuthResult = { success: boolean; error?: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  sendLoginCode: (email: string) => Promise<AuthResult>;
  verifyLoginCode: (email: string, code: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: false,
  isSupabaseConfigured: false,
  sendLoginCode: async () => ({ success: false, error: "Supabase not configured" }),
  verifyLoginCode: async () => ({ success: false, error: "Supabase not configured" }),
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

  // パスワード管理の手間・漏洩リスクを避けるため、メールで送る確認コードのみに絞る。
  // (リンク方式だと、Capacitorのネイティブアプリではメールのリンクが
  // Safari側で開いてしまい、アプリ本体のログイン状態に反映されないため)
  const sendLoginCode = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: "Supabase not configured" };
    const trimmed = email.trim();
    if (!trimmed) return { success: false, error: "empty email" };

    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const verifyLoginCode = useCallback(async (email: string, code: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: "Supabase not configured" };
    const trimmed = email.trim();
    const trimmedCode = code.trim();
    if (!trimmed || !trimmedCode) return { success: false, error: "empty email or code" };

    const { error } = await supabase.auth.verifyOtp({ email: trimmed, token: trimmedCode, type: "email" });
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
    sendLoginCode,
    verifyLoginCode,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
