"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Loader2, ShoppingBag, Pin, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ChefProfileBadge from "@/components/ChefProfileBadge";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import {
  getLocalIngredients,
  addLocalIngredient,
  deleteLocalIngredient,
  toggleLocalIngredientPin,
  updateLocalIngredientCategory,
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
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadIngredients();
    const handleUpdate = () => loadIngredients();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadIngredients = () => {
    setIngredients(getLocalIngredients());
    setLoading(false);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (ingredients.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
      alert("その食材はすでに在庫にあります。");
      return;
    }

    addLocalIngredient(cleanName, selectedCategory);
    setNewName("");
    loadIngredients();
  };

  const handleDelete = (id: number) => {
    deleteLocalIngredient(id);
    loadIngredients();
  };

  const handleTogglePin = (item: Ingredient) => {
    const pinState = !item.is_pinned;
    if (pinState) {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        shapes: ['star'],
        colors: ['#FFD700', '#FFA500', '#FF7849'],
      });
    }
    toggleLocalIngredientPin(item.id);
    loadIngredients();
  };

  const handleChangeCategory = (item: Ingredient, newCategory: string) => {
    setEditingCategoryId(null);
    if (newCategory === item.category) return;
    updateLocalIngredientCategory(item.id, newCategory);
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

  // Group ingredients by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Ingredient[]>>((acc, cat) => {
    const items = ingredients.filter(i => (i.category || 'その他') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const knownCategories = new Set(CATEGORY_ORDER);
  ingredients.forEach(i => {
    const cat = i.category || 'その他';
    if (!knownCategories.has(cat)) {
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(i);
    }
  });

  const hasIngredients = ingredients.length > 0;

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>🧊 冷蔵庫の在庫</h1>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#4b5563',
            cursor: 'pointer',
          }}
        >
          <Settings size={15} color="#ff7849" />
          <span>マイ設定・保存</span>
        </button>
      </div>

      <ChefProfileBadge />

      <form onSubmit={handleAdd} className={styles.addFormWrapper}>
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="新しい食材を追加 (例: トマト)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={!newName.trim()}>
            <Plus size={20} />
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

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && hasIngredients && (
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
                      <AnimatePresence initial={false}>
                        {items.map((item) => (
                          <motion.li
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                              opacity: { duration: 0.2 }
                            }}
                            className={`${styles.listItem} ${item.is_pinned ? styles.pinned : ""}`}
                          >
                            <div className={styles.nameSection}>
                              {item.is_pinned && <Pin size={14} fill="#ef4444" color="#ef4444" style={{ marginRight: 6 }} />}
                              <div>
                                <span>{item.name}</span>
                                <div className={styles.itemCategoryRow}>
                                  {editingCategoryId === item.id ? (
                                    <select
                                      className={styles.inlineCategory}
                                      value={item.category || 'その他'}
                                      onChange={(e) => handleChangeCategory(item, e.target.value)}
                                      onBlur={() => setEditingCategoryId(null)}
                                      autoFocus
                                    >
                                      {CATEGORY_ORDER.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      className={styles.categoryBadge}
                                      onClick={() => setEditingCategoryId(item.id)}
                                      title="カテゴリを変更"
                                    >
                                      {CATEGORY_ICONS[item.category || 'その他']} {item.category || 'その他'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className={styles.actions}>
                              <button
                                className={`${styles.pinBtn} ${item.is_pinned ? styles.pinActive : ""}`}
                                onClick={() => handleTogglePin(item)}
                                title={item.is_pinned ? "ピンを外す" : "ピン留め（必須指定）"}
                              >
                                <span style={{ fontSize: '20px' }}>📍</span>
                              </button>
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDelete(item.id)}
                                aria-label="削除"
                              >
                                <Trash2 size={22} strokeWidth={2.5} color="#ef4444" />
                              </button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !hasIngredients && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
          <ShoppingBag size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>在庫がありません。追加してください。</p>
        </div>
      )}
    </div>
  );
}
