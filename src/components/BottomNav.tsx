"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, ChefHat, BookOpen, ShoppingCart, CalendarDays } from "lucide-react";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
  const pathname = usePathname();

  // primary: モックアップの中央FABに相当する主要アクション（レシピを作る）
  const navItems = [
    { name: "在庫", path: "/", icon: Home },
    { name: "レシート", path: "/receipt", icon: Receipt },
    { name: "買い物", path: "/shopping", icon: ShoppingCart },
    { name: "レシピ", path: "/recipe", icon: ChefHat, primary: true },
    { name: "献立", path: "/meal-plan", icon: CalendarDays },
    { name: "履歴", path: "/history", icon: BookOpen },
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
            <Icon size={24} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
