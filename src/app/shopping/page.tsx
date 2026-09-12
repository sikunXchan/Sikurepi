"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Plus, Trash2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLocalShoppingItems,
  addLocalShoppingItem,
  deleteLocalShoppingItem,
  toggleLocalShoppingItem,
  inferIngredientCategory,
  CATEGORY_ORDER,
  CATEGORY_ICON_SLUGS,
  ShoppingItem
} from "@/lib/storage";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import PageHeader from "@/components/PageHeader";
import KitchenLoader from "@/components/KitchenLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./Shopping.module.css";

// 売り場ごとの独自カテゴリは持たず、在庫タブと同じカテゴリ体系
// (CATEGORY_ORDER / inferIngredientCategory)をそのまま流用する。
// これにより購入完了時に在庫へ移す際もカテゴリ変換が不要になる。

export default function ShoppingPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [flyingItem, setFlyingItem] = useState<{
    key: number;
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationKeyRef = useRef(0);

  function loadItems() {
    setItems(getLocalShoppingItems());
    setLoading(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadItems, 0);
    const handleUpdate = () => loadItems();
    window.addEventListener("storage-updated", handleUpdate);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage-updated", handleUpdate);
    };
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;

    const category = inferIngredientCategory(clean);
    addLocalShoppingItem(clean, category);
    setNewName("");
    loadItems();
  };

  const handleDelete = (id: number) => {
    deleteLocalShoppingItem(id);
    loadItems();
  };

  const handleComplete = (item: ShoppingItem, e: React.MouseEvent) => {
    const itemIcon = (e.currentTarget as HTMLElement)
      .closest('li')
      ?.querySelector('[data-shopping-item-icon]') as HTMLElement | null;
    const rect = (itemIcon || e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    const targetEl = document.querySelector('[data-nav-key="inventory"]');
    if (!targetEl) {
      toggleLocalShoppingItem(item.id);
      loadItems();
      return;
    }
    const targetRect = targetEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animationKeyRef.current += 1;
      setFlyingItem({
        key: animationKeyRef.current,
        name: item.name,
        startX,
        startY,
        endX,
        endY,
      });
    }
    toggleLocalShoppingItem(item.id);
    loadItems();
  };

  // 在庫と同じカテゴリ別にアイテムを自動グルーピング
  const groupedItems = CATEGORY_ORDER.reduce<Record<string, ShoppingItem[]>>((acc, category) => {
    const matched = items.filter(item => {
      const cat = item.category || inferIngredientCategory(item.name);
      return cat === category;
    });
    if (matched.length > 0) acc[category] = matched;
    return acc;
  }, {});

  // 未知のカテゴリはその他に集約
  const knownCategories = new Set(CATEGORY_ORDER);
  items.forEach(item => {
    const cat = item.category || inferIngredientCategory(item.name);
    if (!knownCategories.has(cat)) {
      if (!groupedItems['その他']) groupedItems['その他'] = [];
      groupedItems['その他'].push(item);
    }
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <PageHeader
        title={t.shopping.title}
        subtitle={t.shopping.subtitle}
        mascot="bear_basket"
      />

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          type="text"
          placeholder={t.shopping.addPlaceholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={!newName.trim()}>
          <Plus size={20} />
          {t.shopping.addButton}
        </button>
      </form>

      {loading && (
        <KitchenLoader compact variant="basket" text={t.shopping.subtitle} />
      )}

      {!loading && (
        <>
          {Object.keys(groupedItems).length > 0 ? (
            <div className={styles.categoryStack}>
              {CATEGORY_ORDER.map(category => {
                const categoryItems = groupedItems[category];
                if (!categoryItems || categoryItems.length === 0) return null;

                return (
                  <section key={category} className={styles.categoryCard}>
                    <div className={styles.categoryHeader}>
                      <span className={styles.categoryIcon}>
                        <UiIcon slug={CATEGORY_ICON_SLUGS[category] || 'other'} size={24} alt="" />
                      </span>
                      <span>{t.category[category] || category}</span>
                      <span className={styles.categoryCount}>{t.shopping.itemCount(categoryItems.length)}</span>
                    </div>

                    <ul className={styles.list}>
                      <AnimatePresence mode="popLayout">
                        {categoryItems.map((item) => (
                          <motion.li
                            key={item.id}
                            className={styles.listItem}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            layout
                          >
                            <div className={styles.itemInfo}>
                              <button
                                type="button"
                                className={styles.checkbox}
                                onClick={(e) => handleComplete(item, e)}
                                title={t.shopping.checkboxTitle}
                                aria-label={`${item.name}: ${t.shopping.checkboxTitle}`}
                              >
                                <Check size={16} />
                              </button>
                              <span className={styles.itemIcon} data-shopping-item-icon>
                                <IngredientIcon name={item.name} size={38} />
                              </span>
                              <span className={styles.itemName}>{item.name}</span>
                            </div>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(item.id)}
                              aria-label={`${item.name}: ${t.shopping.deleteAriaLabel}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Image src="/mascot/bear_basket.png" alt="" width={112} height={112} />
              <p>{t.shopping.emptyState}</p>
            </div>
          )}

          <AnimatePresence>
            {flyingItem && (
              <motion.div
                key={flyingItem.key}
                className={styles.flyingIngredient}
                style={{ left: flyingItem.startX, top: flyingItem.startY }}
                initial={{ x: -35, y: -35, scale: 1, opacity: 1, rotate: 0 }}
                animate={{
                  x: [
                    -35,
                    flyingItem.endX - flyingItem.startX - 30,
                    flyingItem.endX - flyingItem.startX - 35,
                  ],
                  y: [
                    -35,
                    Math.min(-150, (flyingItem.endY - flyingItem.startY) * 0.35 - 120),
                    flyingItem.endY - flyingItem.startY - 35,
                  ],
                  scale: [1, 1.15, 0.45],
                  opacity: [1, 1, 0.2],
                  rotate: [0, -8, 12],
                }}
                transition={{ duration: 0.85, ease: [0.45, 0, 0.55, 1] }}
                onAnimationComplete={() => setFlyingItem(null)}
              >
                <IngredientIcon name={flyingItem.name} size={58} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
