"use client";

import { Crown } from "lucide-react";
import { usePremium } from "@/lib/premium/PremiumContext";
import styles from "./PageHeader.module.css";

/**
 * 各ページ共通のヘッダー。
 * モックアップに合わせて「マスコット＋タイトル＋ひとことサブタイトル」の並びに統一する。
 * 右側(actions)には設定ボタンなどページ固有のボタンを差し込める。
 */
export default function PageHeader({
  title,
  subtitle,
  mascot,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** public/mascot/ 配下のファイル名（拡張子なし） */
  mascot: string;
  actions?: React.ReactNode;
}) {
  const { isPremium } = usePremium();

  return (
    <div className={styles.header}>
      <img
        className={styles.mascot}
        src={`/mascot/${mascot}.png`}
        alt=""
        width={56}
        height={56}
      />
      <div className={styles.titleBlock}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {isPremium && (
            <span className={styles.plusBadge} aria-label="Sikurepi Plus">
              <Crown size={12} aria-hidden="true" />Plus
            </span>
          )}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
