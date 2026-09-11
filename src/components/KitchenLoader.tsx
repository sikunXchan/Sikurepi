"use client";

import { useEffect, useState } from "react";
import styles from "./KitchenLoader.module.css";

type Props = {
  text: string;
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

export default function KitchenLoader({ text, compact = false, className = "", variant = "cooking" }: Props) {
  const [cookingFrame, setCookingFrame] = useState(0);

  useEffect(() => {
    if (variant !== "cooking") return;
    const timer = window.setInterval(() => {
      setCookingFrame(current => (current + 1) % COOKING_ASSETS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [variant]);

  const asset = variant === "cooking" ? COOKING_ASSETS[cookingFrame] : VARIANT_ASSETS[variant];

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
        <span>{text}</span>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
