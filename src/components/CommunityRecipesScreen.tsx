"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CircleDot, MessageSquareText, RefreshCw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import KitchenLoader from "@/components/KitchenLoader";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { localizeCommunityRecipe, type CommunityRecipe } from "@/lib/communityRecipeSchema";
import styles from "./CommunityRecipesScreen.module.css";

export type CommunityRecipeRow = {
  id: string;
  likes_count: number;
  positive_ratings_count?: number;
  negative_ratings_count?: number;
  ranking_score?: number;
  recipe: CommunityRecipe;
};

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
  const recipe = localizeCommunityRecipe(row.recipe, language);
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
    <button type="button" className={styles.recipeRow} onClick={() => onSelect(row)}>
      <span className={styles.thumbnail}>
        <RecipeThumbnail genre={recipe.genre} fallbackIngredientName={recipe.title} size={70} />
      </span>
      <span className={styles.recipeCopy}>
        <span className={styles.recipeTopline}>
          <span className={styles.identity}>{t.home.communityAnonymousAuthor}</span>
          <span className={`${styles.sentiment} ${styles[`sentiment_${sentiment}`]}`}>
            <SentimentIcon size={12} aria-hidden="true" />{sentimentLabel}
          </span>
        </span>
        <strong className={styles.recipeTitle}>{recipe.title}</strong>
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
      const response = await fetch("/api/community-recipes?limit=20", { signal });
      if (!response.ok) throw new Error("community recipes request failed");
      const data = await response.json();
      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
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
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
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
