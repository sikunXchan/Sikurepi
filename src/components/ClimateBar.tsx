"use client";

import { useState, useEffect } from "react";
import {
  getLocalClimateState,
  setLocalClimateState,
  getLocalUserProfile,
  setLocalUserProfile,
  ClimateState,
  UserProfile
} from "@/lib/storage";
import { CLIMATE_PRESETS, getAutoTimeOfDay, fetchRealWeather } from "@/lib/climate";
import { RefreshCw } from "lucide-react";
import styles from "./ClimateBar.module.css";

const CLIMATE_ICONS: Record<string, string> = {
  "猛暑・晴れ": "☀️",
  "猛暑・快晴": "☀️",
  "快晴・過ごしやすい": "☀️",
  "快晴・寒気": "❄️",
  "うす曇り・快適": "⛅",
  "蒸し暑い曇り": "☁️",
  "曇り・冷え込み": "☁️",
  "雨・肌寒い": "🌧️",
  "雨・しっとり": "🌧️",
  "雪・厳しい寒波": "❄️",
  "冬の寒波": "❄️",
  "春・うららか": "🌸",
  "秋・快晴": "🍁",
  "雷雨・荒天": "⚡",
  "過ごしやすい": "🌤️",
};

export default function ClimateBar() {
  const [climate, setClimate] = useState<ClimateState>(getLocalClimateState());
  const [profile, setProfile] = useState<UserProfile>(getLocalUserProfile());
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    loadAndSync();
    const handleUpdate = () => loadAndSync();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadAndSync = async () => {
    const p = getLocalUserProfile();
    setProfile(p);
    const c = getLocalClimateState();

    if (p.address && p.enableClimate && !loadingWeather) {
      setLoadingWeather(true);
      const real = await fetchRealWeather(p.address);
      setLoadingWeather(false);
      if (real) {
        setClimate(real);
        setLocalClimateState(real);
        return;
      }
    }

    const autoTime = getAutoTimeOfDay();
    if (c.timeOfDay !== autoTime) {
      const updated = { ...c, timeOfDay: autoTime };
      setClimate(updated);
      setLocalClimateState(updated);
    } else {
      setClimate(c);
    }
  };

  const toggleClimateEnable = () => {
    const updated = { ...profile, enableClimate: !profile.enableClimate };
    setProfile(updated);
    setLocalUserProfile(updated);
  };

  const cycleClimate = () => {
    const currentIdx = CLIMATE_PRESETS.findIndex(p => p.condition === climate.condition);
    const nextIdx = (currentIdx + 1) % CLIMATE_PRESETS.length;
    const next = {
      ...CLIMATE_PRESETS[nextIdx],
      timeOfDay: climate.timeOfDay || getAutoTimeOfDay(),
      cityName: profile.address || '',
      isRealData: false,
    };
    setClimate(next);
    setLocalClimateState(next);
  };

  const icon = CLIMATE_ICONS[climate.condition] || "🌤️";

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <span className={styles.icon}>{profile.enableClimate ? icon : "💤"}</span>
        <div className={styles.info}>
          <div className={styles.titleRow}>
            {profile.enableClimate ? (
              <>
                <span className={styles.conditionTitle}>
                  {climate.cityName ? `${climate.cityName} · ` : ""}
                  {climate.condition} ({climate.temperature}℃) · {climate.timeOfDay}
                </span>
                <span className={styles.autoBadge}>
                  {climate.isRealData ? "📡 実天気連動中" : "気候連動中"}
                </span>
              </>
            ) : (
              <>
                <span className={styles.conditionTitle}>気候連動: オフ</span>
                <span className={styles.offBadge}>無効中</span>
              </>
            )}
          </div>
          <p className={styles.advice}>
            {profile.enableClimate
              ? climate.advice
              : "気候を考慮せず、お好みの条件のみでレシピを提案します"}
          </p>
        </div>
      </div>

      <div className={styles.rightActions}>
        {profile.enableClimate && (
          <button
            type="button"
            className={styles.switchBtn}
            onClick={cycleClimate}
            title="気候を手動で切り替える"
          >
            <RefreshCw size={12} />
            <span>切替</span>
          </button>
        )}

        {/* 可愛いピンクのON/OFFトグル */}
        <div
          className={`${styles.toggleSwitch} ${profile.enableClimate ? styles.toggleSwitchActive : ""}`}
          onClick={toggleClimateEnable}
          title={profile.enableClimate ? "気候連動をオフにする" : "気候連動をオンにする"}
        >
          <div className={styles.toggleKnob} />
        </div>
      </div>
    </div>
  );
}
