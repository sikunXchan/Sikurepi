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
  const [isPremium, setIsPremium] = useState(false);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const snapshot = await getPremiumSnapshot();
    setAvailability(snapshot.availability);
    setIsPremium(snapshot.isPremium);
    setPlans(snapshot.plans);
    setOfferingId(snapshot.offeringId);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: () => void = () => undefined;

    void refresh();
    void subscribeToPremiumStatus((active) => {
      if (!disposed) setIsPremium(active);
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
      if (result.status === "success") setIsPremium(true);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      const result = await restorePremiumPurchases();
      if (result.status === "success") setIsPremium(true);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<PremiumContextValue>(() => ({
    availability,
    isPremium,
    plans,
    offeringId,
    busy,
    refresh,
    purchase,
    restore,
    trackPaywallImpression: trackPremiumPaywallImpression,
  }), [availability, busy, isPremium, offeringId, plans, purchase, refresh, restore]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const value = useContext(PremiumContext);
  if (!value) throw new Error("usePremium must be used inside PremiumProvider");
  return value;
}
