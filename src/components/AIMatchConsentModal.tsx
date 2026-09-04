"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
import {
  subscribeConsentRequest,
  subscribeEmbeddingStatus,
  subscribeDownloadProgress,
  getDownloadProgress,
  acceptAIMatching,
  declineAIMatching,
  EmbeddingStatus,
} from "@/lib/embeddingMatch";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./AIMatchConsentModal.module.css";

type Phase = "asking" | "working";

// 静的キーワードで判定できない食材名(英語など)に初めて遭遇した時、数百MB規模の
// オフライン判定モデルをダウンロードしてよいか明示的に確認するダイアログ。
// layout.tsx にマウントし、どの画面からのトリガーにも対応できるようにする。
export default function AIMatchConsentModal() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>("asking");
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubConsent = subscribeConsentRequest(() => {
      setVisible(true);
      setDismissed(false);
      setPhase("asking");
      setProgress(0);
    });
    const unsubStatus = subscribeEmbeddingStatus((s: EmbeddingStatus) => {
      if (s === "loading-model" || s === "preparing-anchors") {
        setPhase("working");
      } else if (s === "ready" || s === "unavailable") {
        setVisible(false);
      }
    });
    const unsubProgress = subscribeDownloadProgress((pct) => setProgress(pct));
    setProgress(getDownloadProgress());
    return () => {
      unsubConsent();
      unsubStatus();
      unsubProgress();
    };
  }, []);

  const handleAccept = () => {
    setPhase("working");
    acceptAIMatching();
  };

  const handleDecline = () => {
    setVisible(false);
    declineAIMatching();
  };

  // ダウンロード中に閉じても処理自体はバックグラウンドで継続する(このモーダルを
  // 消すだけで、embeddingMatch.ts側のPromiseは生き続けて完了/失敗まで走り切る)。
  const handleDismissWhileWorking = () => {
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase === "working" ? handleDismissWhileWorking : undefined}
      >
        <motion.div
          className={styles.modal}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {phase === "working" && (
            <button type="button" className={styles.closeBtn} onClick={handleDismissWhileWorking} aria-label={t.aiMatch.dismiss}>
              <X size={18} />
            </button>
          )}

          {phase === "asking" ? (
            <>
              <div className={styles.icon}><Download size={28} /></div>
              <h2 className={styles.title}>{t.aiMatch.consentTitle}</h2>
              <p className={styles.body}>{t.aiMatch.consentBody}</p>
              <button type="button" className={styles.acceptBtn} onClick={handleAccept}>
                {t.aiMatch.consentAccept}
              </button>
              <button type="button" className={styles.declineBtn} onClick={handleDecline}>
                {t.aiMatch.consentDecline}
              </button>
            </>
          ) : (
            <>
              <div className={styles.icon}><Loader2 size={28} className="spinner" /></div>
              <h2 className={styles.title}>{t.aiMatch.workingTitle}</h2>
              <p className={styles.body}>{t.aiMatch.workingBody}</p>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${Math.max(4, progress)}%` }} />
              </div>
              <p className={styles.progressLabel}>{progress > 0 ? `${progress}%` : t.aiMatch.progressPreparing}</p>
              <p className={styles.dismissHint}>{t.aiMatch.dismissHint}</p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
