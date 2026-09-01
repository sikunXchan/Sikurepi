"use client";

import { useEffect, useState } from "react";
import { Plus, Pin, Trash2, Settings, Network, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ChefProfileBadge from "@/components/ChefProfileBadge";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import InventoryMindMap from "@/components/InventoryMindMap";
import {
  getLocalIngredients,
  addLocalIngredient,
  deleteLocalIngredient,
  toggleLocalIngredientPin,
  Ingredient
} from "@/lib/storage";
import styles from "./Home.module.css";

const CATEGORY_ICONS: Record<string, string> = {
  '野菜': '🥦',
  '肉': '🥩',
  '魚介類': '🐟',
  '乳製品・卵': '🥚',
  '穀物・パン': '🌾',
  '調味料': '🧂',
  '果物': '🍎',
  '豆類': '🫘',
  'その他': '🍽️',
};

const CATEGORY_ORDER = ['野菜', '肉', '魚介類', '乳製品・卵', '穀物・パン', '豆類', '果物', '調味料', 'その他'];

export default function Home() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("その他");
  const [viewMode, setViewMode] = useState<'mindmap' | 'list'>('mindmap');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadIngredients();
    const handleUpdate = () => loadIngredients();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadIngredients = () => {
    setIngredients(getLocalIngredients());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (ingredients.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast("⚠️ その食材はすでに冷蔵庫にあります");
      return;
    }

    addLocalIngredient(cleanName, selectedCategory);
    setNewName("");
    loadIngredients();
    showToast(`✨ 「${cleanName}」を冷蔵庫に追加しました！`);
  };

  const handleDelete = (id: number, name: string) => {
    deleteLocalIngredient(id);
    loadIngredients();
    showToast(`🗑️ 「${name}」を削除しました`);
  };

  const handleTogglePin = (item: Ingredient) => {
    const pinState = !item.is_pinned;
    if (pinState) {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        shapes: ['star'],
        colors: ['#ff758f', '#ffb703', '#ff5c8a'],
      });
    }
    toggleLocalIngredientPin(item.id);
    loadIngredients();
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const grouped = CATEGORY_ORDER.reduce<Record<string, Ingredient[]>>((acc, cat) => {
    const items = ingredients.filter(i => (i.category || 'その他') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

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

      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className={styles.title} style={{ margin: 0, fontSize: 22, color: '#ff5c8a', fontWeight: 900 }}>
          ❄️ 冷蔵庫の在庫
        </h1>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: '2px solid #ffd1dc',
            borderRadius: 9999,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 800,
            color: '#8c3b58',
            boxShadow: '0 2px 8px rgba(255, 92, 138, 0.1)',
            cursor: 'pointer',
          }}
        >
          <Settings size={14} color="#ff5c8a" />
          <span>マイ設定・統計</span>
        </button>
      </div>

      <ChefProfileBadge />

      {/* 食材追加フォーム */}
      <div className="card" style={{ padding: 14 }}>
        <form onSubmit={handleAdd} className={styles.addFormWrapper}>
          <div className={styles.addForm}>
            <input
              type="text"
              placeholder="食材名を入力 (例: トマト、豚バラ肉)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" disabled={!newName.trim()}>
              <Plus size={18} />
              追加
            </button>
          </div>
          <div className={styles.categorySelectRow}>
            <label className={styles.categorySelectLabel}>カテゴリ:</label>
            <select
              className={styles.categorySelect}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* 表示切替ピルタブ (マインドマップ ⇄ リスト) */}
      <div style={{
        display: 'flex',
        background: '#ffffff',
        border: '2px solid #ffd1dc',
        borderRadius: 9999,
        padding: 4,
        gap: 4,
        marginBottom: 12,
      }}>
        <button
          type="button"
          onClick={() => setViewMode('mindmap')}
          style={{
            flex: 1,
            background: viewMode === 'mindmap' ? 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)' : 'transparent',
            color: viewMode === 'mindmap' ? 'white' : '#8c3b58',
            border: 'none',
            borderRadius: 9999,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 800,
            boxShadow: viewMode === 'mindmap' ? '0 3px 10px rgba(255, 92, 138, 0.35)' : 'none',
            cursor: 'pointer',
          }}
        >
          <Network size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          マインドマップ表示
        </button>
        <button
          type="button"
          onClick={() => setViewMode('list')}
          style={{
            flex: 1,
            background: viewMode === 'list' ? 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)' : 'transparent',
            color: viewMode === 'list' ? 'white' : '#8c3b58',
            border: 'none',
            borderRadius: 9999,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 800,
            boxShadow: viewMode === 'list' ? '0 3px 10px rgba(255, 92, 138, 0.35)' : 'none',
            cursor: 'pointer',
          }}
        >
          <List size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          リスト表示
        </button>
      </div>

      {/* マインドマップ表示 */}
      {viewMode === 'mindmap' && (
        <InventoryMindMap
          ingredients={ingredients}
          onUpdated={loadIngredients}
          onShowToast={showToast}
        />
      )}

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className={styles.categoryGroups}>
          {Object.entries(grouped).map(([category, items]) => {
            const isCollapsed = collapsedCategories.has(category);
            const icon = CATEGORY_ICONS[category] || '🍽️';
            return (
              <div key={category} className={styles.categoryGroup}>
                <button
                  className={styles.categoryHeader}
                  onClick={() => toggleCategory(category)}
                >
                  <span className={styles.categoryTitle}>
                    <span>{icon}</span>
                    <span>{category}</span>
                    <span className={styles.categoryCount}>{items.length}</span>
                  </span>
                  <span className={styles.categoryChevron}>{isCollapsed ? '›' : '⌄'}</span>
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.ul
                      className={styles.list}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className={`${styles.listItem} ${item.is_pinned ? styles.pinned : ""}`}
                        >
                          <div className={styles.nameSection}>
                            {item.is_pinned && <Pin size={14} fill="#ff477e" color="#ff477e" style={{ marginRight: 6 }} />}
                            <span>{item.name}</span>
                          </div>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={`${styles.pinBtn} ${item.is_pinned ? styles.pinActive : ""}`}
                              onClick={() => handleTogglePin(item)}
                              title="ピン留め"
                            >
                              <Pin size={16} />
                            </button>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(item.id, item.name)}
                              title="削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {ingredients.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#a07888" }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>冷蔵庫に食材がありません。上のフォームから追加してください 🐾</p>
        </div>
      )}
    </div>
  );
}
