"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  getLocalRecipeFeedback,
  saveLocalRecipeFeedback,
  type RecipeFeedbackInput,
  type RecipeFeedbackRating,
} from "@/lib/storage";
import {
  submitCommunityRecipeFeedback,
  type CommunityFeedbackRecipe,
  type RecipeFeedbackSubmissionResult,
} from "@/lib/communityRecipes";
import styles from "./RecipeFeedbackPanel.module.css";

type FeedbackRecipe = CommunityFeedbackRecipe & RecipeFeedbackInput;

type Props = {
  recipe: FeedbackRecipe;
  source: "generation" | "completion";
  onChange?: (rating: RecipeFeedbackRating, note: string) => void;
};

export default function RecipeFeedbackPanel({ recipe, source, onChange }: Props) {
  const { t } = useLanguage();
  const [initialFeedback] = useState(() => getLocalRecipeFeedback(recipe));
  const [rating, setRating] = useState<RecipeFeedbackRating | null>(initialFeedback?.rating || null);
  const [note, setNote] = useState(initialFeedback?.note || "");
  const [status, setStatus] = useState<RecipeFeedbackSubmissionResult | "saving" | null>(null);

  const persist = async (nextRating: RecipeFeedbackRating, nextNote: string) => {
    const sanitizedNote = nextRating === "negative" ? nextNote.slice(0, 500) : "";
    saveLocalRecipeFeedback(recipe, nextRating, sanitizedNote, source);
    onChange?.(nextRating, sanitizedNote);
    setStatus("saving");
    const result = await submitCommunityRecipeFeedback({
      recipe,
      rating: nextRating,
      note: sanitizedNote,
      source,
    });
    setStatus(result);
  };

  const selectRating = (nextRating: RecipeFeedbackRating) => {
    setRating(nextRating);
    if (nextRating === "positive") setNote("");
    void persist(nextRating, nextRating === "negative" ? note : "");
  };

  const statusText = status === "saving"
    ? null
    : status === "saved"
      ? t.recipeFeedback.saved
      : status === "local-only"
        ? t.recipeFeedback.localOnly
        : status === "failed"
          ? t.recipeFeedback.failed
          : null;

  return (
    <section className={`${styles.panel} ${source === "completion" ? styles.panelCompletion : ""}`}>
      <div className={styles.heading}>
        <div>
          <strong>{source === "completion" ? t.recipeFeedback.completionTitle : t.recipeFeedback.generationTitle}</strong>
          <span>{t.recipeFeedback.hint}</span>
        </div>
        {status === "saving" ? (
          <Loader2 className={styles.spinner} size={17} aria-label={t.recipeFeedback.saved} />
        ) : statusText ? (
          <small className={styles.savedStatus}><Check size={13} />{statusText}</small>
        ) : null}
      </div>

      <div className={styles.voteRow}>
        <button
          type="button"
          className={`${styles.voteButton} ${styles.likeButton} ${rating === "positive" ? styles.likeActive : ""}`}
          aria-pressed={rating === "positive"}
          disabled={status === "saving"}
          onClick={() => selectRating("positive")}
        >
          <ThumbsUp size={18} fill={rating === "positive" ? "currentColor" : "none"} />
          {t.recipeFeedback.like}
        </button>
        <button
          type="button"
          className={`${styles.voteButton} ${styles.dislikeButton} ${rating === "negative" ? styles.dislikeActive : ""}`}
          aria-pressed={rating === "negative"}
          disabled={status === "saving"}
          onClick={() => selectRating("negative")}
        >
          <ThumbsDown size={18} fill={rating === "negative" ? "currentColor" : "none"} />
          {t.recipeFeedback.dislike}
        </button>
      </div>

      {rating === "negative" && (
        <div className={styles.issueArea}>
          <label>
            <span><MessageSquareText size={15} />{t.recipeFeedback.issueLabel}</span>
            <small>{t.recipeFeedback.issueHint}</small>
            <textarea
              value={note}
              maxLength={500}
              rows={3}
              placeholder={t.recipeFeedback.issuePlaceholder}
              onChange={(event) => {
                setNote(event.target.value);
                onChange?.("negative", event.target.value);
              }}
            />
          </label>
          <button type="button" className={styles.saveNoteButton} disabled={status === "saving"} onClick={() => void persist("negative", note)}>
            {t.recipeFeedback.saveIssue}
          </button>
        </div>
      )}
    </section>
  );
}
