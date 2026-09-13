"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, Crown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import PremiumPaywall from "./PremiumPaywall";
import styles from "./PremiumStatusCard.module.css";

export default function PremiumStatusCard() {
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const [paywallOpen, setPaywallOpen] = useState(false);

  return (
    <>
      <section className={`${styles.card} ${isPremium ? styles.active : ""}`}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Image src="/mascot/bear_love.png" alt="" width={60} height={60} />
          <span><Crown size={12} /></span>
        </div>
        <div className={styles.copy}>
          <p>{t.premium.cardEyebrow}</p>
          <h2>{isPremium ? t.premium.cardActiveTitle : t.premium.cardFreeTitle}</h2>
          <span>{isPremium ? t.premium.cardActiveBody : t.premium.cardFreeBody}</span>
        </div>
        <button type="button" onClick={() => setPaywallOpen(true)} className={styles.action}>
          <span>{isPremium ? t.premium.cardManage : t.premium.cardAction}</span>
          <ChevronRight size={16} />
        </button>
      </section>
      <PremiumPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  );
}
