"use client";

import { useEffect, useState } from "react";
import { Flame, Leaf } from "lucide-react";
import { getLocalUserStats, UserStats } from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./ChefProfileBadge.module.css";

// ブリガード・ド・キュイジーヌ(伝統的なフランス料理の厨房組織)にちなんだ
// ランク別バッジイラスト(public/ranks/)をレベルごとに表示する。
// chef_levelはstorage.tsのsqrt式で1〜10にクランプされているため、段階も10段。
// ランク名自体はi18n辞書(chefRanks)側で管理する。
const CHEF_BADGES = [
  { level: 1, badge: "commis" },
  { level: 2, badge: "premier_commis" },
  { level: 3, badge: "garde_manger" },
  { level: 4, badge: "poissonnier" },
  { level: 5, badge: "rotisseur" },
  { level: 6, badge: "saucier" },
  { level: 7, badge: "aboyer" },
  { level: 8, badge: "sous_chef" },
  { level: 9, badge: "chef_de_cuisine" },
  { level: 10, badge: "chef_executif" },
];

// getLocalUserStats()をuseStateの初期値に直接渡すと、SSR時(window無し→
// デフォルト値)とクライアント初回レンダー時(window有り→実際のlocalStorage値)
// で結果が食い違い、ハイドレーションミスマッチ(バッジがLv.1から一瞬で
// 実レベルに切り替わるチラつき)が発生していた。サーバー・クライアント双方で
// 同一になる無害な初期値を渡し、実データはマウント後のuseEffectでのみ取得する。
const INITIAL_STATS: UserStats = {
  streak_days: 0,
  last_cooked_date: null,
  total_cooked: 0,
  saved_food_count: 0,
  chef_level: 1,
  total_calories: 0,
  total_protein: 0,
  total_fat: 0,
  total_carbs: 0,
  cooked_records: [],
};

export default function ChefProfileBadge() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);

  useEffect(() => {
    const update = () => setStats(getLocalUserStats());
    update();
    window.addEventListener("storage-updated", update);
    window.addEventListener("stats-updated", update);
    return () => {
      window.removeEventListener("storage-updated", update);
      window.removeEventListener("stats-updated", update);
    };
  }, []);

  const currentBadge = CHEF_BADGES.slice().reverse().find((r) => stats.chef_level >= r.level) || CHEF_BADGES[0];
  const rankName = t.chefRanks[currentBadge.level - 1];

  return (
    <div className={styles.badgeContainer}>
      <div className={styles.rankPill}>
        <img
          src={`/ranks/${currentBadge.badge}.png`}
          alt=""
          className={styles.rankIcon}
          width={36}
          height={48}
        />
        <span className={styles.rankName}>Lv.{stats.chef_level} {rankName}</span>
      </div>

      <div className={styles.metricsGroup}>
        <div className={styles.metricItem} title={t.chefBadge.streakTitle}>
          <Flame className={styles.streakIcon} size={15} />
          <span className={styles.metricValue}>{t.chefBadge.streakLabel(stats.streak_days)}</span>
        </div>

        {stats.saved_food_count > 0 && (
          <div className={styles.metricItem} title={t.chefBadge.savedTitle}>
            <Leaf className={styles.leafIcon} size={14} />
            <span className={styles.metricValue}>{t.chefBadge.savedLabel(stats.saved_food_count)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
