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
      <span className={styles.flag}>{language === "ja" ? "🇯🇵" : "🇬🇧"}</span>
      <span>{t.language.toggleLabel}</span>
    </button>
  );
}
