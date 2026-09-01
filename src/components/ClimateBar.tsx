"use client";

import { useState, useEffect } from "react";
import {
  getLocalClimateState,
  setLocalClimateState,
  getLocalUserProfile,
  setLocalUserProfile,
  ClimateState
} from "@/lib/storage";
import { CLIMATE_PRESETS, getAutoTimeOfDay, fetchRealWeather } from "@/lib/climate";
import { RefreshCw, Power } from "lucide-react";
import styles from "./ClimateBar.module.css";

const CLIMATE_ICONS: Record<string, string> = {
  "猛暑・晴れ": "☀️",
  "雨・肌寒い": "🌧️",
  "冬の寒波": "❄️",
  "春・うららか": "🌸",
  "秋・快晴": "🍁",
};

export default function ClimateBar() {
  const [climate, setClimate] = useState<ClimateState>(getLocalClimateState());
  const [enableClimate, setEnableClimate] = useState(true);

  useEffect(() => {
    loadState();
    const handleUpdate = () => loadState();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadState = async () => {
    const profile = getLocalUserProfile();
    setEnableClimate(profile.enableClimate !== false);

    if (profile.enableClimate !== false && profile.address) {
      const real = await fetchRealWeather(profile.address);
      if (real) {
        setClimate(real);
        setLocalClimateState(real);
        return;
      }
    }

    const current = getLocalClimateState();
    const autoTime = getAutoTimeOfDay();
    if (current.timeOfDay !== autoTime) {
      const updated = { ...current, timeOfDay: autoTime };
      setClimate(updated);
      setLocalClimateState(updated);
    } else {
      setClimate(current);
    }
  };

  const toggleClimateEnable = () => {
    const profile = getLocalUserProfile();
    const nextState = !enableClimate;
    setEnableClimate(nextState);
    setLocalUserProfile({ ...profile, enableClimate: nextState });
  };

  const cycleClimate = () => {
    const currentIdx = CLIMATE_PRESETS.findIndex(p => p.condition === climate.condition);
    const nextIdx = (currentIdx + 1) % CLIMATE_PRESETS.length;
    const next = {
      ...CLIMATE_PRESETS[nextIdx],
      timeOfDay: climate.timeOfDay || getAutoTimeOfDay(),
    };
    setClimate(next);
    setLocalClimateState(next);
  };

  const icon = climate.condition.includes("雨") ? "🌧️" :
               climate.condition.includes("雪") ? "❄️" :
               climate.condition.includes("暑") ? "☀️" :
               climate.condition.includes("春") ? "🌸" :
               climate.condition.includes("秋") ? "🍁" :
               CLIMATE_ICONS[climate.condition] || "🌤️";

  return (
    <div className={`${styles.container} ${!enableClimate ? styles.disabledContainer : ''}`}>
      <div className={styles.left}>
        <span className={styles.icon}>{enableClimate ? icon : '🚫'}</span>
        <div className={styles.info}>
          <div className={styles.titleRow}>
            <span className={styles.conditionTitle}>
              {enableClimate ? `${climate.condition} (${climate.temperature}℃) · ${climate.timeOfDay}` : '気候連動 OFF (通常提案)'}
            </span>
            <span className={enableClimate ? styles.autoBadge : styles.offBadge}>
              {enableClimate ? '気候連動中' : '無効'}
            </span>
          </div>
          <p className={styles.advice}>
            {enableClimate ? climate.advice : '季節や気温を考慮せず、通常のバランスレシピを提案します'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          className={`${styles.switchBtn} ${!enableClimate ? styles.btnInactive : ''}`}
          onClick={toggleClimateEnable}
          title={enableClimate ? "気候連動をオフにする" : "気候連動をオンにする"}
        >
          <Power size={12} />
          <span>{enableClimate ? 'ON' : 'OFF'}</span>
        </button>
        {enableClimate && (
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
      </div>
    </div>
  );
}
