"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Loader2, Pin, Settings, ChevronLeft, ChevronRight, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { motion, useMotionValue, useTransform, animate as animateValue, PanInfo } from "framer-motion";
import confetti from "canvas-confetti";
import ChefProfileBadge from "@/components/ChefProfileBadge";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import PageHeader from "@/components/PageHeader";
import {
  getLocalIngredients,
  addLocalIngredient,
  deleteLocalIngredient,
  toggleLocalIngredientPin,
  inferIngredientCategory,
  getForgottenIngredients,
  CATEGORY_ORDER,
  CATEGORY_ICON_SLUGS,
  Ingredient
} from "@/lib/storage";
import { matchIngredientSemantic } from "@/lib/embeddingMatch";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./Home.module.css";

const SWIPE_OPEN_X = -88;
const SWIPE_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;
const LONG_PRESS_MS = 550;

// AI判定中に毎回違う体勢を見せて飽きさせないためのポーズ一覧
const JUDGING_POSES = ["bear_reading.png", "bear_running.png", "bear_sleeping.png"];

// 食品ロス防止: 長く放置され直近の料理で使われていない食材に、
// アイコンの顔から吹き出しで呼びかけてもらう
function getForgottenMessage(t: ReturnType<typeof useLanguage>["t"], id: number, ageDays: number): string {
  const messages = t.home.forgottenMessages;
  const msg = messages[id % messages.length];
  return `${msg}${t.home.forgottenSuffix(ageDays)}`;
}

function SwipeableIngredientRow({
  item,
  isOpen,
  isForgotten,
  ageDays,
  onOpenChange,
  onDelete,
  onTogglePin,
}: {
  item: Ingredient;
  isOpen: boolean;
  isForgotten: boolean;
  ageDays: number;
  onOpenChange: (id: number | null) => void;
  onDelete: (id: number, name: string) => void;
  onTogglePin: (item: Ingredient) => void;
}) {
  const { t } = useLanguage();
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
          title={t.home.deleteButtonTitle}
        >
          <Trash2 size={20} />
        </button>
      </motion.div>
      <motion.div
        className={`${styles.listItem} ${item.is_pinned ? styles.pinned : ""} ${isForgotten ? styles.forgotten : ""}`}
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
          <span
            className={isForgotten ? styles.forgottenIconWrap : undefined}
            style={isForgotten ? { animationDelay: `${(item.id % 5) * 0.12}s` } : undefined}
          >
            <IngredientIcon name={item.name} size={36} />
          </span>
          <div className={styles.nameTextCol}>
            <span>
              {item.is_pinned && <Pin size={14} fill="#FFD700" color="#FFD700" style={{ marginRight: 6, verticalAlign: -2 }} />}
              {item.name}
            </span>
            {isForgotten && (
              <span className={styles.forgottenCallout}>💬 {getForgottenMessage(t, item.id, ageDays)}</span>
            )}
          </div>
        </div>
      </motion.div>
    </li>
  );
}

// カテゴリ詳細画面のグリッド表示用カード。スワイプ動線が取りにくい2列グリッドでは、
// 長押しでピン留め(リストと同じジェスチャー)、削除は常時表示の小さなボタンで行う。
function GridIngredientCard({
  item,
  isForgotten,
  onDelete,
  onTogglePin,
}: {
  item: Ingredient;
  isForgotten: boolean;
  onDelete: (id: number, name: string) => void;
  onTogglePin: (item: Ingredient) => void;
}) {
  const { t } = useLanguage();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    longPressedRef.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressedRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      onTogglePin(item);
    }, LONG_PRESS_MS);
  };

  return (
    <div
      className={`${styles.gridCard} ${item.is_pinned ? styles.gridCardPinned : ""} ${isForgotten ? styles.gridCardForgotten : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
    >
      <button
        type="button"
        className={styles.gridDeleteBtn}
        onClick={() => onDelete(item.id, item.name)}
        title={t.home.deleteButtonTitle}
      >
        <Trash2 size={13} />
      </button>
      <span
        className={isForgotten ? styles.forgottenIconWrap : undefined}
        style={isForgotten ? { animationDelay: `${(item.id % 5) * 0.12}s` } : undefined}
      >
        <IngredientIcon name={item.name} size={40} />
      </span>
      <span className={styles.gridCardName}>
        {item.is_pinned && <Pin size={12} fill="#FFD700" color="#FFD700" style={{ marginRight: 4, verticalAlign: -1 }} />}
        {item.name}
      </span>
    </div>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("その他");
  // カテゴリを手動で選び直したら、それ以降は名前を打っても自動判定で上書きしない
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [forgottenIds, setForgottenIds] = useState<Set<number>>(new Set());
  // 静的キーワードで判定できなかった食材名について、Enter押下後にAIへ判定を
  // 依頼している間だけtrueにする(判定中はフォームを操作不可にしてキャラクターの
  // ローディング画面を表示する)
  const [isJudging, setIsJudging] = useState(false);
  const [judgingPose, setJudgingPose] = useState(JUDGING_POSES[0]);
  // カテゴリ一覧はタップでカテゴリ詳細画面に遷移する方式にし、
  // アコーディオン展開はしない(常にコンパクトな一覧を保つ)
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySort, setCategorySort] = useState<"default" | "newest" | "oldest" | "name">("default");
  const [categoryViewMode, setCategoryViewMode] = useState<"grid" | "list">("list");

  useEffect(() => {
    loadIngredients();
    const handleUpdate = () => loadIngredients();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadIngredients = () => {
    setIngredients(getLocalIngredients());
    setForgottenIds(new Set(getForgottenIngredients().map(i => i.id)));
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJudging) return;
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (ingredients.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast(t.home.alreadyInStock);
      return;
    }

    let finalCategory = selectedCategory;

    // カテゴリを手動で選んでおらず、かつ静的キーワードでは「その他」にしか
    // 判定できなかった食材名(英語表記など)だけ、Enterが押されたこのタイミングで
    // 初めてAIに意味マッチングを依頼する。入力中の毎キー入力でAPIを叩かないよう、
    // 判定は送信時の1回きりにし、応答が返るまでキャラクター付きのローディング
    // 画面を表示してフォームを操作不可にする。
    if (!categoryTouched && selectedCategory === "その他") {
      setJudgingPose(JUDGING_POSES[Math.floor(Math.random() * JUDGING_POSES.length)]);
      setIsJudging(true);
      try {
        const result = await matchIngredientSemantic(cleanName);
        if (result?.category) finalCategory = result.category;
      } finally {
        setIsJudging(false);
      }
    }

    addLocalIngredient(cleanName, finalCategory);
    setNewName("");
    setSelectedCategory("その他");
    setCategoryTouched(false);
    loadIngredients();
    showToast(t.home.addedToast(cleanName));
  };

  const handleNameChange = (value: string) => {
    setNewName(value);
    // カテゴリを手動で選んでいない間は、入力中の食材名から静的キーワードのみで
    // 即座にカテゴリのプレビューを更新する(AIへの問い合わせはEnter押下後のみ)
    if (!categoryTouched) {
      setSelectedCategory(inferIngredientCategory(value));
    }
  };

  const handleDelete = (id: number, name?: string) => {
    deleteLocalIngredient(id);
    loadIngredients();
    if (name) showToast(t.home.deletedToast(name));
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

  const openCategory = (category: string) => {
    setViewingCategory(category);
    setCategorySearch("");
    setCategorySort("default");
  };

  const grouped = CATEGORY_ORDER.reduce<Record<string, Ingredient[]>>((acc, cat) => {
    const items = ingredients.filter(i => (i.category || 'その他') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const hasIngredients = ingredients.length > 0;

  // 表示中のカテゴリが空になった場合(最後の1件を削除した等)、
  // 空のカテゴリ詳細画面が残り続けないよう一覧画面に戻す
  useEffect(() => {
    if (viewingCategory && !grouped[viewingCategory]) {
      setViewingCategory(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, viewingCategory]);

  // カテゴリ詳細画面: 検索語で絞り込み、選択された並び順を適用する
  const categoryItems = viewingCategory ? (grouped[viewingCategory] || []) : [];
  const filteredCategoryItems = categorySearch.trim()
    ? categoryItems.filter(i => i.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
    : categoryItems;
  const sortedCategoryItems = [...filteredCategoryItems].sort((a, b) => {
    switch (categorySort) {
      case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name": return a.name.localeCompare(b.name, "ja");
      default: return 0;
    }
  });

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

      {viewingCategory === null ? (
        <>
          {/* ヘッダーエリア */}
          <PageHeader
            title={t.home.title}
            subtitle={t.home.subtitle}
            mascot="bear_basket"
            actions={
              <button
                type="button"
                className={styles.settingsBtn}
                onClick={() => setIsSettingsOpen(true)}
                title={t.home.settingsButtonTitle}
              >
                <Settings size={18} />
              </button>
            }
          />

          <ChefProfileBadge />

          {/* 食材追加フォーム: AI判定中(isJudging)は操作不可にし、下にローディング画面を出す */}
          <form onSubmit={handleAdd} className={styles.addFormWrapper}>
            <div className={styles.addForm} style={{ opacity: isJudging ? 0.5 : 1, pointerEvents: isJudging ? 'none' : undefined, transition: 'opacity 0.2s' }} aria-disabled={isJudging}>
              <input
                type="text"
                placeholder={t.home.addPlaceholder}
                value={newName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isJudging}
              />
              <button type="submit" disabled={!newName.trim() || isJudging}>
                <Plus size={20} />
                {t.home.addButton}
              </button>
            </div>
            <div className={styles.categorySelectRow} style={{ opacity: isJudging ? 0.5 : 1, pointerEvents: isJudging ? 'none' : undefined, transition: 'opacity 0.2s' }} aria-disabled={isJudging}>
              <label className={styles.categorySelectLabel}>{t.home.categoryLabel}</label>
              <select
                className={styles.categorySelect}
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCategoryTouched(true); }}
                disabled={isJudging}
              >
                {CATEGORY_ORDER.map(cat => (
                  // <option>内は画像を描画できないためテキストのみ表示
                  <option key={cat} value={cat}>{t.category[cat] || cat}</option>
                ))}
              </select>
              {!categoryTouched && newName.trim() && selectedCategory !== 'その他' && (
                <span className={styles.autoCategoryHint}>{t.home.autoCategoryHint}</span>
              )}
            </div>
          </form>

          {isJudging && (
            <div className={styles.aiJudgingState}>
              <motion.img
                key={judgingPose}
                src={`/mascot/${judgingPose}`}
                alt=""
                width={80}
                height={80}
                animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              />
              <p>{t.home.aiJudgingText}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center mt-4">
              <Loader2 className="spinner" size={32} color="var(--primary)" />
            </div>
          )}

          {/* カテゴリ一覧: タップでカテゴリ詳細画面に遷移する(常にコンパクトな一覧を保つ) */}
          {!loading && (
            <div className={styles.categoryGroups}>
              {Object.entries(grouped).map(([category, items]) => {
                const iconSlug = CATEGORY_ICON_SLUGS[category] || 'other';
                return (
                  <button
                    key={category}
                    type="button"
                    className={styles.categoryListRow}
                    onClick={() => openCategory(category)}
                  >
                    <span className={styles.categoryTitle}>
                      <UiIcon slug={iconSlug} size={22} alt={category} />
                      <span>{t.category[category] || category}</span>
                    </span>
                    <span className={styles.categoryListRowRight}>
                      <span className={styles.categoryCount}>{items.length}</span>
                      <ChevronRight size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !hasIngredients && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <img src="/mascot/bear_sleeping.png" alt="" width={96} height={96} style={{ marginBottom: 8 }} />
              <p>{t.home.emptyState}</p>
            </div>
          )}
        </>
      ) : (
        /* カテゴリ詳細画面: 検索・並び替え・グリッド/リスト切替を備えた単一カテゴリの一覧 */
        <div className={styles.categoryDetail}>
          <div className={styles.detailHeader}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setViewingCategory(null)}
              title={t.home.backButtonTitle}
            >
              <ChevronLeft size={22} />
            </button>
            <UiIcon slug={CATEGORY_ICON_SLUGS[viewingCategory] || 'other'} size={22} alt={viewingCategory} />
            <span className={styles.detailTitle}>{t.category[viewingCategory] || viewingCategory}</span>
            <span className={styles.categoryCount}>{categoryItems.length}</span>
          </div>

          <div className={styles.detailControls}>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder={t.home.searchInCategoryPlaceholder(t.category[viewingCategory] || viewingCategory)}
              />
            </div>
            <select
              className={styles.sortSelect}
              value={categorySort}
              onChange={(e) => setCategorySort(e.target.value as typeof categorySort)}
              title={t.home.sortLabel}
            >
              <option value="default">{t.home.sortDefault}</option>
              <option value="newest">{t.home.sortNewest}</option>
              <option value="oldest">{t.home.sortOldest}</option>
              <option value="name">{t.home.sortName}</option>
            </select>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={categoryViewMode === 'grid' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setCategoryViewMode('grid')}
                title={t.home.gridViewTitle}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                className={categoryViewMode === 'list' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setCategoryViewMode('list')}
                title={t.home.listViewTitle}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>

          {sortedCategoryItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <p>{t.home.noSearchResults}</p>
            </div>
          ) : categoryViewMode === 'grid' ? (
            <div className={styles.grid}>
              {sortedCategoryItems.map((item) => (
                <GridIngredientCard
                  key={item.id}
                  item={item}
                  isForgotten={forgottenIds.has(item.id)}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </div>
          ) : (
            <ul className={styles.list} style={{ padding: 0 }}>
              {sortedCategoryItems.map((item) => (
                <SwipeableIngredientRow
                  key={item.id}
                  item={item}
                  isOpen={openSwipeId === item.id}
                  isForgotten={forgottenIds.has(item.id)}
                  ageDays={Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                  onOpenChange={setOpenSwipeId}
                  onDelete={handleDelete}
                  onTogglePin={handleTogglePin}
                />
              ))}
            </ul>
          )}
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

