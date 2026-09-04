"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./LanguageToggle.module.css";

export default function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleLanguage}
      title={t.language.toggleLabel}
    >
      {/* 国旗は現在の言語ではなく、タップした時に切り替わる先の言語(=隣のラベルと同じ対象)を示す */}
      <span className={styles.flag}>{language === "ja" ? "🇬🇧" : "🇯🇵"}</span>
      <span>{t.language.toggleLabel}</span>
    </button>
  );
}
