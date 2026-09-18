"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CircleDot, Clock3, MessageSquareText, RefreshCw, ThumbsDown, ThumbsUp, Users, X } from "lucide-react";
import KitchenLoader from "@/components/KitchenLoader";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { localizeCommunityRecipe } from "@/lib/communityRecipeSchema";
import { useCommunityTranslation } from "@/lib/useCommunityTranslation";
import { communityTranslationCopy } from "@/lib/i18n/community";
import {
  COMMUNITY_RECIPES_CHANGED_EVENT,
  mergeCommunityRecipesWithLocal,
  type CommunityRecipeRowData,
} from "@/lib/communityRecipes";
import styles from "./CommunityRecipesScreen.module.css";

export type CommunityRecipeRow = CommunityRecipeRowData;

type Sentiment = "positive" | "negative" | "mixed" | "new";

function getSentiment(row: CommunityRecipeRow): Sentiment {
  const positive = Math.max(0, row.positive_ratings_count || 0);
  const negative = Math.max(0, row.negative_ratings_count || 0);
  if (positive === 0 && negative === 0) return "new";
  if (positive === negative) return "mixed";
  return positive > negative ? "positive" : "negative";
}

export function CommunityRecipeRowCard({
  row,
  onSelect,
}: {
  row: CommunityRecipeRow;
  onSelect: (row: CommunityRecipeRow) => void;
}) {
  const { t, language } = useLanguage();
  const translated = useCommunityTranslation(row.id, row.recipe, language);
  const { missing, failed, busy, ensureTranslation } = translated;
  const recipe = localizeCommunityRecipe(translated.recipe, language);
  const copy = communityTranslationCopy[language];
  const card = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (visible && missing && !failed && !busy && row.sync_status !== 'pending') {
      void ensureTranslation();
    }
  }, [visible, missing, failed, busy, ensureTranslation, row.sync_status]);
  const sentiment = getSentiment(row);
  const sentimentLabel = sentiment === "positive"
    ? t.home.communityHighRating
    : sentiment === "negative"
      ? t.home.communityLowRating
      : sentiment === "mixed"
        ? t.home.communityMixedRating
        : t.home.communityNewRating;
  const SentimentIcon = sentiment === "positive"
    ? ThumbsUp
    : sentiment === "negative"
      ? ThumbsDown
      : CircleDot;

  return (
    <button ref={card} type="button" className={styles.recipeRow} aria-busy={translated.busy} onClick={async () => {
      const recipe = translated.missing && row.sync_status !== 'pending'
        ? await translated.ensureTranslation() : translated.recipe;
      onSelect({ ...row, recipe });
    }}>
      <span className={styles.thumbnail}>
        <RecipeThumbnail genre={recipe.genre} fallbackIngredientName={recipe.title} size={70} />
      </span>
      <span className={styles.recipeCopy}>
        <span className={styles.recipeTopline}>
          <span className={styles.identity}>{row.id.startsWith('51000000-0000-4000-8000-') ? copy.curated : t.home.communityAnonymousAuthor}</span>
          <span className={styles.statuses}>
            {row.sync_status === 'pending' && (
              <span className={styles.syncPending}>{t.home.communityPendingSync}</span>
            )}
            <span className={`${styles.sentiment} ${styles[`sentiment_${sentiment}`]}`}>
              <SentimentIcon size={12} aria-hidden="true" />{sentimentLabel}
            </span>
          </span>
        </span>
        <strong className={styles.recipeTitle}>{recipe.title}</strong>
        {(translated.busy || translated.failed) && <span className={styles.commentText} role="status">
          {translated.busy ? copy.translating : copy.unavailable}
        </span>}
        <span className={styles.recipeMeta}>
          <span><Clock3 size={12} aria-hidden="true" />{recipe.time}</span>
          <span><Users size={12} aria-hidden="true" />{t.recipe.servingsUnit(recipe.servings || 2)}</span>
        </span>
        {recipe.creator_comment && (
          <span className={styles.comment}>
            <span className={styles.commentLabel}><MessageSquareText size={12} aria-hidden="true" />{t.home.communityCommentLabel}</span>
            <span className={styles.commentText}>{recipe.creator_comment}</span>
          </span>
        )}
      </span>
    </button>
  );
}

export default function CommunityRecipesScreen({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (row: CommunityRecipeRow) => void;
}) {
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState<CommunityRecipeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadRecipes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/community-recipes?limit=20&v=2", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("community recipes request failed");
      const data = await response.json();
      setRecipes(mergeCommunityRecipesWithLocal(Array.isArray(data?.recipes) ? data.recipes : []));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // 通信できない時も、端末内で送信待ちの料理は失わず表示する。
      const localRecipes = mergeCommunityRecipesWithLocal([]);
      setRecipes(localRecipes);
      setFailed(localRecipes.length === 0);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void loadRecipes(controller.signal);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const handleCommunityUpdate = () => void loadRecipes();
    window.addEventListener(COMMUNITY_RECIPES_CHANGED_EVENT, handleCommunityUpdate);
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(COMMUNITY_RECIPES_CHANGED_EVENT, handleCommunityUpdate);
    };
  }, [loadRecipes, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.screen} role="dialog" aria-modal="true" aria-labelledby="community-recipes-title">
      <header className={styles.header}>
        <Image src="/mascot/bear_reading.png" alt="" width={58} height={58} />
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>SIKUREPI COMMUNITY</span>
          <h2 id="community-recipes-title">{t.home.communityScreenTitle}</h2>
          <p>{t.home.communityScreenSubtitle}</p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t.premium.close}>
          <X size={22} />
        </button>
      </header>

      <main className={styles.content}>
        {loading ? (
          <KitchenLoader compact variant="reading" text={t.home.communityLoading} />
        ) : failed ? (
          <div className={styles.stateCard}>
            <Image src="/mascot/bear_sleeping.png" alt="" width={76} height={76} />
            <strong>{t.home.communityLoadFailed}</strong>
            <button type="button" onClick={() => void loadRecipes()}>
              <RefreshCw size={16} />{t.home.communityRetry}
            </button>
          </div>
        ) : recipes.length === 0 ? (
          <div className={styles.stateCard}>
            <Image src="/mascot/bear_reading.png" alt="" width={76} height={76} />
            <strong>{t.home.communityEmpty}</strong>
          </div>
        ) : (
          <div className={styles.recipeList}>
            {recipes.map((row) => (
              <CommunityRecipeRowCard key={row.id} row={row} onSelect={onSelect} />
            ))}
          </div>
        )}
      </main>
    </div>,
    document.body,
  );
}
