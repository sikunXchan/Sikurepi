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
// - モデルの読み込み/推論に失敗しても(オフライン、ネットワーク制限、非対応ブラウザ等)、
//   例外を投げずnullを返すだけにし、呼び出し側は必ず静的判定のフォールバック結果のまま使える
// - このファイルはクライアント専用(ブラウザのIndexedDB/WASM前提)。サーバー側からは使わない。

import { CATEGORY_RULES, PANTRY_STAPLES } from "./storage";
import { ICON_ANCHOR_LIST } from "./ingredientIcons";

export type EmbeddingStatus = "idle" | "loading-model" | "preparing-anchors" | "ready" | "unavailable";

export type IngredientSemanticMatch = {
  category: string | null;
  categoryScore: number;
  iconSlug: string | null;
  iconScore: number;
  isStaple: boolean;
  stapleScore: number;
};

type AnchorEntry = {
  phrase: string;
  category?: string;
  iconSlug?: string;
  isStaple?: boolean;
};

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";
const CACHE_KEY = "lily_app_embedding_anchor_cache_v1";
// 類似度のしきい値。EmbeddingGemmaの正規化済み埋め込み同士のコサイン類似度を想定した
// 保守的な初期値で、実機での検証結果を踏まえて調整が必要になる可能性がある。
const SIMILARITY_THRESHOLD = 0.6;

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

// --- 正規表現アンカーの抽出 ---
// CATEGORY_RULES の各パターンは否定先読み/後読み((?!...)/(?<!...))を含むが、これは
// 「キャッサバ」が「サバ」に誤爆する等、文字列部分一致特有の衝突を避けるための
// regex専用の仕組みであり、意味マッチングでは不要なため取り除いてから「|」で分割する。
function extractPhrasesFromPattern(pattern: RegExp): string[] {
  const src = pattern.source.replace(/\(\?<?!.*?\)/g, "");
  return src.split("|").map((s) => s.trim()).filter(Boolean);
}

let anchorDefsCache: AnchorEntry[] | null = null;
function buildAnchorDefs(): AnchorEntry[] {
  if (anchorDefsCache) return anchorDefsCache;
  const byPhrase = new Map<string, AnchorEntry>();
  const upsert = (phrase: string, patch: Partial<AnchorEntry>) => {
    if (!phrase) return;
    const existing = byPhrase.get(phrase) || { phrase };
    byPhrase.set(phrase, { ...existing, ...patch });
  };
  for (const { keyword, slug } of ICON_ANCHOR_LIST) upsert(keyword, { iconSlug: slug });
  for (const rule of CATEGORY_RULES) {
    for (const phrase of extractPhrasesFromPattern(rule.pattern)) upsert(phrase, { category: rule.category });
  }
  for (const staple of PANTRY_STAPLES) upsert(staple, { isStaple: true });
  anchorDefsCache = Array.from(byPhrase.values());
  return anchorDefsCache;
}

// アンカー一覧が変わったら(コード更新でキーワードを追加/削除したら)古いキャッシュを
// 自動的に無効化するための簡易フィンガープリント。
function anchorFingerprint(defs: AnchorEntry[]): string {
  return `${defs.length}:${defs.map((d) => d.phrase).join(",").length}`;
}

// --- Float32配列 <-> base64 (localStorageに埋め込みベクトルをコンパクトに保存するため) ---
function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // 埋め込みは正規化済み(normalize: true)なのでdot積 = コサイン類似度
}

// --- モデルのロード(初回のみ・遅延実行) ---
type Extractor = (text: string | string[], options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array | number[]; dims?: number[] }>;

let extractorPromise: Promise<Extractor | null> | null = null;

async function getExtractor(): Promise<Extractor | null> {
  if (extractorPromise) return extractorPromise;
  extractorPromise = (async () => {
    try {
      setStatus("loading-model");
      const { pipeline } = await import("@huggingface/transformers");
      const extractor = (await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" })) as unknown as Extractor;
      return extractor;
    } catch (err) {
      // オフライン・通信制限・非対応ブラウザ等、理由を問わず読み込みに失敗したら
      // 以降はずっと「利用不可」として静的判定のみにフォールバックする
      console.warn("EmbeddingGemma model unavailable, falling back to static rules only:", err);
      setStatus("unavailable");
      return null;
    }
  })();
  return extractorPromise;
}

async function embedOne(extractor: Extractor, text: string): Promise<Float32Array> {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
}

// --- アンカー埋め込みの準備(初回のみ計算し、以降はlocalStorageから復元) ---
type PreparedAnchor = AnchorEntry & { vec: Float32Array };

let anchorsPromise: Promise<PreparedAnchor[] | null> | null = null;

async function getPreparedAnchors(extractor: Extractor): Promise<PreparedAnchor[] | null> {
  if (anchorsPromise) return anchorsPromise;
  anchorsPromise = (async () => {
    const defs = buildAnchorDefs();
    const fingerprint = anchorFingerprint(defs);

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { fingerprint: string; entries: (AnchorEntry & { vec: string })[] };
        if (parsed.fingerprint === fingerprint && Array.isArray(parsed.entries) && parsed.entries.length === defs.length) {
          return parsed.entries.map((e) => ({ ...e, vec: base64ToFloat32(e.vec) }));
        }
      }
    } catch {
      // キャッシュが壊れている場合は無視して作り直す
    }

    setStatus("preparing-anchors");
    try {
      // 1件ずつではなくまとめて1回のバッチ推論にすることで、WASM境界を跨ぐ
      // オーバーヘッドを大きく減らす(数百件を1件ずつ呼ぶと非常に遅くなるため)。
      const output = await extractor(defs.map((d) => d.phrase), { pooling: "mean", normalize: true });
      const dims = output.dims;
      const flat = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
      const dim = dims && dims.length > 1 ? dims[dims.length - 1] : flat.length / defs.length;
      const prepared: PreparedAnchor[] = defs.map((d, i) => ({
        ...d,
        vec: flat.slice(i * dim, (i + 1) * dim),
      }));

      try {
        const serializable = {
          fingerprint,
          entries: prepared.map((p) => ({ phrase: p.phrase, category: p.category, iconSlug: p.iconSlug, isStaple: p.isStaple, vec: float32ToBase64(p.vec) })),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
      } catch (e) {
        // 保存容量オーバー等は致命的ではない(次回また計算し直すだけ)ので握りつぶす
        console.warn("Failed to cache anchor embeddings:", e);
      }

      return prepared;
    } catch (err) {
      console.warn("Failed to prepare anchor embeddings:", err);
      setStatus("unavailable");
      return null;
    }
  })();
  return anchorsPromise;
}

// --- 公開API: 食材名をオフライン意味マッチングでカテゴリ/アイコン/常備判定する ---
export async function matchIngredientSemantic(name: string): Promise<IngredientSemanticMatch | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const extractor = await getExtractor();
  if (!extractor) return null;

  const anchors = await getPreparedAnchors(extractor);
  if (!anchors || anchors.length === 0) return null;

  setStatus("ready");
  const queryVec = await embedOne(extractor, trimmed);

  let bestCategory: { score: number; value: string } | null = null;
  let bestIcon: { score: number; value: string } | null = null;
  let bestStaple: number = -1;

  for (const anchor of anchors) {
    const score = cosineSim(queryVec, anchor.vec);
    if (anchor.category && (!bestCategory || score > bestCategory.score)) {
      bestCategory = { score, value: anchor.category };
    }
    if (anchor.iconSlug && (!bestIcon || score > bestIcon.score)) {
      bestIcon = { score, value: anchor.iconSlug };
    }
    if (anchor.isStaple && score > bestStaple) {
      bestStaple = score;
    }
  }

  return {
    category: bestCategory && bestCategory.score >= SIMILARITY_THRESHOLD ? bestCategory.value : null,
    categoryScore: bestCategory?.score ?? 0,
    iconSlug: bestIcon && bestIcon.score >= SIMILARITY_THRESHOLD ? bestIcon.value : null,
    iconScore: bestIcon?.score ?? 0,
    isStaple: bestStaple >= SIMILARITY_THRESHOLD,
    stapleScore: bestStaple,
  };
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
