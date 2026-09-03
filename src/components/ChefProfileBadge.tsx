"use client";

import { useEffect, useState } from "react";
import { Flame, Leaf } from "lucide-react";
import { getLocalUserStats, UserStats } from "@/lib/storage";
import styles from "./ChefProfileBadge.module.css";

// 絵文字だと「もっとレベルを上げたい」という気持ちにつながりにくいため、
// アプリの顔であるクマのマスコットをランクごとに変えて表示する。
// (将来的には昇格演出専用のバッジイラストに差し替え予定)
// chef_levelはstorage.tsのsqrt式で1〜10にクランプされているため、
// 段階も10段まで用意し、6以降が「三つ星シェフ」に張り付いたままにならないようにする。
const CHEF_RANKS = [
  { level: 1, name: "見習いシェフ", mascot: "bear_reading" },
  { level: 2, name: "一人前シェフ", mascot: "bear_wave" },
  { level: 3, name: "家庭の料理人", mascot: "bear_basket" },
  { level: 4, name: "凄腕マスター", mascot: "bear_serving" },
  { level: 5, name: "三つ星シェフ", mascot: "bear_hero" },
  { level: 6, name: "予約殺到の人気シェフ", mascot: "bear_excited" },
  { level: 7, name: "食卓のヒーロー", mascot: "bear_itadakimasu" },
  { level: 8, name: "愛され料理人", mascot: "bear_love" },
  { level: 9, name: "満腹幸せの伝道師", mascot: "bear_sleeping" },
  { level: 10, name: "キッチンレジェンド", mascot: "bear_delivering" },
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

  const currentRank = CHEF_RANKS.slice().reverse().find((r) => stats.chef_level >= r.level) || CHEF_RANKS[0];

  return (
    <div className={styles.badgeContainer}>
      <div className={styles.rankPill}>
        <img
          src={`/mascot/${currentRank.mascot}.png`}
          alt=""
          className={styles.rankIcon}
          width={26}
          height={26}
        />
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
