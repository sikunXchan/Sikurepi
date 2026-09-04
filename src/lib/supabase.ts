import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 値が空文字でなくても、コピペミス等で不正なURL(プレースホルダーの貼り忘れ・
// 別の値の貼り間違い等)が入っていることがある。createClient()はURLとして
// 不正だと即座に例外を投げ、これがモジュール読み込み時(トップレベル)で
// 起きるとビルド/全ページが丸ごと落ちてしまうため、事前に検証しておく。
function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidHttpUrl(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  } catch (e) {
    // ここでも万一失敗した場合は、アカウント機能を諦めてローカル専用モードへ
    console.error("Failed to initialize Supabase client:", e);
    client = null;
  }
} else if (SUPABASE_URL || SUPABASE_ANON_KEY) {
  // 環境変数が設定されてはいるが不正な値のケースをデバッグしやすくする
  console.error(
    "Supabase env vars are set but invalid (NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY must be non-empty). Falling back to local-only mode."
  );
}

export const supabase: SupabaseClient | null = client;
