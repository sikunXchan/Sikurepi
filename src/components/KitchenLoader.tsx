import styles from "./KitchenLoader.module.css";

type Props = {
  text: string;
  compact?: boolean;
  className?: string;
  variant?: "stirring" | "serving" | "delivering" | "reading" | "basket";
};

const VARIANT_ASSETS: Record<NonNullable<Props["variant"]>, string> = {
  stirring: "/animations/chef-bear-stirring.webp",
  serving: "/mascot/bear_serving.png",
  delivering: "/mascot/bear_delivering.png",
  reading: "/mascot/bear_reading.png",
  basket: "/mascot/bear_basket.png",
};

export default function KitchenLoader({ text, compact = false, className = "", variant = "stirring" }: Props) {
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
          className={`${styles.bear} ${variant !== "stirring" ? styles[`bear_${variant}`] : ""}`}
          src={VARIANT_ASSETS[variant]}
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
