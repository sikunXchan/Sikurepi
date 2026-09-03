"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, ChefHat, BookOpen, ShoppingCart, CalendarDays, UserRound } from "lucide-react";
import { getForgottenIngredients } from "@/lib/storage";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
  const pathname = usePathname();
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
    { name: "在庫", path: "/", icon: Home },
    { name: "レシート", path: "/receipt", icon: Receipt },
    { name: "買い物", path: "/shopping", icon: ShoppingCart },
    { name: "レシピ", path: "/recipe", icon: ChefHat, primary: true },
    { name: "献立", path: "/meal-plan", icon: CalendarDays },
    { name: "履歴", path: "/history", icon: BookOpen },
    { name: "マイページ", path: "/mypage", icon: UserRound },
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
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && <div className={styles.activeIndicator} />}
            <span className={styles.iconWrap}>
              <Icon size={24} />
              {item.name === "在庫" && forgottenCount > 0 && (
                <span className={styles.forgottenBadge} title={`${forgottenCount}個の食材が呼びかけています`}>
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
