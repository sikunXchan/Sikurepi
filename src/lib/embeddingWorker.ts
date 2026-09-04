// EmbeddingGemmaのロード・推論を専用のWeb Worker上で実行するワーカー本体。
//
// メインスレッド(UIスレッド)で直接pipeline()を呼ぶと、モデルのダウンロード解凍や
// 数百件のアンカー埋め込み計算(WASM上でのCPU推論)がUIを長時間ブロックし、
// スクロールや入力操作がガクつく(実機で確認された不具合)。この処理をWorkerに
// 完全に切り離すことで、重い処理中もメインスレッドは自由に動き続けられる。
//
// Workerコンテキストではwindow/document/localStorageに一切アクセスできないため、
// アンカー埋め込みのキャッシュにはWorkerからも使えるIndexedDBを使う。

// TS標準のdom libとwebworker libは同じグローバル(self等)を競合宣言するため、
// tsconfigを変更せずにこのファイル単体でWorker向けの型を素通しする。
declare const self: any;

import { CATEGORY_RULES, PANTRY_STAPLES } from "./storage";
import { ICON_ANCHOR_LIST } from "./ingredientIcons";

type AnchorEntry = { phrase: string; category?: string; iconSlug?: string; isStaple?: boolean };
type PreparedAnchor = AnchorEntry & { vec: Float32Array };

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";
const DB_NAME = "lily_embedding_cache";
const STORE_NAME = "anchors";
const CACHE_RECORD_KEY = "v1";
const SIMILARITY_THRESHOLD = 0.6;

// CATEGORY_RULES の各パターンは否定先読み/後読みを含むが、これは文字列部分一致
// 特有の衝突を避けるためのregex専用の仕組みであり、意味マッチングでは不要なため
// 取り除いてから「|」で分割する(embeddingMatch.ts旧実装と同じロジック)。
function extractPhrasesFromPattern(pattern: RegExp): string[] {
  const src = pattern.source.replace(/\(\?<?!.*?\)/g, "");
  return src.split("|").map((s: string) => s.trim()).filter(Boolean);
}

function buildAnchorDefs(): AnchorEntry[] {
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
  return Array.from(byPhrase.values());
}

function anchorFingerprint(defs: AnchorEntry[]): string {
  return `${defs.length}:${defs.map((d) => d.phrase).join(",").length}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCachedAnchors(fingerprint: string): Promise<PreparedAnchor[] | null> {
  try {
    const db = await openDb();
    const record: any = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(CACHE_RECORD_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (record && record.fingerprint === fingerprint && Array.isArray(record.entries)) {
      return record.entries.map((e: any) => ({ ...e, vec: new Float32Array(e.vec) }));
    }
  } catch {
    // キャッシュが読めなければ作り直す(致命的ではない)
  }
  return null;
}

async function saveCachedAnchors(fingerprint: string, anchors: PreparedAnchor[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(
        {
          fingerprint,
          entries: anchors.map((a) => ({ phrase: a.phrase, category: a.category, iconSlug: a.iconSlug, isStaple: a.isStaple, vec: a.vec.buffer })),
        },
        CACHE_RECORD_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 保存失敗は致命的ではない(次回また計算し直すだけ)
  }
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // 埋め込みは正規化済みなのでdot積 = コサイン類似度
}

type Extractor = (text: string | string[], options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array | number[]; dims?: number[] }>;

let extractor: Extractor | null = null;
let anchors: PreparedAnchor[] | null = null;
let readyPromise: Promise<boolean> | null = null;
const fileProgress = new Map<string, { loaded: number; total: number }>();

function postStatus(status: string) {
  self.postMessage({ type: "status", status });
}

function postProgress(pct: number) {
  self.postMessage({ type: "progress", pct });
}

function handleProgressEvent(data: unknown) {
  try {
    const e = data as { status?: string; file?: string; loaded?: number; total?: number };
    if (!e || typeof e !== "object") return;
    if (e.status === "progress" && e.file && typeof e.loaded === "number" && typeof e.total === "number" && e.total > 0) {
      fileProgress.set(e.file, { loaded: e.loaded, total: e.total });
    } else if (e.status === "done" && e.file) {
      const existing = fileProgress.get(e.file);
      if (existing) fileProgress.set(e.file, { loaded: existing.total, total: existing.total });
    } else {
      return;
    }
    let loaded = 0;
    let total = 0;
    for (const f of fileProgress.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    if (total > 0) postProgress(Math.min(100, Math.round((loaded / total) * 100)));
  } catch {
    // 進捗表示は付加価値であり、失敗しても本体機能に影響させない
  }
}

async function ensureReady(): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      postStatus("loading-model");
      fileProgress.clear();
      const { pipeline } = await import("@huggingface/transformers");
      extractor = (await pipeline("feature-extraction", MODEL_ID, {
        dtype: "q8",
        progress_callback: handleProgressEvent,
      })) as unknown as Extractor;

      const defs = buildAnchorDefs();
      const fingerprint = anchorFingerprint(defs);
      const cached = await loadCachedAnchors(fingerprint);
      if (cached && cached.length === defs.length) {
        anchors = cached;
      } else {
        postStatus("preparing-anchors");
        // 1件ずつではなくまとめて1回のバッチ推論にすることで、WASM境界を跨ぐ
        // オーバーヘッドを大きく減らす。
        const output = await extractor(defs.map((d) => d.phrase), { pooling: "mean", normalize: true });
        const flat = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
        const dims = output.dims;
        const dim = dims && dims.length > 1 ? dims[dims.length - 1] : flat.length / defs.length;
        anchors = defs.map((d, i) => ({ ...d, vec: flat.slice(i * dim, (i + 1) * dim) }));
        await saveCachedAnchors(fingerprint, anchors);
      }

      postStatus("ready");
      return true;
    } catch (err) {
      // オフライン・通信制限・非対応ブラウザ等、理由を問わず読み込みに失敗したら
      // 以降はずっと「利用不可」として静的判定のみにフォールバックする
      console.warn("EmbeddingGemma worker: model unavailable, falling back to static rules only:", err);
      postStatus("unavailable");
      return false;
    }
  })();
  return readyPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "start") {
    await ensureReady();
    return;
  }

  if (msg.type === "match") {
    const { id, name } = msg;
    const ok = await ensureReady();
    if (!ok || !extractor || !anchors) {
      self.postMessage({ type: "match-result", id, result: null });
      return;
    }

    const output = await extractor(name, { pooling: "mean", normalize: true });
    const queryVec = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);

    let bestCategory: { score: number; value: string } | null = null;
    let bestIcon: { score: number; value: string } | null = null;
    let bestStaple = -1;
    for (const anchor of anchors) {
      const score = cosineSim(queryVec, anchor.vec);
      if (anchor.category && (!bestCategory || score > bestCategory.score)) bestCategory = { score, value: anchor.category };
      if (anchor.iconSlug && (!bestIcon || score > bestIcon.score)) bestIcon = { score, value: anchor.iconSlug };
      if (anchor.isStaple && score > bestStaple) bestStaple = score;
    }

    self.postMessage({
      type: "match-result",
      id,
      result: {
        category: bestCategory && bestCategory.score >= SIMILARITY_THRESHOLD ? bestCategory.value : null,
        categoryScore: bestCategory?.score ?? 0,
        iconSlug: bestIcon && bestIcon.score >= SIMILARITY_THRESHOLD ? bestIcon.value : null,
        iconScore: bestIcon?.score ?? 0,
        isStaple: bestStaple >= SIMILARITY_THRESHOLD,
        stapleScore: bestStaple,
      },
    });
  }
};

export {};
