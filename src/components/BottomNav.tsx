"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, ChefHat, BookOpen, ShoppingCart, CalendarDays, UserRound } from "lucide-react";
import { getForgottenIngredients } from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  // 「食材が呼びかける」対象がいる間、在庫タブに気づけるよう赤いバッジを出す
  const [forgottenCount, setForgottenCount] = useState(0);

  useEffect(() => {
    const update = () => setForgottenCount(getForgottenIngredients().length);
    update();
    window.addEventListener("storage-updated", update);
    return () => window.removeEventListener("storage-updated", update);
  }, []);

  // primary: モックアップの中央FABに相当する主要アクション（レシピを作る）
  // レシピを中央（左右3つずつ）に置くため、タブ数は7つ。
  const navItems = [
    { name: t.nav.inventory, path: "/", icon: Home, key: "inventory" },
    { name: t.nav.receipt, path: "/receipt", icon: Receipt, key: "receipt" },
    { name: t.nav.shopping, path: "/shopping", icon: ShoppingCart, key: "shopping" },
    { name: t.nav.recipe, path: "/recipe", icon: ChefHat, primary: true, key: "recipe" },
    { name: t.nav.mealPlan, path: "/meal-plan", icon: CalendarDays, key: "mealPlan" },
    { name: t.nav.history, path: "/history", icon: BookOpen, key: "history" },
    { name: t.nav.myPage, path: "/mypage", icon: UserRound, key: "myPage" },
  ];

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

        if (item.primary) {
          return (
            <Link
              key={item.path}
              href={item.path}
              className={styles.primaryItem}
              data-nav={item.name}
              data-nav-key={item.key}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={`${styles.fab} ${isActive ? styles.fabActive : ""}`}>
                <Icon size={24} />
              </span>
              <span className={styles.primaryLabel}>{item.name}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            data-nav={item.name}
            data-nav-key={item.key}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && <div className={styles.activeIndicator} />}
            <span className={styles.iconWrap}>
              <Icon size={24} />
              {item.key === "inventory" && forgottenCount > 0 && (
                <span className={styles.forgottenBadge} title={t.nav.forgottenBadgeTitle(forgottenCount)}>
                  {forgottenCount > 9 ? "9+" : forgottenCount}
                </span>
              )}
            </span>
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
