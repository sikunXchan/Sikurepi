"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Flame, Leaf, X, Sparkles, Loader2, Trash2 } from "lucide-react";
import {
  consumeLocalIngredientsDetailed,
  getIngredientAgeDays,
  getLocalIngredients,
  getLocalUserProfile,
  getLocalUserStats,
  getLocalSavedRecipes,
  getRescueEligibleIngredients,
  isIngredientMissing,
  recordLocalCookingDone,
  getLocalRecipeFeedback,
  saveLocalRecipeFeedback,
  saveLocalRecipe,
  FlavorFeedbackTag,
  NutritionData,
  RecipeFeedbackRating,
  RescuedIngredientSnapshot,
  CookedRecord,
} from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import IngredientIcon from "./IngredientIcon";
import RecipeFeedbackPanel from "./RecipeFeedbackPanel";
import { buildIngredientCollection, STREAK_BADGE_MILESTONES } from "@/lib/ingredientCollection";
import { shareCookedRecipes } from "@/lib/communityRecipes";
import { isCommunityRecipe } from "@/lib/communityRecipeSchema";
import styles from "./CookedModal.module.css";

type RecipeLike = {
  title: string;
  time?: string;
  ingredients: { name: string; amount?: string }[];
  steps?: string[];
  tips?: string;
  genre?: string | null;
  dish_badge?: string | null;
  nutrition?: NutritionData | null;
  source?: NonNullable<CookedRecord['source']>;
  sourceRecipeId?: string;
  servings?: number;
  image_url?: string | null;
};

type Props = {
  recipe?: RecipeLike;
  recipeTitle?: string;
  ingredients?: { name: string; amount?: string }[];
  nutrition?: NutritionData | null;
  onClose: () => void;
  onCompleted?: () => void;
  onSuccess?: () => void;
  source?: NonNullable<CookedRecord['source']>;
  sourceRecipeId?: string | number;
};

export default function CookedModal({
  recipe,
  recipeTitle: propTitle,
  ingredients: propIngredients,
  nutrition: propNutrition,
  onClose,
  onCompleted,
  onSuccess,
  source: sourceProp,
  sourceRecipeId: sourceRecipeIdProp,
}: Props) {
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const title = recipe?.title || propTitle || t.cookingSession.cookedDefaultTitle;
  const rawIngredients = recipe?.ingredients || propIngredients || [];
  const nutrition = recipe?.nutrition || propNutrition || null;
  const feedbackRecipe: RecipeLike = recipe || { title, ingredients: rawIngredients, nutrition };
  const source = sourceProp || recipe?.source || 'generated';
  const sourceRecipeId = sourceRecipeIdProp != null
    ? String(sourceRecipeIdProp)
    : recipe?.sourceRecipeId;

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
  const [collectionReward, setCollectionReward] = useState<{
    newDiscoveries: number;
    completionPercent: number;
    streakDays: number;
    newStreakBadge: number | null;
  } | null>(null);
  // モーダルを開いた時点の対象を固定する。在庫更新後に対象が消えても、完了演出と
  // 記録へ正しく引き継げるようにする。
  const [rescueCandidates] = useState(() => getRescueEligibleIngredients());
  const [feedbackTags, setFeedbackTags] = useState<Set<FlavorFeedbackTag>>(new Set());
  const [wouldCookAgain, setWouldCookAgain] = useState(false);
  const [cookingComment, setCookingComment] = useState("");
  const [initialRecipeFeedback] = useState(() => getLocalRecipeFeedback(feedbackRecipe));
  const [recipeRating, setRecipeRating] = useState<RecipeFeedbackRating | null>(initialRecipeFeedback?.rating || null);
  const [recipeFeedbackNote, setRecipeFeedbackNote] = useState(initialRecipeFeedback?.note || "");
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
      const beforeStats = getLocalUserStats();
      const beforeCollection = buildIngredientCollection(beforeStats.cooked_records || []);
      const previouslyUnlocked = new Set(beforeCollection.entries.filter((entry) => entry.unlocked).map((entry) => entry.key));
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
      if (recipeRating) {
        saveLocalRecipeFeedback(feedbackRecipe, recipeRating, recipeFeedbackNote, 'completion');
      }
      const feedback = feedbackTags.size > 0 || wouldCookAgain || recipeRating || recipeFeedbackNote.trim() || cookingComment.trim()
        ? {
            tags: Array.from(feedbackTags),
            wouldCookAgain,
            rating: recipeRating || undefined,
            note: recipeFeedbackNote.normalize('NFKC').trim().slice(0, 500) || undefined,
            comment: cookingComment.normalize('NFKC').trim().slice(0, 500) || undefined,
          }
        : undefined;
      const updatedStats = recordLocalCookingDone(
        nextConsumedCount,
        title,
        nutrition || undefined,
        rawIngredients.map((i) => i.name),
        feedback,
        consumedIngredientNames,
        nextRescuedIngredients,
        { source, sourceRecipeId },
      );

      // 生成しただけでは履歴へ入れず、実際に「作った」と確定した時点で初めて
      // レシピ本文を履歴へ残す。同じ料理を再調理した場合、自炊回数は増やすが
      // 履歴カードは重複させない。
      const normalizedTitle = title.normalize('NFKC').trim().toLocaleLowerCase();
      const alreadySaved = getLocalSavedRecipes().some((saved) =>
        saved.title.normalize('NFKC').trim().toLocaleLowerCase() === normalizedTitle
      );
      if (recipe && !alreadySaved) {
        saveLocalRecipe({
          title,
          time: recipe.time || '',
          ingredients: rawIngredients.map((item) => ({ name: item.name, amount: item.amount || '' })),
          steps: recipe.steps || [],
          tips: recipe.tips || '',
          image_url: recipe.image_url || null,
          nutrition,
          genre: recipe.genre || null,
          dish_badge: recipe.dish_badge || null,
          servings: recipe.servings,
        });
      }

      // 図鑑・自炊回数と同じく「料理完了」を共有の起点にする。みんなのレシピを
      // 作った場合は自分の記録には数えるが、公開レシピを再投稿しない。
      const shareEnabled = !isPremium || getLocalUserProfile().shareGeneratedRecipes !== false;
      if (source !== 'community' && shareEnabled && isCommunityRecipe(feedbackRecipe)) {
        void shareCookedRecipes([feedbackRecipe]);
      }
      const afterCollection = buildIngredientCollection(updatedStats.cooked_records || []);
      const newStreakBadge = STREAK_BADGE_MILESTONES.find(
        (milestone) => beforeCollection.bestStreak < milestone && afterCollection.bestStreak >= milestone,
      ) || null;

      setConsumedCount(nextConsumedCount);
      setRescuedIngredients(nextRescuedIngredients);
      setCollectionReward({
        newDiscoveries: afterCollection.entries.filter((entry) => entry.unlocked && !previouslyUnlocked.has(entry.key)).length,
        completionPercent: afterCollection.completionPercent,
        streakDays: updatedStats.streak_days,
        newStreakBadge,
      });
      setDone(true);
      window.dispatchEvent(new Event("storage-updated"));
      window.dispatchEvent(new Event("stats-updated"));
      // アニメーションと獲得した図鑑・連続記録の報酬を読み切れる時間を確保する
      setTimeout(() => {
        if (onCompleted) onCompleted();
        if (onSuccess) onSuccess();
        onClose();
      }, 4200);
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
              {collectionReward && (
                <div className={styles.rewardSummary}>
                  <span>
                    <BookOpen size={15} />
                    {collectionReward.newDiscoveries > 0
                      ? t.cookingSession.collectionNew(collectionReward.newDiscoveries)
                      : t.cookingSession.collectionProgress(collectionReward.completionPercent)}
                  </span>
                  {rescuedIngredients.length > 0 && (
                    <span className={styles.rescueReward}><Leaf size={15} />{t.cookingSession.collectionRescue(rescuedIngredients.length)}</span>
                  )}
                  <span className={collectionReward.newStreakBadge ? styles.streakReward : ""}>
                    <Flame size={15} />
                    {collectionReward.newStreakBadge
                      ? t.cookingSession.streakBadgeEarned(collectionReward.newStreakBadge)
                      : t.cookingSession.streakProgress(collectionReward.streakDays)}
                  </span>
                </div>
              )}
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

              <div className={styles.scrollContent}>
                <p className={styles.desc}>
                  {t.cookingSession.cookedDescription}
                </p>

                <RecipeFeedbackPanel
                  recipe={feedbackRecipe}
                  source="completion"
                  onChange={(nextRating, nextNote) => {
                    setRecipeRating(nextRating);
                    setRecipeFeedbackNote(nextNote);
                  }}
                />

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

                <label className={styles.commentField}>
                  <span>
                    <strong>{t.cookingSession.feedbackCommentLabel}</strong>
                    <small>{t.cookingSession.feedbackCommentHint}</small>
                  </span>
                  <textarea
                    value={cookingComment}
                    maxLength={500}
                    rows={3}
                    placeholder={t.cookingSession.feedbackCommentPlaceholder}
                    onChange={(event) => setCookingComment(event.target.value)}
                  />
                  <i>{cookingComment.length}/500</i>
                </label>

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
