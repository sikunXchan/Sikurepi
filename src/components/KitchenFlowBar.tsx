"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  getLocalIngredients,
  getLocalSavedRecipes,
  getLocalWeekPlan,
} from "@/lib/storage";
import styles from "./KitchenFlowBar.module.css";

export type KitchenFlowStep = "inventory" | "recipe" | "mealPlan" | "history";

export default function KitchenFlowBar({ active }: { active?: KitchenFlowStep }) {
  const { t } = useLanguage();
  const [counts, setCounts] = useState({ inventory: 0, mealPlan: 0, history: 0 });

  useEffect(() => {
    const loadCounts = () => {
      setCounts({
        inventory: getLocalIngredients().length,
        mealPlan: getLocalWeekPlan().length,
        history: getLocalSavedRecipes().length,
      });
    };
    const initialLoad = window.setTimeout(loadCounts, 0);
    window.addEventListener("storage-updated", loadCounts);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage-updated", loadCounts);
    };
  }, []);

  const items: Array<{
    key: KitchenFlowStep;
    href: string;
    label: string;
    value: string;
    slug: string;
  }> = [
    { key: "inventory", href: "/inventory", label: t.kitchenFlow.inventory, value: String(counts.inventory), slug: "fridge" },
    { key: "recipe", href: "/recipe", label: t.kitchenFlow.recipe, value: "AI", slug: "cooking_pot" },
    { key: "mealPlan", href: "/meal-plan", label: t.kitchenFlow.mealPlan, value: String(counts.mealPlan), slug: "calendar_date" },
    { key: "history", href: "/history", label: t.kitchenFlow.history, value: String(counts.history), slug: "teishoku" },
  ];

  return (
    <nav className={styles.flow} aria-label={t.kitchenFlow.ariaLabel}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`${styles.step} ${isActive ? styles.stepActive : ""}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={t.kitchenFlow.itemLabel(item.label, item.value)}
          >
            <span className={styles.iconWrap}>
              <UiIcon slug={item.slug} size={25} alt="" />
              <span className={styles.value}>{item.value}</span>
            </span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
