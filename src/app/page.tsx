"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Loader2, Pin, Settings } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate as animateValue, PanInfo } from "framer-motion";
import confetti from "canvas-confetti";
import ChefProfileBadge from "@/components/ChefProfileBadge";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import IngredientIcon from "@/components/IngredientIcon";
import PageHeader from "@/components/PageHeader";
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

const SWIPE_OPEN_X = -88;
const SWIPE_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;
const LONG_PRESS_MS = 550;

function SwipeableIngredientRow({
  item,
  isOpen,
  onOpenChange,
  onDelete,
  onTogglePin,
}: {
  item: Ingredient;
  isOpen: boolean;
  onOpenChange: (id: number | null) => void;
  onDelete: (id: number, name: string) => void;
  onTogglePin: (item: Ingredient) => void;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [SWIPE_OPEN_X, SWIPE_OPEN_X / 2, 0], [1, 1, 0]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) animateValue(x, 0, SWIPE_SPRING);
  }, [isOpen, x]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (isOpen) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      onTogglePin(item);
    }, LONG_PRESS_MS);
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const shouldOpen = info.offset.x < -40 || info.velocity.x < -300;
    animateValue(x, shouldOpen ? SWIPE_OPEN_X : 0, SWIPE_SPRING);
    onOpenChange(shouldOpen ? item.id : null);
  };

  return (
    <li className={styles.swipeWrapper}>
      <motion.div className={styles.swipeDeleteBg} style={{ opacity: bgOpacity }}>
        <button
          type="button"
          className={styles.swipeDeleteBtn}
          onClick={() => {
            onOpenChange(null);
            onDelete(item.id, item.name);
          }}
          title="削除"
        >
          <Trash2 size={20} />
        </button>
      </motion.div>
      <motion.div
        className={`${styles.listItem} ${item.is_pinned ? styles.pinned : ""}`}
        style={{ x, y: item.is_pinned ? -4 : 0 }}
        drag="x"
        dragConstraints={{ left: SWIPE_OPEN_X, right: 0 }}
        dragElastic={0.05}
        onDragStart={clearLongPress}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onTap={() => {
          if (isOpen) onOpenChange(null);
        }}
      >
        <div className={styles.nameSection}>
          <IngredientIcon name={item.name} size={36} />
          {item.is_pinned && <Pin size={14} fill="#FFD700" color="#FFD700" style={{ marginRight: 6, flexShrink: 0 }} />}
          <span>{item.name}</span>
        </div>
      </motion.div>
    </li>
  );
}

export default function Home() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("その他");
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (ingredients.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast("⚠️ その食材はすでに在庫にあります。");
      return;
    }

    addLocalIngredient(cleanName, selectedCategory);
    setNewName("");
    loadIngredients();
    showToast(`✨ 「${cleanName}」を冷蔵庫に追加しました！`);
  };

  const handleDelete = (id: number, name?: string) => {
    deleteLocalIngredient(id);
    loadIngredients();
    if (name) showToast(`🗑️ 「${name}」を削除しました`);
  };

  const handleTogglePin = (item: Ingredient) => {
    const pinState = !item.is_pinned;
    if (pinState) {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        shapes: ['star'],
        colors: ['#FFD700', '#FFA500', '#ff6f91'],
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

  const hasIngredients = ingredients.length > 0;

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(31, 41, 55, 0.95)',
          color: 'white',
          padding: '8px 18px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      {/* ヘッダーエリア */}
      <PageHeader
        title="冷蔵庫の在庫"
        subtitle="いま家にあるものを教えてね"
        mascot="bear_basket"
        actions={
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setIsSettingsOpen(true)}
            title="マイ設定・自炊統計"
          >
            <Settings size={18} />
          </button>
        }
      />

      <ChefProfileBadge />

      {/* 食材追加フォーム */}
      <form onSubmit={handleAdd} className={styles.addFormWrapper}>
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="食材名を入力 (例: トマト、豚バラ肉)"
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

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {/* リスト表示 */}
      {!loading && (
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
                        <SwipeableIngredientRow
                          key={item.id}
                          item={item}
                          isOpen={openSwipeId === item.id}
                          onOpenChange={setOpenSwipeId}
                          onDelete={handleDelete}
                          onTogglePin={handleTogglePin}
                        />
                      ))}
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
          <img src="/mascot/bear_sleeping.png" alt="" width={96} height={96} style={{ marginBottom: 8 }} />
          <p>在庫がありません。上のフォームから追加してください。</p>
        </div>
      )}

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadIngredients}
      />
    </div>
  );
}

