"use client";

import { useState, useEffect } from "react";
import { getLocalClimateState, setLocalClimateState, ClimateState } from "@/lib/storage";
import { CLIMATE_PRESETS, getAutoTimeOfDay } from "@/lib/climate";
import { RefreshCw } from "lucide-react";
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

  useEffect(() => {
    const current = getLocalClimateState();
    const autoTime = getAutoTimeOfDay();
    if (current.timeOfDay !== autoTime) {
      const updated = { ...current, timeOfDay: autoTime };
      setClimate(updated);
      setLocalClimateState(updated);
    }
  }, []);

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

  const icon = CLIMATE_ICONS[climate.condition] || "🌤️";

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <span className={styles.icon}>{icon}</span>
        <div className={styles.info}>
          <div className={styles.titleRow}>
            <span className={styles.conditionTitle}>
              {climate.condition} ({climate.temperature}℃) · {climate.timeOfDay}
            </span>
            <span className={styles.autoBadge}>気候連動中</span>
          </div>
          <p className={styles.advice}>{climate.advice}</p>
        </div>
      </div>
      <button
        type="button"
        className={styles.switchBtn}
        onClick={cycleClimate}
        title="気候を手動で切り替える"
      >
        <RefreshCw size={13} />
        <span>切替</span>
      </button>
    </div>
  );
}
