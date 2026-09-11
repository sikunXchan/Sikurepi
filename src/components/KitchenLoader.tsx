import styles from "./KitchenLoader.module.css";

type Props = {
  text: string;
  compact?: boolean;
  className?: string;
};

export default function KitchenLoader({ text, compact = false, className = "" }: Props) {
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
          className={styles.bear}
          src="/animations/chef-bear-stirring.webp"
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
