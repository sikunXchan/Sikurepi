import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabaseの環境変数が未設定でもアプリ全体がクラッシュしないよう、
// アカウント機能(ログイン・複数端末同期)だけを丸ごと無効化して
// 従来通りのゲスト/ローカル専用モードにフォールバックする。
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
  : null;
