"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import UiIcon from "./UiIcon";
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
      <UiIcon slug="language_globe" collection="core" size={17} alt="" />
      <span className={styles.languageCode}>{language === "ja" ? "EN" : "JA"}</span>
      <span>{t.language.toggleLabel}</span>
    </button>
  );
}
