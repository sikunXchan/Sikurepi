"use client";

import PageHeader from "@/components/PageHeader";
import SettingsPanel from "@/components/SettingsPanel";
import PremiumStatusCard from "@/components/PremiumStatusCard";
import IngredientEncyclopedia from "@/components/IngredientEncyclopedia";
import { GuideButton } from "@/components/AppGuide";
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

      <PremiumStatusCard />

      <GuideButton all />

      <IngredientEncyclopedia />

      <div className={`card ${styles.panelCard}`}>
        <SettingsPanel />
      </div>
    </div>
  );
}
