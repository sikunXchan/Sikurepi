"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Loader2, Palette, RotateCcw, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import type { PurchaseActionResult } from "@/lib/purchases";
import styles from "./PremiumPaywall.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
};

function actionMessage(
  result: PurchaseActionResult,
  t: ReturnType<typeof useLanguage>["t"]["premium"],
): string {
  switch (result.status) {
    case "pending":
      return t.paymentPending;
    case "not-entitled":
      return t.restoreNotFound;
    case "unavailable":
      return t.unavailable;
    case "error":
      return t.purchaseError;
    default:
      return "";
  }
}

export default function PremiumPaywall({ open, onClose, onActivated }: Props) {
  const { t } = useLanguage();
  const premium = usePremium();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const selectedPlan = useMemo(
    () => premium.plans.find((plan) => plan.id === selectedPlanId) ?? premium.plans[0] ?? null,
    [premium.plans, selectedPlanId],
  );

  useEffect(() => {
    if (!open) return;
    setMessage("");
    void premium.refresh();
    void premium.trackPaywallImpression();
  // 開くたびに一度だけ更新・計測する。Context関数は安定している。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!selectedPlanId && premium.plans[0]) setSelectedPlanId(premium.plans[0].id);
  }, [premium.plans, selectedPlanId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !premium.busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, premium.busy]);

  const finishIfActivated = (result: PurchaseActionResult, restored = false) => {
    if (result.status === "success") {
      setMessage(restored ? t.premium.restoreSuccess : t.premium.purchaseSuccess);
      onActivated?.();
      window.setTimeout(onClose, 650);
      return;
    }
    if (result.status !== "cancelled") setMessage(actionMessage(result, t.premium));
  };

  const handlePurchase = async () => {
    setMessage("");
    const result = await premium.purchase(selectedPlan?.id);
    finishIfActivated(result);
  };

  const handleRestore = async () => {
    setMessage("");
    const result = await premium.restore();
    finishIfActivated(result, true);
  };

  const unavailableMessage = premium.availability === "web"
    ? t.premium.nativeOnly
    : premium.availability === "unconfigured"
      ? t.premium.setupRequired
      : premium.availability === "error"
        ? t.premium.loadError
        : premium.availability === "ready" && premium.plans.length === 0
          ? t.premium.noOffering
          : "";

  const paywall = (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !premium.busy && onClose()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-title"
            className={styles.dialog}
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              disabled={premium.busy}
              aria-label={t.premium.close}
            >
              <X size={19} />
            </button>

            <div className={styles.mascotWrap} aria-hidden="true">
              <Image src="/mascot/bear_love.png" alt="" width={76} height={76} priority />
              <span><Crown size={15} /></span>
            </div>
            <p className={styles.eyebrow}>SIKUREPI PLUS</p>
            <h2 id="premium-title" className={styles.title}>{t.premium.title}</h2>
            <p className={styles.description}>{t.premium.description}</p>

            <ul className={styles.benefits}>
              <li><Check size={15} />{t.premium.benefitUnlimited}</li>
              <li><Check size={15} />{t.premium.benefitRegenerate}</li>
              <li><Palette size={15} />{t.premium.benefitSafety}</li>
            </ul>

            {premium.isPremium ? (
              <div className={styles.activeState}>
                <Crown size={18} />
                <span>{t.premium.active}</span>
              </div>
            ) : (
              <>
                {premium.availability === "loading" && (
                  <div className={styles.loadingPlans}>
                    <Loader2 className="spinner" size={18} /> {t.premium.loading}
                  </div>
                )}

                {premium.plans.length > 0 && (
                  <div className={styles.planList} role="radiogroup" aria-label={t.premium.planSelection}>
                    {premium.plans.map((plan) => {
                      const selected = plan.id === selectedPlan?.id;
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          key={plan.id}
                          className={`${styles.planOption} ${selected ? styles.planOptionSelected : ""}`}
                          onClick={() => setSelectedPlanId(plan.id)}
                          disabled={premium.busy}
                        >
                          <span className={styles.planName}>{t.premium.planLabel(plan.packageType)}</span>
                          <span className={styles.planPrice}>{plan.priceString}</span>
                          {plan.packageType === "ANNUAL" && plan.pricePerMonthString && (
                            <small>{t.premium.monthlyEquivalent(plan.pricePerMonthString)}</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(message || unavailableMessage) && (
                  <div className={styles.message} role="status">{message || unavailableMessage}</div>
                )}

                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={premium.busy || premium.availability !== "ready" || !selectedPlan}
                  className={styles.purchaseButton}
                >
                  {premium.busy ? (
                    <><Loader2 className="spinner" size={17} />{t.premium.processing}</>
                  ) : (
                    <><Crown size={17} />{selectedPlan ? t.premium.purchaseWithPrice(selectedPlan.priceString) : t.premium.purchase}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={premium.busy || premium.availability !== "ready"}
                  className={styles.restoreButton}
                >
                  <RotateCcw size={14} />{t.premium.restore}
                </button>
                <p className={styles.legal}>{t.premium.legal}</p>
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(paywall, document.body) : null;
}
