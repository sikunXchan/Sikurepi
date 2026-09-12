"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2, Trash2 } from "lucide-react";
import {
  consumeLocalIngredientsDetailed,
  getIngredientAgeDays,
  getLocalIngredients,
  getRescueEligibleIngredients,
  isIngredientMissing,
  recordLocalCookingDone,
  FlavorFeedbackTag,
  NutritionData,
  RescuedIngredientSnapshot,
} from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import IngredientIcon from "./IngredientIcon";
import styles from "./CookedModal.module.css";

type RecipeLike = {
  title: string;
  ingredients: { name: string; amount?: string }[];
  nutrition?: NutritionData | null;
};

type Props = {
  recipe?: RecipeLike;
  recipeTitle?: string;
  ingredients?: { name: string; amount?: string }[];
  nutrition?: NutritionData | null;
  onClose: () => void;
  onCompleted?: () => void;
  onSuccess?: () => void;
};

export default function CookedModal({
  recipe,
  recipeTitle: propTitle,
  ingredients: propIngredients,
  nutrition: propNutrition,
  onClose,
  onCompleted,
  onSuccess
}: Props) {
  const { t } = useLanguage();
  const title = recipe?.title || propTitle || t.cookingSession.cookedDefaultTitle;
  const rawIngredients = recipe?.ingredients || propIngredients || [];
  const nutrition = recipe?.nutrition || propNutrition || null;

  // レシピには在庫に無い調味料や不足食材も含まれる。在庫に実在する材料だけを
  // 初期選択し、料理を記録しただけで無関係な在庫が消える事故を防ぐ。
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => {
    const inventory = getLocalIngredients();
    return new Set(
      rawIngredients
        .filter((item) => !isIngredientMissing(item.name, inventory, false))
        .map((item) => item.name)
    );
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [consumedCount, setConsumedCount] = useState(0);
  const [rescuedIngredients, setRescuedIngredients] = useState<RescuedIngredientSnapshot[]>([]);
  // モーダルを開いた時点の対象を固定する。在庫更新後に対象が消えても、完了演出と
  // 記録へ正しく引き継げるようにする。
  const [rescueCandidates] = useState(() => getRescueEligibleIngredients());
  const [feedbackTags, setFeedbackTags] = useState<Set<FlavorFeedbackTag>>(new Set());
  const [wouldCookAgain, setWouldCookAgain] = useState(false);
  // handleConfirmは同期処理のため、setLoading(true)〜finallyのsetLoading(false)が
  // 同じJSタスク内で完結してしまい、Reactの再レンダーを待たずに終わる。
  // そのためstateのdisabled表示だけでは、素早い連打(ダブルタップ)で
  // recordLocalCookingDoneが2回呼ばれ自炊記録が重複する恐れがある。
  // refで同期的にガードし、実行中は問答無用で以降の呼び出しを無視する。
  const submittedRef = useRef(false);
  // 食材が空から降ってくるアニメーション用に、食材ごとの落ち方(横位置・揺れ・回転・
  // タイミング)をランダムに1回だけ決めておく。横位置は食材の数だけレーン分けした上で
  // 少しランダムにずらし、まんべんなく画面上に降ってくるようにする。
  const [fall] = useState(() =>
    rawIngredients.map((_, i) => {
      const lane = rawIngredients.length > 1 ? i / (rawIngredients.length - 1) : 0.5;
      return {
        leftPercent: 10 + lane * 80 + (Math.random() - 0.5) * 8,
        sway: (Math.random() - 0.5) * 50,
        rotate: (Math.random() - 0.5) * 360,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 0.7,
      };
    })
  );

  const toggleItem = (name: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleFeedback = (tag: FlavorFeedbackTag) => {
    setFeedbackTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleConfirm = (consume: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setLoading(true);
    try {
      const toConsume = consume ? Array.from(selectedItems) : [];
      let nextConsumedCount = 0;
      let nextRescuedIngredients: RescuedIngredientSnapshot[] = [];
      let consumedIngredientNames: string[] = [];
      if (toConsume.length > 0) {
        const consumedIngredients = consumeLocalIngredientsDetailed(toConsume);
        const rescueCandidateIds = new Set(rescueCandidates.map((item) => item.id));
        nextConsumedCount = consumedIngredients.length;
        consumedIngredientNames = consumedIngredients.map((item) => item.name);
        nextRescuedIngredients = consumedIngredients
          .filter((item) => rescueCandidateIds.has(item.id))
          .map((item) => ({ name: item.name, ageDays: getIngredientAgeDays(item) }));
      }
      const feedback = feedbackTags.size > 0 || wouldCookAgain
        ? { tags: Array.from(feedbackTags), wouldCookAgain }
        : undefined;
      recordLocalCookingDone(
        nextConsumedCount,
        title,
        nutrition || undefined,
        rawIngredients.map((i) => i.name),
        feedback,
        consumedIngredientNames,
        nextRescuedIngredients,
      );

      setConsumedCount(nextConsumedCount);
      setRescuedIngredients(nextRescuedIngredients);
      setDone(true);
      window.dispatchEvent(new Event("storage-updated"));
      window.dispatchEvent(new Event("stats-updated"));
      // 降ってくるアニメーションの最大所要時間(delay+duration)を待ってから閉じる
      setTimeout(() => {
        if (onCompleted) onCompleted();
        if (onSuccess) onSuccess();
        onClose();
      }, 3400);
    } catch (e) {
      console.error(e);
      alert(t.cookingSession.cookedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {done ? (
            <div className={styles.doneState} style={{ position: "relative", overflow: "hidden" }}>
              {rawIngredients.map((item, idx) => (
                <motion.div
                  key={idx}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${fall[idx]?.leftPercent ?? 50}%`,
                    marginLeft: -34,
                    pointerEvents: "none",
                  }}
                  initial={{ y: -160, x: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    y: 420,
                    x: [0, fall[idx]?.sway ?? 0, 0],
                    opacity: [0, 1, 1, 0],
                    rotate: fall[idx]?.rotate ?? 0,
                  }}
                  transition={{
                    duration: fall[idx]?.duration ?? 2,
                    delay: 0.2 + (fall[idx]?.delay ?? 0),
                    ease: "easeIn",
                    times: [0, 0.12, 0.8, 1],
                  }}
                >
                  <IngredientIcon name={item.name} size={68} />
                </motion.div>
              ))}
              <motion.img
                src="/mascot/bear_hero.png"
                alt=""
                width={132}
                height={132}
                className={styles.doneBear}
                initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              />
              {rescuedIngredients.length > 0 && (
                <div className={styles.rescuedIcons} aria-label={t.cookingSession.rescuedLabel}>
                  {rescuedIngredients.slice(0, 4).map((item) => (
                    <span key={item.name} className={styles.rescuedIcon}>
                      <IngredientIcon name={item.name} size={46} />
                    </span>
                  ))}
                </div>
              )}
              <h3>{rescuedIngredients.length > 0 ? t.cookingSession.rescuedDoneTitle : t.cookingSession.cookedDoneTitle}</h3>
              <p>
                {rescuedIngredients.length > 0
                  ? t.cookingSession.rescuedDoneMessage(rescuedIngredients.map((item) => item.name))
                  : t.cookingSession.cookedDoneMessage(consumedCount)}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <Sparkles size={18} className={styles.sparkleIcon} />
                  <h3>{t.cookingSession.cookedTitle(title)}</h3>
                </div>
                <button
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label={t.cookingSession.close}
                >
                  <X size={18} />
                </button>
              </div>

              <p className={styles.desc}>
                {t.cookingSession.cookedDescription}
              </p>

              <div className={styles.feedbackSection}>
                <div className={styles.feedbackHeading}>
                  <strong>{t.cookingSession.feedbackTitle}</strong>
                  <span>{t.cookingSession.feedbackHint}</span>
                </div>
                <div className={styles.feedbackChips}>
                  {([
                    ['delicious', t.cookingSession.feedbackDelicious],
                    ['bland', t.cookingSession.feedbackBland],
                    ['salty', t.cookingSession.feedbackSalty],
                    ['too_sweet', t.cookingSession.feedbackTooSweet],
                    ['heavy', t.cookingSession.feedbackHeavy],
                  ] as [FlavorFeedbackTag, string][]).map(([tag, label]) => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.feedbackChip} ${feedbackTags.has(tag) ? styles.feedbackChipActive : ''}`}
                      aria-pressed={feedbackTags.has(tag)}
                      onClick={() => toggleFeedback(tag)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.feedbackChip} ${wouldCookAgain ? styles.feedbackChipActive : ''}`}
                    aria-pressed={wouldCookAgain}
                    onClick={() => setWouldCookAgain((value) => !value)}
                  >
                    {t.cookingSession.feedbackCookAgain}
                  </button>
                </div>
              </div>

              <div className={styles.itemList}>
                {rawIngredients.map((item, idx) => {
                  const isChecked = selectedItems.has(item.name);
                  const isRescueCandidate = !isIngredientMissing(item.name, rescueCandidates, false);
                  return (
                    <label key={idx} className={`${styles.itemRow} ${isChecked ? styles.checkedRow : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item.name)}
                        className={styles.checkbox}
                      />
                      <span className={styles.itemName}>
                        {item.name}
                        {isRescueCandidate && <small className={styles.rescueBadge}>{t.cookingSession.rescueCandidate}</small>}
                      </span>
                      {item.amount && <span className={styles.itemAmount}>{item.amount}</span>}
                    </label>
                  );
                })}
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.consumeBtn}
                  disabled={loading}
                  onClick={() => handleConfirm(true)}
                >
                  {loading ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>{t.cookingSession.cookedCompleteButton(selectedItems.size)}</span>
                    </>
                  )}
                </button>

                {selectedItems.size > 0 && (
                  <button
                    className={styles.skipBtn}
                    disabled={loading}
                    onClick={() => handleConfirm(false)}
                  >
                    {t.cookingSession.cookedRecordOnly}
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
