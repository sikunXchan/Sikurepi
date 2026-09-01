"use client";

import { Pin, Trash2, ShoppingBag } from "lucide-react";
import { Ingredient, toggleLocalIngredientPin, deleteLocalIngredient, addLocalShoppingItem } from "@/lib/storage";
import styles from "./InventoryMindMap.module.css";

type Props = {
  ingredients: Ingredient[];
  onUpdated: () => void;
  onShowToast: (msg: string) => void;
};

const CATEGORY_ORDER = ['野菜', '肉', '魚介類', '乳製品・卵', '穀物・パン', '豆類', '果物', '調味料', 'その他'];

const CATEGORY_ICONS: Record<string, string> = {
  '野菜': '🥦',
  '肉': '🥩',
  '魚介類': '🐟',
  '乳製品・卵': '🥚',
  '穀物・パン': '🌾',
  '豆類': '🫘',
  '果物': '🍎',
  '調味料': '🧂',
  'その他': '🍽️',
};

export default function InventoryMindMap({ ingredients, onUpdated, onShowToast }: Props) {
  // カテゴリごとにグルーピング
  const grouped = CATEGORY_ORDER.reduce<Record<string, Ingredient[]>>((acc, cat) => {
    const items = ingredients.filter(i => (i.category || 'その他') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // 未分類のアイテムを拾う
  const knownCats = new Set(CATEGORY_ORDER);
  const others = ingredients.filter(i => !knownCats.has(i.category || 'その他'));
  if (others.length > 0) {
    grouped['その他'] = [...(grouped['その他'] || []), ...others];
  }

  const handlePin = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    toggleLocalIngredientPin(id);
    onUpdated();
  };

  const handleDelete = (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    deleteLocalIngredient(id);
    onUpdated();
    onShowToast(`🗑️ 「${name}」を削除しました`);
  };

  const handleToShopping = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    addLocalShoppingItem(name);
    onShowToast(`🛒 「${name}」を買い物リストに追加しました！`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.mapWrapper}>
        {/* 中心ノード */}
        <div className={styles.centerRoot}>
          <span>❄️ 冷蔵庫マインドマップ</span>
          <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 9999 }}>
            計 {ingredients.length} 品
          </span>
        </div>

        {/* カテゴリブランチと食材ノード */}
        <div className={styles.branchGrid}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className={styles.branchCard}>
              <div className={styles.branchHeader}>
                <span>{CATEGORY_ICONS[category] || '🍽️'} {category}</span>
                <span className={styles.branchCount}>{items.length}</span>
              </div>

              <div className={styles.leafList}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.leafNode} ${item.is_pinned ? styles.pinned : ""}`}
                    onClick={(e) => handleToShopping(e, item.name)}
                    title="タップして買い物リストに追加、📌で固定、✕で削除"
                  >
                    <button
                      type="button"
                      onClick={(e) => handlePin(e, item.id)}
                      style={{ background: 'none', border: 'none', padding: 0, boxShadow: 'none', cursor: 'pointer' }}
                      title="優先食材にピン留め"
                    >
                      <Pin
                        size={12}
                        fill={item.is_pinned ? "#ff477e" : "none"}
                        color={item.is_pinned ? "#ff477e" : "#c9a7b5"}
                      />
                    </button>
                    <span>{item.name}</span>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={(e) => handleDelete(e, item.id, item.name)}
                      title="削除"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}