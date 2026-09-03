"use client";

import PageHeader from "@/components/PageHeader";
import SettingsPanel from "@/components/SettingsPanel";
import styles from "./MyPage.module.css";

export default function MyPage() {
  return (
    <div className={styles.container}>
      <PageHeader
        title="マイページ"
        subtitle="設定と自炊データはここにまとまってるよ"
        mascot="bear_love"
      />

      <div className={`card ${styles.panelCard}`}>
        <SettingsPanel />
      </div>
    </div>
  );
}
