"use client";

import PageHeader from "@/components/PageHeader";
import SettingsPanel from "@/components/SettingsPanel";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./MyPage.module.css";

export default function MyPage() {
  const { t } = useLanguage();
  return (
    <div className={styles.container}>
      <PageHeader
        title={t.myPage.title}
        subtitle={t.myPage.subtitle}
        mascot="bear_love"
      />

      <div className={`card ${styles.panelCard}`}>
        <SettingsPanel />
      </div>
    </div>
  );
}
