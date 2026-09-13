"use client";

import { useEffect, useState } from "react";
import styles from "./KitchenLoader.module.css";

type Props = {
  text: string;
  phaseMessages?: string[];
  compact?: boolean;
  className?: string;
  variant?: "cooking" | "stirring" | "mixing" | "chopping" | "frying" | "plating" | "serving" | "delivering" | "reading" | "basket";
};

const COOKING_ASSETS = [
  "/animations/bear-mixing.webp",
  "/animations/bear-chopping.webp",
  "/animations/bear-pan-toss.webp",
  "/animations/bear-plating.webp",
];

const VARIANT_ASSETS: Omit<Record<NonNullable<Props["variant"]>, string>, "cooking"> = {
  stirring: "/animations/bear-mixing.webp",
  mixing: "/animations/bear-mixing.webp",
  chopping: "/animations/bear-chopping.webp",
  frying: "/animations/bear-pan-toss.webp",
  plating: "/animations/bear-plating.webp",
  serving: "/mascot/bear_serving.png",
  delivering: "/mascot/bear_delivering.png",
  reading: "/mascot/bear_reading.png",
  basket: "/mascot/bear_basket.png",
};

const PHASE_THRESHOLDS_MS = [0, 1200, 3000, 6000];

export default function KitchenLoader({ text, phaseMessages, compact = false, className = "", variant = "cooking" }: Props) {
  const [cookingFrame, setCookingFrame] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (variant !== "cooking") return;
    const timer = window.setInterval(() => {
      setCookingFrame(current => (current + 1) % COOKING_ASSETS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [variant]);

  useEffect(() => {
    if (!phaseMessages || phaseMessages.length < 2) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextIndex = Math.min(
        phaseMessages.length - 1,
        PHASE_THRESHOLDS_MS.filter((threshold) => elapsed >= threshold).length - 1,
      );
      setPhaseIndex(nextIndex);
    }, 200);
    return () => window.clearInterval(timer);
  }, [phaseMessages]);

  const asset = variant === "cooking" ? COOKING_ASSETS[cookingFrame] : VARIANT_ASSETS[variant];
  const activeText = phaseMessages?.[phaseIndex] || text;

  return (
    <div
      className={`${styles.loader} ${compact ? styles.compact : ""} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.scene} aria-hidden="true">
        <span className={`${styles.steam} ${styles.steamOne}`} />
        <span className={`${styles.steam} ${styles.steamTwo}`} />
        <span className={`${styles.steam} ${styles.steamThree}`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.bear} ${!COOKING_ASSETS.includes(asset) ? styles[`bear_${variant}`] || "" : styles.cookingBear}`}
          src={asset}
          alt=""
          width={362}
          height={362}
        />
        <span className={styles.counter} />
      </div>
      <div className={styles.copy}>
        <span key={activeText} className={styles.phaseCopy}>{activeText}</span>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      {phaseMessages && phaseMessages.length > 1 && (
        <div className={styles.phaseRail} aria-hidden="true">
          {phaseMessages.map((message, index) => (
            <span
              key={message}
              className={`${styles.phasePip} ${index <= phaseIndex ? styles.phasePipActive : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
