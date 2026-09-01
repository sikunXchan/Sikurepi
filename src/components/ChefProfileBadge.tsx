"use client";

import { useEffect, useState } from "react";
import { Flame, Leaf } from "lucide-react";
import { getLocalUserStats, UserStats } from "@/lib/storage";
import styles from "./ChefProfileBadge.module.css";

const CHEF_RANKS = [
  { level: 1, name: "見習いシェフ", icon: "🍳" },
  { level: 2, name: "一人前シェフ", icon: "👨‍🍳" },
  { level: 3, name: "家庭の料理人", icon: "⭐" },
  { level: 4, name: "凄腕マスター", icon: "🌟" },
  { level: 5, name: "三つ星シェフ", icon: "👑" },
];

export default function ChefProfileBadge() {
  const [stats, setStats] = useState<UserStats>(getLocalUserStats());

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

  const currentRank = CHEF_RANKS.slice().reverse().find((r) => stats.chef_level >= r.level) || CHEF_RANKS[0];

  return (
    <div className={styles.badgeContainer}>
      <div className={styles.rankPill}>
        <span className={styles.rankIcon}>{currentRank.icon}</span>
        <span className={styles.rankName}>Lv.{stats.chef_level} {currentRank.name}</span>
      </div>

      <div className={styles.metricsGroup}>
        <div className={styles.metricItem} title="連続自炊日数">
          <Flame className={styles.streakIcon} size={15} />
          <span className={styles.metricValue}>{stats.streak_days}日連続</span>
        </div>

        {stats.saved_food_count > 0 && (
          <div className={styles.metricItem} title="食品ロス削減（使い切った食材数）">
            <Leaf className={styles.leafIcon} size={14} />
            <span className={styles.metricValue}>{stats.saved_food_count}個救済</span>
          </div>
        )}
      </div>
    </div>
  );
}
