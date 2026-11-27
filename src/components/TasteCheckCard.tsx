"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  dismissTasteCheck,
  getPendingTasteCheck,
  saveCookedRecordFeedback,
  type FlavorFeedbackTag,
  type PendingTasteCheck,
} from "@/lib/storage";
import UiIcon from "./UiIcon";
import styles from "./TasteCheckCard.module.css";

// 「作った」を押した時点ではまだ食べていないことが多いため、食べた後に
// ホームで味の感想を聞き直す。ここで集めた感想はレシピ生成の
// flavorFeedback(次の提案の味付け調整)にそのまま使われる。
export default function TasteCheckCard() {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingTasteCheck | null>(null);
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    // SSRと初回描画を一致させるため、端末データはマウント後に読む
    const refresh = () => setPending(getPendingTasteCheck());
    refresh();
    window.addEventListener("storage-updated", refresh);
    return () => window.removeEventListener("storage-updated", refresh);
  }, []);

  if (thanked) {
    return (
      <section className={styles.card} aria-live="polite">
        <p className={styles.thanks}>{t.home.tasteCheckThanks}</p>
      </section>
    );
  }
  if (!pending) return null;
  // 別の料理に切り替わったら選択状態を持ち越さないよう、料理ごとにフォームを作り直す
  return <TasteCheckForm key={pending.key} pending={pending} onSent={() => setThanked(true)} />;
}

function TasteCheckForm({ pending, onSent }: { pending: PendingTasteCheck; onSent: () => void }) {
  const { t } = useLanguage();
  const [tags, setTags] = useState<Set<FlavorFeedbackTag>>(new Set());
  const [wouldCookAgain, setWouldCookAgain] = useState(false);

  const toggle = (tag: FlavorFeedbackTag) => {
    setTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        // 「おいしい」と不満系は同時に選びにくいので、片方を選んだらもう片方を外す
        if (tag === "delicious") next.clear();
        else next.delete("delicious");
        next.add(tag);
      }
      return next;
    });
  };

  const canSend = tags.size > 0 || wouldCookAgain;
  const send = () => {
    if (!canSend) return;
    if (saveCookedRecordFeedback(pending.key, { tags: Array.from(tags), wouldCookAgain })) onSent();
  };
  const chips: [FlavorFeedbackTag, string][] = [
    ["delicious", t.cookingSession.feedbackDelicious],
    ["bland", t.cookingSession.feedbackBland],
    ["salty", t.cookingSession.feedbackSalty],
    ["too_sweet", t.cookingSession.feedbackTooSweet],
    ["heavy", t.cookingSession.feedbackHeavy],
  ];

  return (
    <section className={styles.card} aria-labelledby="taste-check-title">
      <div className={styles.header}>
        <UiIcon slug="main_dish" size={24} alt="" />
        <span id="taste-check-title" className={styles.title}>{t.home.tasteCheckTitle}</span>
      </div>
      <p className={styles.question}>{t.home.tasteCheckQuestion(pending.recipeTitle)}</p>
      <p className={styles.hint}>{t.home.tasteCheckHint}</p>
      <div className={styles.chips}>
        {chips.map(([tag, label]) => (
          <button
            key={tag}
            type="button"
            className={`${styles.chip} ${tags.has(tag) ? styles.chipActive : ""}`}
            aria-pressed={tags.has(tag)}
            onClick={() => toggle(tag)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${wouldCookAgain ? styles.chipActive : ""}`}
          aria-pressed={wouldCookAgain}
          onClick={() => setWouldCookAgain((value) => !value)}
        >
          {t.cookingSession.feedbackCookAgain}
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.send} disabled={!canSend} onClick={send}>
          {t.home.tasteCheckSave}
        </button>
        <button type="button" className={styles.dismiss} onClick={() => dismissTasteCheck(pending.key)}>
          {t.home.tasteCheckDismiss}
        </button>
      </div>
    </section>
  );
}
