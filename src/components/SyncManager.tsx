"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { buildBackupPayload, applyBackupPayload, hasLocalData } from "@/lib/storage";

const SYNC_DEBOUNCE_MS = 2000;

// アカウント同期の実体。画面には何も表示しない、layout.tsxにグローバル1つだけ
// マウントする常駐コンポーネント。
//
// 方針(シンプルな「全量スナップショット」同期):
// - ログイン直後: サーバーに既にデータがあればローカルへ反映(=そのデータで上書き)。
//   サーバーが空で、この端末にローカルデータがあればサーバーへアップロードする。
// - ログイン中の書き込み: 既存のstorage.ts経由の書き込みは全て"storage-updated"
//   イベントを発火する仕組みになっているため、それを購読して(デバウンスしつつ)
//   バックグラウンドでサーバーへ同期する。
// - アプリがバックグラウンドから復帰した時(visibilitychange/focus): スマホでは
//   ホーム画面から戻ってもページが完全に再読み込みされず、コンポーネントが
//   マウントされたままのことが多い。マウント時にしか同期しない設計だと、
//   他端末で行われた変更がいつまでも反映されないため、復帰のたびに明示的に
//   再取得する。
//
// 制限事項(意図的な割り切り):
// - 行単位のマージは行わない。複数端末をほぼ同時に操作した場合は後勝ちになる。
export default function SyncManager() {
  const { user, isSupabaseConfigured } = useAuth();
  const didInitialSyncRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pullingRef = useRef(false);

  const pushToRemote = useCallback(async (userId: string) => {
    if (!supabase) return;
    const payload = buildBackupPayload();
    await supabase.from("user_data").upsert({
      user_id: userId,
      data: payload,
      updated_at: new Date().toISOString(),
    });
  }, []);

  const pullFromRemote = useCallback(async (userId: string) => {
    if (!supabase || pullingRef.current) return;
    pullingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // 取得失敗(通信エラー等)を「サーバーにまだデータが無い」と誤判定すると、
        // 他端末が既に同期済みのデータをこの端末のローカルデータで上書き
        // プッシュして消してしまう恐れがあるため、何もしない(次の機会に再試行される)。
        console.error("Failed to fetch remote user_data:", error);
        return;
      }

      const remoteData = data?.data;
      const remoteHasData = remoteData && typeof remoteData === "object" && Object.keys(remoteData).length > 0;

      if (remoteHasData) {
        isApplyingRemoteRef.current = true;
        applyBackupPayload(remoteData);
        isApplyingRemoteRef.current = false;
      } else if (hasLocalData()) {
        await pushToRemote(userId);
      }
    } finally {
      pullingRef.current = false;
    }
  }, [pushToRemote]);

  // ログイン/ログアウトの切り替わりで初回同期を行う
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    if (!user) {
      didInitialSyncRef.current = false;
      userIdRef.current = null;
      return;
    }

    if (userIdRef.current === user.id && didInitialSyncRef.current) return;
    userIdRef.current = user.id;

    let cancelled = false;
    (async () => {
      await pullFromRemote(user.id);
      if (cancelled) return;
      didInitialSyncRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isSupabaseConfigured, pullFromRemote]);

  // ローカルの書き込みをバックグラウンドでサーバーへ反映する
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const onStorageUpdated = () => {
      if (isApplyingRemoteRef.current) return;
      if (!userIdRef.current || !didInitialSyncRef.current) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (userIdRef.current) pushToRemote(userIdRef.current);
      }, SYNC_DEBOUNCE_MS);
    };

    window.addEventListener("storage-updated", onStorageUpdated);
    return () => {
      window.removeEventListener("storage-updated", onStorageUpdated);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isSupabaseConfigured]);

  // アプリがバックグラウンドから復帰したタイミングで再同期する
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const resync = async () => {
      const userId = userIdRef.current;
      if (!userId || !didInitialSyncRef.current) return;

      // 復帰直前のローカル変更がまだデバウンス待ちで未送信の場合、
      // 再取得で上書きして消してしまわないよう先に確定させて送っておく
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        await pushToRemote(userId);
      }

      await pullFromRemote(userId);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resync();
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", resync);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", resync);
    };
  }, [isSupabaseConfigured, pushToRemote, pullFromRemote]);

  return null;
}
