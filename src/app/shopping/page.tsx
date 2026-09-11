"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { motion, AnimatePresence, animate } from "framer-motion";
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
  const containerRef = useRef<HTMLDivElement>(null);

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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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

    createFlyingEffect(item.name, startX, startY, endX, endY);
    toggleLocalShoppingItem(item.id);
    loadItems();
  };

  const createFlyingEffect = (name: string, startX: number, startY: number, endX: number, endY: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    el.style.boxShadow = "0 10px 25px rgba(255, 111, 145, 0.4)";
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
                              <span className={styles.itemIcon}>
                                <IngredientIcon name={item.name} size={38} />
                              </span>
                              <span className={styles.itemName}>{item.name}</span>
                            </div>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(item.id)}
                              aria-label={t.shopping.deleteAriaLabel}
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
              <img src="/mascot/bear_basket.png" alt="" width={112} height={112} />
              <p>{t.shopping.emptyState}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
