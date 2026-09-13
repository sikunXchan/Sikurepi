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
import {
  hasPremiumTestAccess,
  setPremiumTestAccess,
  verifyPremiumTestPassword,
} from "@/lib/premium/testAccess";

type PremiumLoadState = PremiumAvailability | "loading";

type PremiumContextValue = {
  availability: PremiumLoadState;
  isPremium: boolean;
  isTestPremium: boolean;
  plans: PremiumPlan[];
  offeringId: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  purchase: (packageIdentifier?: string) => Promise<PurchaseActionResult>;
  restore: () => Promise<PurchaseActionResult>;
  activateTestPremium: (password: string) => Promise<boolean>;
  deactivateTestPremium: () => void;
  trackPaywallImpression: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [availability, setAvailability] = useState<PremiumLoadState>("loading");
  const [storePremium, setStorePremium] = useState(false);
  const [isTestPremium, setIsTestPremium] = useState(false);
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

    setIsTestPremium(hasPremiumTestAccess());
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

  const activateTestPremium = useCallback(async (password: string) => {
    const accepted = await verifyPremiumTestPassword(password);
    if (!accepted) return false;
    setPremiumTestAccess(true);
    setIsTestPremium(true);
    return true;
  }, []);

  const deactivateTestPremium = useCallback(() => {
    setPremiumTestAccess(false);
    setIsTestPremium(false);
  }, []);

  const isPremium = storePremium || isTestPremium;

  const value = useMemo<PremiumContextValue>(() => ({
    availability,
    isPremium,
    isTestPremium,
    plans,
    offeringId,
    busy,
    refresh,
    purchase,
    restore,
    activateTestPremium,
    deactivateTestPremium,
    trackPaywallImpression: trackPremiumPaywallImpression,
  }), [activateTestPremium, availability, busy, deactivateTestPremium, isPremium, isTestPremium, offeringId, plans, purchase, refresh, restore]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const value = useContext(PremiumContext);
  if (!value) throw new Error("usePremium must be used inside PremiumProvider");
  return value;
}
