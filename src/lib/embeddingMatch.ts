"use client";

// オフライン食材名マッチング(EmbeddingGemma + Transformers.js)
//
// CATEGORY_RULES / ICON_KEYWORDS / PANTRY_STAPLES は日本語キーワードの正規表現・
// 文字列一致のみで判定しているため、英語などそれ以外の言語で食材名を入力すると
// 一切マッチしない(必ず「その他」・プレースホルダーアイコン・常備調味料扱い外になる)。
// この静的判定が外れた場合にだけ、ブラウザ上で完全オフライン動作する多言語埋め込み
// モデル(EmbeddingGemma)を使い、意味的に最も近い日本語キーワードを探して代用する。
//
// 設計方針:
// - 静的キーワード判定を常に一次判定として残す(日本語入力は今まで通り無料・瞬時)
// - モデル・埋め込みの読み込みは初回に必要になった時だけ行う(アプリ起動時には一切ロードしない)
// - モデルのロード・数百件のアンカー埋め込み計算はメインスレッドを長時間ブロックする
//   重い処理のため、専用のWeb Worker(embeddingWorker.ts)上で実行する。このファイルは
//   その薄いRPCクライアントで、状態(同意/ステータス/進捗)の管理だけをメインスレッド側で行う
// - モデルの読み込み/推論に失敗しても(オフライン、ネットワーク制限、非対応ブラウザ等)、
//   例外を投げずnullを返すだけにし、呼び出し側は必ず静的判定のフォールバック結果のまま使える
// - このファイルはクライアント専用(ブラウザのWorker/IndexedDB前提)。サーバー側からは使わない。

export type EmbeddingStatus = "idle" | "loading-model" | "preparing-anchors" | "ready" | "unavailable";

export type IngredientSemanticMatch = {
  category: string | null;
  categoryScore: number;
  iconSlug: string | null;
  iconScore: number;
  isStaple: boolean;
  stapleScore: number;
};

let status: EmbeddingStatus = "idle";
const statusListeners = new Set<(s: EmbeddingStatus) => void>();

function setStatus(next: EmbeddingStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(status));
}

export function getEmbeddingStatus(): EmbeddingStatus {
  return status;
}

export function subscribeEmbeddingStatus(fn: (s: EmbeddingStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

// --- ダウンロード進捗(0-100)。Workerから届くファイル単位の集計済みパーセントをそのまま転送する ---
let lastReportedProgress = 0;
const progressListeners = new Set<(pct: number) => void>();

export function subscribeDownloadProgress(fn: (pct: number) => void): () => void {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

export function getDownloadProgress(): number {
  return lastReportedProgress;
}

// --- ユーザーの同意(初回の大容量ダウンロードは明示的な許可を取ってから行う) ---
const CONSENT_KEY = "lily_app_ai_match_consent";
let consentAccepted = false;
let consentDeclinedThisSession = false;
let consentPromptPending = false;
let pendingConsentResolvers: Array<(accepted: boolean) => void> = [];
const consentRequestListeners = new Set<() => void>();

function hasStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function isConsentPromptPending(): boolean {
  return consentPromptPending;
}

export function subscribeConsentRequest(fn: () => void): () => void {
  consentRequestListeners.add(fn);
  return () => consentRequestListeners.delete(fn);
}

// ユーザーがダイアログで「ダウンロードして有効にする」を選んだ時に呼ぶ。
// 一度承諾すれば、以降のセッションでもlocalStorageを見て二度と聞かない。
export function acceptAIMatching(): void {
  consentAccepted = true;
  consentPromptPending = false;
  try {
    localStorage.setItem(CONSENT_KEY, "accepted");
  } catch {
    // 保存に失敗しても、このタブ内では承諾済み扱いのまま進める
  }
  const resolvers = pendingConsentResolvers;
  pendingConsentResolvers = [];
  resolvers.forEach((r) => r(true));
}

// ユーザーがダイアログで「今回はスキップ」を選んだ時に呼ぶ。
// このタブ/セッション内では再度聞かない(次回アプリを開いた時にはまた確認する)。
export function declineAIMatching(): void {
  consentDeclinedThisSession = true;
  consentPromptPending = false;
  const resolvers = pendingConsentResolvers;
  pendingConsentResolvers = [];
  resolvers.forEach((r) => r(false));
}

async function ensureConsent(): Promise<boolean> {
  if (consentAccepted || hasStoredConsent()) {
    consentAccepted = true;
    return true;
  }
  if (consentDeclinedThisSession) return false;

  return new Promise<boolean>((resolve) => {
    pendingConsentResolvers.push(resolve);
    if (!consentPromptPending) {
      consentPromptPending = true;
      consentRequestListeners.forEach((fn) => fn());
    }
  });
}

// --- Worker RPCクライアント ---
// モデルのロード・アンカー埋め込み計算・個々の推論は全てWorker側(embeddingWorker.ts)で
// 行い、メインスレッドはpostMessageでリクエストを送って結果を待つだけにする。
// これによりモデルのダウンロード・推論中もUIスレッドは一切ブロックされない。
let worker: Worker | null = null;
let matchRequestSeq = 0;
const pendingMatchRequests = new Map<number, (result: IngredientSemanticMatch | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./embeddingWorker.ts", import.meta.url));
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "status") {
      setStatus(msg.status as EmbeddingStatus);
    } else if (msg.type === "progress") {
      lastReportedProgress = msg.pct;
      progressListeners.forEach((fn) => fn(lastReportedProgress));
    } else if (msg.type === "match-result") {
      const resolve = pendingMatchRequests.get(msg.id);
      if (resolve) {
        pendingMatchRequests.delete(msg.id);
        resolve(msg.result as IngredientSemanticMatch | null);
      }
    }
  };
  worker.onerror = (err) => {
    console.warn("EmbeddingGemma worker error, falling back to static rules only:", err);
    setStatus("unavailable");
    // 応答が二度と来ないので、待機中のリクエストは全てnullで解決してリークさせない
    pendingMatchRequests.forEach((resolve) => resolve(null));
    pendingMatchRequests.clear();
  };
  return worker;
}

// --- 公開API: 食材名をオフライン意味マッチングでカテゴリ/アイコン/常備判定する ---
export async function matchIngredientSemantic(name: string): Promise<IngredientSemanticMatch | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 数百MB規模のダウンロードになるため、明示的な同意が取れるまではWorkerの起動・
  // モデルの取得を一切開始しない(同意ダイアログが表示され、ユーザーの応答を待つ)。
  const consented = await ensureConsent();
  if (!consented) {
    setStatus("idle");
    return null;
  }

  return new Promise((resolve) => {
    const id = ++matchRequestSeq;
    pendingMatchRequests.set(id, resolve);
    try {
      getWorker().postMessage({ type: "match", id, name: trimmed });
    } catch (err) {
      console.warn("Failed to reach embedding worker:", err);
      pendingMatchRequests.delete(id);
      setStatus("unavailable");
      resolve(null);
    }
  });
}

// --- アイコン専用の軽量ラッパー: IngredientIcon.tsx から呼び出す ---
// 同じ食材名について何度も推論を繰り返さないよう、解決済み結果をメモリ内キャッシュし、
// 未解決の間は他の呼び出し元にも「解決中」であることを共有する(多重リクエスト防止)。
const resolvedIconCache = new Map<string, string | null>();
const iconInFlight = new Map<string, Promise<string | null>>();
const iconListeners = new Set<() => void>();

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function getResolvedIconSlug(name: string): string | null | undefined {
  return resolvedIconCache.get(normalizeName(name));
}

export function subscribeIconResolved(fn: () => void): () => void {
  iconListeners.add(fn);
  return () => iconListeners.delete(fn);
}

// fire-and-forget: 呼び出し側はPromiseを待たず、後からsubscribeIconResolvedの通知を
// 受けて再レンダリングする想定(在庫追加のUIを一切ブロックしないため)。
export function requestIconMatch(name: string): void {
  const key = normalizeName(name);
  if (!key || resolvedIconCache.has(key) || iconInFlight.has(key)) return;

  const task = matchIngredientSemantic(name)
    .then((result) => {
      resolvedIconCache.set(key, result?.iconSlug ?? null);
      iconInFlight.delete(key);
      iconListeners.forEach((fn) => fn());
      return result?.iconSlug ?? null;
    })
    .catch(() => {
      resolvedIconCache.set(key, null);
      iconInFlight.delete(key);
      return null;
    });
  iconInFlight.set(key, task);
}
