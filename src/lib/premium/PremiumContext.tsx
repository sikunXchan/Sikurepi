"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getPremiumSnapshot,
  purchasePremium,
  restorePremiumPurchases,
  subscribeToPremiumStatus,
  trackPremiumPaywallImpression,
  type PremiumAvailability,
  type PremiumPlan,
  type PurchaseActionResult,
} from "@/lib/purchases";

type PremiumLoadState = PremiumAvailability | "loading";

type PremiumContextValue = {
  availability: PremiumLoadState;
  isPremium: boolean;
  plans: PremiumPlan[];
  offeringId: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  purchase: (packageIdentifier?: string) => Promise<PurchaseActionResult>;
  restore: () => Promise<PurchaseActionResult>;
  trackPaywallImpression: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [availability, setAvailability] = useState<PremiumLoadState>("loading");
  const [storePremium, setStorePremium] = useState(false);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const snapshot = await getPremiumSnapshot();
    setAvailability(snapshot.availability);
    setStorePremium(snapshot.isPremium);
    setPlans(snapshot.plans);
    setOfferingId(snapshot.offeringId);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: () => void = () => undefined;

    // Retire the old device-only preview flag; entitlement now comes only from RevenueCat.
    try {
      window.localStorage.removeItem("sikurepi_premium_test_access_v1");
    } catch {
      // Storage may be unavailable. The legacy flag is never read or used.
    }
    void refresh();
    void subscribeToPremiumStatus((active) => {
      if (!disposed) setStorePremium(active);
    }).then((removeListener) => {
      if (disposed) removeListener();
      else unsubscribe = removeListener;
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [refresh]);

  const purchase = useCallback(async (packageIdentifier?: string) => {
    setBusy(true);
    try {
      const result = await purchasePremium(packageIdentifier);
      if (result.status === "success") setStorePremium(true);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      const result = await restorePremiumPurchases();
      if (result.status === "success") setStorePremium(true);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<PremiumContextValue>(() => ({
    availability,
    isPremium: storePremium,
    plans,
    offeringId,
    busy,
    refresh,
    purchase,
    restore,
    trackPaywallImpression: trackPremiumPaywallImpression,
  }), [availability, busy, storePremium, offeringId, plans, purchase, refresh, restore]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const value = useContext(PremiumContext);
  if (!value) throw new Error("usePremium must be used inside PremiumProvider");
  return value;
}
