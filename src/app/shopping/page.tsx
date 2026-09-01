"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Check, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  getLocalShoppingItems,
  addLocalShoppingItem,
  deleteLocalShoppingItem,
  toggleLocalShoppingItem,
  ShoppingItem
} from "@/lib/storage";
import styles from "./Shopping.module.css";

const AISLE_ORDER = ['野菜・果物', '精肉', '鮮魚', '卵・乳製品', '穀物・豆腐', '調味料', 'その他'];

const AISLE_ICONS: Record<string, string> = {
  '野菜・果物': '🥦',
  '精肉': '🥩',
  '鮮魚': '🐟',
  '卵・乳製品': '🥚',
  '穀物・豆腐': '🌾',
  '調味料': '🧂',
  'その他': '🍽️',
};

// 食材名から売り場カテゴリを自動判定
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (/肉|豚|牛|鶏|ミンチ|ベーコン|ハム|ソーセージ|挽肉/.test(n)) return '精肉';
  if (/魚|鮭|サーモン|マグロ|エビ|イカ|タコ|貝|サバ|タラ|あさり|しらす/.test(n)) return '鮮魚';
  if (/卵|たまご|牛乳|チーズ|ヨーグルト|バター|生クリーム/.test(n)) return '卵・乳製品';
  if (/トマト|キャベツ|レタス|玉ねぎ|たまねぎ|人参|にんじん|大根|きゅうり|ナス|ピーマン|ネギ|ブロッコリー|じゃがいも|芋|りんご|バナナ|果物|みかん|レモン|ほうれん草|きのこ|しめじ|えのき|舞茸/.test(n)) return '野菜・果物';
  if (/米|パン|パスタ|うどん|そば|豆腐|納豆|油揚げ|大豆/.test(n)) return '穀物・豆腐';
  if (/醤油|しょうゆ|味噌|みそ|塩|砂糖|酢|油|だし|つゆ|マヨネーズ|ケチャップ|ドレッシング|コショウ|胡椒|みりん|酒|コンソメ/.test(n)) return '調味料';
  return 'その他';
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadItems();
    const handleUpdate = () => loadItems();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadItems = () => {
    setItems(getLocalShoppingItems());
    setLoading(false);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;

    const category = inferCategory(clean);
    addLocalShoppingItem(clean, category);
    setNewName("");
    loadItems();
  };

  const handleDelete = (id: number) => {
    deleteLocalShoppingItem(id);
    loadItems();
  };

  const handleComplete = (item: ShoppingItem, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    const targetEl = document.querySelector('[data-nav="在庫"]');
    if (!targetEl) {
      toggleLocalShoppingItem(item.id);
      loadItems();
      return;
    }
    const targetRect = targetEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    createFlyingEffect(item.name, startX, startY, endX, endY);
    toggleLocalShoppingItem(item.id);
    loadItems();
  };

  const createFlyingEffect = (name: string, startX: number, startY: number, endX: number, endY: number) => {
    const el = document.createElement("div");
    el.innerText = name;
    el.style.position = "fixed";
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.padding = "8px 16px";
    el.style.background = "var(--primary)";
    el.style.color = "white";
    el.style.borderRadius = "20px";
    el.style.fontSize = "14px";
    el.style.fontWeight = "bold";
    el.style.zIndex = "10000";
    el.style.pointerEvents = "none";
    el.style.boxShadow = "0 10px 25px rgba(255, 120, 73, 0.4)";
    document.body.appendChild(el);

    const controlX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - 150;

    animate(0, 1, {
      duration: 0.8,
      ease: [0.45, 0, 0.55, 1],
      onUpdate: (t) => {
        const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * controlX + t ** 2 * endX;
        const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * controlY + t ** 2 * endY;
        const scale = 1 - 0.5 * t;
        const opacity = 1 - 0.2 * t;
        el.style.transform = `translate(-50%, -50%) translate(${x - startX}px, ${y - startY}px) scale(${scale})`;
        el.style.opacity = opacity.toString();
      },
      onComplete: () => {
        el.remove();
      }
    });
  };

  // 売り場カテゴリ別にアイテムを自動グルーピング
  const groupedItems = AISLE_ORDER.reduce<Record<string, ShoppingItem[]>>((acc, aisle) => {
    const matched = items.filter(item => {
      const cat = item.category || inferCategory(item.name);
      return cat === aisle;
    });
    if (matched.length > 0) acc[aisle] = matched;
    return acc;
  }, {});

  // その他未分類
  const knownAisles = new Set(AISLE_ORDER);
  items.forEach(item => {
    const cat = item.category || inferCategory(item.name);
    if (!knownAisles.has(cat)) {
      if (!groupedItems['その他']) groupedItems['その他'] = [];
      groupedItems['その他'].push(item);
    }
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <h1 className={styles.title}>🛒 買い物リスト</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          type="text"
          placeholder="買うものを入力 (例: 鶏むね肉、玉ねぎ)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={adding}
        />
        <button type="submit" disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="spinner" size={20} /> : <Plus size={20} />}
          追加
        </button>
      </form>

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && (
        <>
          {Object.keys(groupedItems).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {AISLE_ORDER.map(aisle => {
                const aisleItems = groupedItems[aisle];
                if (!aisleItems || aisleItems.length === 0) return null;

                return (
                  <div key={aisle} style={{ background: '#ffffff', borderRadius: 16, padding: '12px 14px', border: '1px solid #f0f0f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#4b5563', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                      <span>{AISLE_ICONS[aisle] || '🍽️'}</span>
                      <span>{aisle} 売り場</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginLeft: 'auto' }}>{aisleItems.length}件</span>
                    </div>

                    <ul className={styles.list}>
                      <AnimatePresence mode="popLayout">
                        {aisleItems.map((item) => (
                          <motion.li
                            key={item.id}
                            className={styles.listItem}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            layout
                          >
                            <div className={styles.itemInfo}>
                              <div
                                className={styles.checkbox}
                                onClick={(e) => handleComplete(item, e)}
                                title="購入完了（冷蔵庫へ送る）"
                              >
                                <Check size={16} />
                              </div>
                              <span className={styles.itemName}>{item.name}</span>
                            </div>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(item.id)}
                              aria-label="削除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <ShoppingBag size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
              <p>買い物リストは空です</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
