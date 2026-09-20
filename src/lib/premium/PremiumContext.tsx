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
  isRevenueCatTestStoreBuild,
} from "@/lib/purchases";
import { FILMING_ACCESS_STORAGE_KEY, verifyFilmingPassword } from "@/lib/premium/filmingAccess";

type PremiumLoadState = PremiumAvailability | "loading";

type PremiumContextValue = {
  availability: PremiumLoadState;
  isPremium: boolean;
  plans: PremiumPlan[];
  offeringId: string | null;
  busy: boolean;
  filmingAccessAvailable: boolean;
  unlockForFilming: (password: string) => boolean;
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
  const [filmingAccessAvailable, setFilmingAccessAvailable] = useState(false);
  const [filmingPremium, setFilmingPremium] = useState(false);

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

    // Retire the old unrestricted preview flag. The replacement below is available
    // only when the native host proves this is a Debug build using Test Store.
    const filmingAllowed = isRevenueCatTestStoreBuild();
    setFilmingAccessAvailable(filmingAllowed);
    try {
      window.localStorage.removeItem("sikurepi_premium_test_access_v1");
      if (filmingAllowed) {
        setFilmingPremium(window.localStorage.getItem(FILMING_ACCESS_STORAGE_KEY) === "1");
      } else {
        window.localStorage.removeItem(FILMING_ACCESS_STORAGE_KEY);
        setFilmingPremium(false);
      }
    } catch {
      // Storage may be unavailable. The Debug-only password still works for the
      // current session, while the legacy flag is never read or used.
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

  const unlockForFilming = useCallback((password: string) => {
    if (!isRevenueCatTestStoreBuild() || !verifyFilmingPassword(password)) return false;
    try {
      window.localStorage.setItem(FILMING_ACCESS_STORAGE_KEY, "1");
    } catch {
      // Plus remains active for this session even when storage is unavailable.
    }
    setFilmingPremium(true);
    return true;
  }, []);

  const value = useMemo<PremiumContextValue>(() => ({
    availability,
    isPremium: storePremium || filmingPremium,
    plans,
    offeringId,
    busy,
    filmingAccessAvailable,
    unlockForFilming,
    refresh,
    purchase,
    restore,
    trackPaywallImpression: trackPremiumPaywallImpression,
  }), [availability, busy, filmingAccessAvailable, filmingPremium, storePremium, offeringId, plans, purchase, refresh, restore, unlockForFilming]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const value = useContext(PremiumContext);
  if (!value) throw new Error("usePremium must be used inside PremiumProvider");
  return value;
}
