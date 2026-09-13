"use client";

import { useState, useEffect } from "react";
import {
  getLocalClimateState,
  setLocalClimateState,
  getLocalUserProfile,
  setLocalUserProfile,
  DEFAULT_CLIMATE_STATE,
  ClimateState
} from "@/lib/storage";
import { CLIMATE_PRESETS, getAutoTimeOfDay, fetchRealWeather } from "@/lib/climate";
import { RefreshCw, Power } from "lucide-react";
import UiIcon from "@/components/UiIcon";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./ClimateBar.module.css";

const CLIMATE_ICON_SLUGS: Record<string, string> = {
  "猛暑・晴れ": "heatwave",
  "雨・肌寒い": "rain",
  "冬の寒波": "winter",
  "春・うららか": "spring",
  "秋・快晴": "autumn",
};

export default function ClimateBar() {
  const { t } = useLanguage();
  const [climate, setClimate] = useState<ClimateState>(DEFAULT_CLIMATE_STATE);
  const [enableClimate, setEnableClimate] = useState(true);

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

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadState(), 0);
    const handleUpdate = () => void loadState();
    window.addEventListener("storage-updated", handleUpdate);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage-updated", handleUpdate);
    };
  }, []);

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

  const iconSlug = climate.condition.includes("雨") ? "rain" :
               climate.condition.includes("雪") ? "winter" :
               climate.condition.includes("暑") ? "heatwave" :
               climate.condition.includes("春") ? "spring" :
               climate.condition.includes("秋") ? "autumn" :
               CLIMATE_ICON_SLUGS[climate.condition] || "clear";

  const translateTokens = (value: string, dictionary: Record<string, string>) =>
    Object.entries(dictionary).reduce((result, [source, translated]) => result.replace(source, translated), value);
  const displayCondition = translateTokens(climate.condition, t.climateBar.conditions);
  const displayTimeOfDay = translateTokens(climate.timeOfDay, t.climateBar.times);
  const displayAdvice = t.climateBar.advice[climate.advice] || climate.advice;

  return (
    <div className={`${styles.container} ${!enableClimate ? styles.disabledContainer : ''}`}>
      <div className={styles.left}>
        <span className={styles.icon}>
          <UiIcon slug={enableClimate ? iconSlug : 'no_entry'} size={30} alt={enableClimate ? displayCondition : ''} />
        </span>
        <div className={styles.info}>
          <div className={styles.titleRow}>
            <span className={styles.conditionTitle}>
              {enableClimate ? `${displayCondition} (${climate.temperature}℃) · ${displayTimeOfDay}` : t.climateBar.offTitle}
            </span>
            <span className={enableClimate ? styles.autoBadge : styles.offBadge}>
              {enableClimate ? t.climateBar.activeBadge : t.climateBar.disabledBadge}
            </span>
          </div>
          <p className={styles.advice}>
            {enableClimate ? displayAdvice : t.climateBar.offAdvice}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          className={`${styles.switchBtn} ${!enableClimate ? styles.btnInactive : ''}`}
          onClick={toggleClimateEnable}
          title={enableClimate ? t.climateBar.disableTitle : t.climateBar.enableTitle}
        >
          <Power size={12} />
          <span>{enableClimate ? 'ON' : 'OFF'}</span>
        </button>
        {enableClimate && (
          <button
            type="button"
            className={styles.switchBtn}
            onClick={cycleClimate}
            title={t.climateBar.cycleTitle}
          >
            <RefreshCw size={12} />
            <span>{t.climateBar.cycleButton}</span>
          </button>
        )}
      </div>
    </div>
  );
}
