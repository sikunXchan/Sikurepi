"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Check, ShoppingBag } from "lucide-react";
import confetti from "canvas-confetti";
import {
  getLocalShoppingItems,
  addLocalShoppingItem,
  deleteLocalShoppingItem,
  toggleLocalShoppingItem,
  ShoppingItem
} from "@/lib/storage";
import styles from "./Shopping.module.css";

const AISLE_ICONS: Record<string, string> = {
  '野菜・果物': '🥦',
  '精肉': '🥩',
  '鮮魚': '🐟',
  '卵・乳製品': '🥚',
  '穀物・豆腐': '🌾',
  '調味料': '🧂',
  'その他': '🍽️',
};

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
    const handleUpdate = () => loadItems();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadItems = () => {
    setItems(getLocalShoppingItems());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;

    const category = inferCategory(clean);
    addLocalShoppingItem(clean, category);
    setNewName("");
    loadItems();
    showToast(`🛒 「${clean}」を追加しました！`);
  };

  const handleDelete = (id: number, name: string) => {
    deleteLocalShoppingItem(id);
    loadItems();
    showToast(`🗑️ 「${name}」を削除しました`);
  };

  const handleCheck = (item: ShoppingItem) => {
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#ff758f', '#52b788', '#ffb703'],
    });
    toggleLocalShoppingItem(item.id);
    loadItems();
    showToast(`🎉 「${item.name}」を購入し、冷蔵庫に追加しました！`);
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(74, 40, 53, 0.95)',
          color: 'white',
          padding: '8px 18px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(255, 92, 138, 0.3)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <h1 className={styles.title}>🛒 買い物リスト</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          type="text"
          placeholder="買うものを入力 (例: 牛乳、人参、卵)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={!newName.trim()}>
          <Plus size={18} />
          追加
        </button>
      </form>

      {/* メモ帳風カード */}
      <div className={styles.noteCard}>
        <div className={styles.noteHeader}>
          <span>🐾 買うものメモ ({items.length}品)</span>
          <span style={{ fontSize: 11, color: '#a07888' }}>チェックで冷蔵庫へ移動</span>
        </div>

        {items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <div className={styles.itemInfo}>
                  <div
                    className={styles.checkbox}
                    onClick={() => handleCheck(item)}
                    title="購入完了（冷蔵庫へ追加）"
                  >
                    <Check size={14} color="#ff5c8a" />
                  </div>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemCategory}>
                    {AISLE_ICONS[item.category] || '🍽️'} {item.category}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(item.id, item.name)}
                  title="削除"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <ShoppingBag size={36} style={{ opacity: 0.3, marginBottom: 6 }} />
            <p style={{ fontSize: 13, fontWeight: 700 }}>買い物リストは空です</p>
          </div>
        )}
      </div>
    </div>
  );
}
