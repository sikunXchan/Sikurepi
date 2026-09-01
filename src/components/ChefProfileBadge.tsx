use client;

import { useEffect, useState } from react;
import { Flame, Award, Leaf } from lucide-react;
import styles from ./ChefProfileBadge.module.css;
import { getApiHeaders } from @/lib/user;

type Stats = {
  streak_days: number;
  total_cooked: number;
  saved_food_count: number;
  chef_level: number;
};

const CHEF_RANKS = [
  { level: 1, name: 見習いシェフ, icon: 🍳 },
  { level: 2, name: 一人前シェフ, icon: 👨‍🍳 },
  { level: 3, name: 家庭の料理人, icon: ⭐ },
  { level: 4, name: 凄腕マスター, icon: 🌟 },
  { level: 5, name: 三つ星シェフ, icon: 👑 },
];

export default function ChefProfileBadge() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats();
    const handleStatsUpdate = () => fetchStats();
    window.addEventListener(stats-updated, handleStatsUpdate);
    return () => window.removeEventListener(stats-updated, handleStatsUpdate);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(/api/stats, { headers: getApiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!stats) return null;

  const currentRank = CHEF_RANKS.slice().reverse().find((r) => stats.chef_level >= r.level) || CHEF_RANKS[0];

  return (
    <div className={styles.badgeContainer}>
      <div className={styles.rankPill}>
        <span className={styles.rankIcon}>{currentRank.icon}</span>
        <span className={styles.rankName}>Lv.{stats.chef_level} {currentRank.name}</span>
      </div>

      <div className={styles.metricsGroup}>
        <div className={styles.metricItem} title=連続自炊日数>
          <Flame className={styles.streakIcon} size={15} />
          <span className={styles.metricValue}>{stats.streak_days}日連続</span>
        </div>

        {stats.saved_food_count > 0 && (
          <div className={styles.metricItem} title=食品ロス削減（使い切った食材数）>
            <Leaf className={styles.leafIcon} size={14} />
            <span className={styles.metricValue}>{stats.saved_food_count}個救済</span>
          </div>
        )}
      </div>
    </div>
  );
}
