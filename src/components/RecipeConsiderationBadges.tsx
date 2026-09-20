"use client";

import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getConsiderationLabels, type RecipeConsiderations } from '@/lib/recipeConsiderations';
import styles from './RecipeConsiderationBadges.module.css';

export default function RecipeConsiderationBadges({
  considerations,
  compact = false,
}: {
  considerations?: RecipeConsiderations | null;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const labels = getConsiderationLabels(considerations, language);
  if (labels.length === 0) return null;
  const disclaimer = language === 'ja'
    ? '登録設定に基づき、生成後もプログラムで確認済みです。宗教認証・商品表示・製造時の混入は別途ご確認ください。'
    : 'Checked in code against your saved settings. Verify certification, product labels, and cross-contact separately.';
  return (
    <div className={`${styles.row} ${compact ? styles.compact : ''}`} aria-label={`${labels.join(', ')}. ${disclaimer}`} title={disclaimer}>
      {labels.map((label) => (
        <span className={styles.badge} key={label}><ShieldCheck size={compact ? 13 : 15} aria-hidden="true" />{label}</span>
      ))}
    </div>
  );
}
