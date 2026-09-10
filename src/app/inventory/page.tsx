"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pin, Settings } from "lucide-react";
import { motion } from "framer-motion";
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
import styles from "./Inventory.module.css";

const LONG_PRESS_MS = 550;
const DOUBLE_TAP_MS = 320;

// AI判定中に毎回違う体勢を見せて飽きさせないためのポーズ一覧
const JUDGING_POSES = ["bear_reading.png", "bear_running.png", "bear_sleeping.png"];

function computeAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

// 棚に並ぶ1食材ぶんのチップ。冷凍室で無くなった分、野菜/肉・チルドゾーンは丸型、
// 調味料(ドアポケット)ゾーンは角丸四角と見た目を分ける。
// 長押しでピン留めは既存のジェスチャーを踏襲。削除は常時表示の小さなボタンだと
// 見た目が煩雑になる(=「冷蔵庫っぽさ」を損なう)ため廃止し、ダブルタップに変更した。
// 長押しでピン留めが発火した分はタップとしてカウントしない(誤ってダブルタップ削除
// にならないようにする)。ダブルタップ自体も誤操作の入り口になり得るため、実際の
// 削除は呼び出し元(親)が確認ダイアログを挟んでから行う(onRequestDeleteは
// 「削除を確認したい」というリクエストであり、即削除ではない)。
function ShelfItemChip({
  item,
  variant,
  onRequestDelete,
  onTogglePin,
}: {
  item: Ingredient;
  variant: 'circle' | 'square';
  onRequestDelete: (item: Ingredient) => void;
  onTogglePin: (item: Ingredient) => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const lastTapAtRef = useRef(0);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    longPressFiredRef.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressFiredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      onTogglePin(item);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPress();
    if (longPressFiredRef.current) return;
    const now = Date.now();
    if (now - lastTapAtRef.current < DOUBLE_TAP_MS) {
      lastTapAtRef.current = 0;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
      onRequestDelete(item);
    } else {
      lastTapAtRef.current = now;
    }
  };

  const isCircle = variant === 'circle';

  return (
    <div
      className={`${styles.shelfChip} ${isCircle ? styles.shelfChipCircle : styles.shelfChipSquare} ${item.is_pinned ? styles.shelfChipPinned : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
    >
      <div className={isCircle ? styles.shelfChipIconCircle : styles.shelfChipIconSquare}>
        <IngredientIcon name={item.name} size={isCircle ? 26 : 22} />
      </div>
      <span className={styles.shelfChipName}>
        {item.is_pinned && (
          <Pin size={isCircle ? 10 : 9} fill="#FFD700" color="#FFD700" style={{ marginRight: 2, verticalAlign: -1 }} />
        )}
        {item.name}
      </span>
    </div>
  );
}

// 食品ロス防止の「呼びかけ」を、5日以上放置された食材ごとに強めのアラートカードで
// 出す。該当ゾーンの通常チップからは除外し(二重表示にならないよう)、このアラートの
// 中だけに出す。CTAから/recipeへ遷移し、その食材を選択状態にして引き渡す。
function ForgottenShelfAlert({
  item,
  onFindRecipe,
}: {
  item: Ingredient;
  onFindRecipe: (item: Ingredient) => void;
}) {
  const { t } = useLanguage();
  const ageDays = computeAgeDays(item.created_at);
  const messages = t.inventory.forgottenAlertMessages;
  const message = messages[item.id % messages.length](item.name, ageDays);

  return (
    <div className={styles.forgottenBlock}>
      <div className={styles.forgottenAlert}>
        <div className={styles.forgottenAlertIconWrap}>
          <div className={styles.forgottenAlertPulseRing} />
          <div className={styles.forgottenAlertIconCircle}>
            <IngredientIcon name={item.name} size={30} />
          </div>
          <span className={styles.forgottenAlertBadge}>{t.inventory.forgottenBadge(ageDays)}</span>
        </div>
        <div className={styles.forgottenAlertTextSide}>
          <img className={styles.forgottenAlertMascot} src="/mascot/bear_sleeping.png" alt="" width={30} height={30} />
          <span className={styles.forgottenAlertText}>{message}</span>
        </div>
      </div>
      <button type="button" className={styles.forgottenAlertCta} onClick={() => onFindRecipe(item)}>
        {t.inventory.forgottenRecipeCta(item.name)}
      </button>
    </div>
  );
}

export default function InventoryPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("その他");
  // カテゴリを手動で選び直したら、それ以降は名前を打っても自動判定で上書きしない
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [forgottenItems, setForgottenItems] = useState<Ingredient[]>([]);
  // 静的キーワードで判定できなかった食材名について、Enter押下後にAIへ判定を
  // 依頼している間だけtrueにする(判定中はフォームを操作不可にしてキャラクターの
  // ローディング画面を表示する)
  const [isJudging, setIsJudging] = useState(false);
  const [judgingPose, setJudgingPose] = useState(JUDGING_POSES[0]);
  // ダブルタップ削除は誤操作が怖いという要望を受け、即削除ではなく
  // ここに削除対象を入れて確認ダイアログを挟む
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<Ingredient | null>(null);

  useEffect(() => {
    loadIngredients();
    const handleUpdate = () => loadIngredients();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadIngredients = () => {
    setIngredients(getLocalIngredients());
    setForgottenItems(getForgottenIngredients());
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
      showToast(t.inventory.alreadyInStock);
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
    showToast(t.inventory.addedToast(cleanName));
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
    if (name) showToast(t.inventory.deletedToast(name));
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteItem) return;
    handleDelete(confirmDeleteItem.id, confirmDeleteItem.name);
    setConfirmDeleteItem(null);
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

  const handleFindRecipeForForgotten = (item: Ingredient) => {
    router.push(`/recipe?ingredient=${item.id}`);
  };

  const hasIngredients = ingredients.length > 0;
  const forgottenIds = new Set(forgottenItems.map(i => i.id));

  // 冷蔵庫の棚の1段 = カテゴリ1つ。以前は12カテゴリを3ゾーンへ圧縮して表示して
  // いたが、ユーザーの要望でカテゴリ自体を7つへ圧縮し、以降は圧縮なしで
  // カテゴリごとにそのまま棚を分ける(調味料だけドアポケット風の特別な見た目にする)。
  const zoneItems: Record<string, Ingredient[]> = {};
  for (const cat of CATEGORY_ORDER) zoneItems[cat] = [];
  for (const item of ingredients) {
    const cat = zoneItems[item.category] ? item.category : 'その他';
    zoneItems[cat].push(item);
  }
  const visibleCategories = CATEGORY_ORDER.filter(cat => zoneItems[cat].length > 0);

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

      <PageHeader
        title={t.inventory.title}
        subtitle={t.inventory.subtitle}
        mascot="bear_basket"
        actions={
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setIsSettingsOpen(true)}
            title={t.inventory.settingsButtonTitle}
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
            placeholder={t.inventory.addPlaceholder}
            value={newName}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={isJudging}
          />
          <button type="submit" disabled={!newName.trim() || isJudging}>
            <Plus size={20} />
            {t.inventory.addButton}
          </button>
        </div>
        <div className={styles.categorySelectRow} style={{ opacity: isJudging ? 0.5 : 1, pointerEvents: isJudging ? 'none' : undefined, transition: 'opacity 0.2s' }} aria-disabled={isJudging}>
          <label className={styles.categorySelectLabel}>{t.inventory.categoryLabel}</label>
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
            <span className={styles.autoCategoryHint}>{t.inventory.autoCategoryHint}</span>
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
          <p>{t.inventory.aiJudgingText}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && hasIngredients && (
        <div className={styles.fridgeFrame}>
          <div className={styles.fridgeCard}>
            {visibleCategories.map(cat => {
              const items = zoneItems[cat];
              const forgottenInZone = items.filter(i => forgottenIds.has(i.id));
              const normalItems = items.filter(i => !forgottenIds.has(i.id));
              const isSeasoning = cat === '調味料';
              return (
                <div key={cat} className={`${styles.zoneBand} ${isSeasoning ? styles.zoneSeasoning : ""}`}>
                  <div className={styles.zoneLabelRow}>
                    <UiIcon slug={CATEGORY_ICON_SLUGS[cat] || 'other'} size={18} alt={cat} />
                    <span>{t.category[cat] || cat}</span>
                    {isSeasoning && <span className={styles.zoneNote}>{t.inventory.zoneSeasoningNote}</span>}
                    <span className={styles.zoneCount}>{items.length}</span>
                  </div>
                  {normalItems.length > 0 && (
                    <div className={styles.zoneChips}>
                      {normalItems.map(item => (
                        <ShelfItemChip
                          key={item.id}
                          item={item}
                          variant={isSeasoning ? 'square' : 'circle'}
                          onRequestDelete={setConfirmDeleteItem}
                          onTogglePin={handleTogglePin}
                        />
                      ))}
                    </div>
                  )}
                  {forgottenInZone.map(item => (
                    <ForgottenShelfAlert key={item.id} item={item} onFindRecipe={handleFindRecipeForForgotten} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !hasIngredients && (
        <div className={styles.fridgeFrame}>
          <div className={styles.fridgeCardSkeleton}>
            <div className={styles.fridgeSkeletonBand} />
            <div className={styles.fridgeSkeletonBand} />
            <div className={styles.fridgeSkeletonBandLast} />
          </div>
          <div className={styles.emptyStateCard}>
            <img src="/mascot/bear_sleeping.png" alt="" width={88} height={88} />
            <p className={styles.emptyStateTitle}>{t.inventory.emptyTitle}</p>
            <p className={styles.emptyStateBody}>{t.inventory.emptyBody}</p>
            <button type="button" className={styles.emptyStateCta} onClick={() => router.push('/receipt')}>
              {t.inventory.emptyCta}
            </button>
          </div>
        </div>
      )}

      {confirmDeleteItem && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDeleteItem(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconCircle}>
              <IngredientIcon name={confirmDeleteItem.name} size={32} />
            </div>
            <p className={styles.confirmText}>{t.inventory.deleteConfirmTitle(confirmDeleteItem.name)}</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDeleteItem(null)}>
                {t.inventory.deleteConfirmCancel}
              </button>
              <button type="button" className={styles.confirmDeleteBtn} onClick={handleConfirmDelete}>
                {t.inventory.deleteConfirmOk}
              </button>
            </div>
          </div>
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
