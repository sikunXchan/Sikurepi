"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, ChefHat, BookOpen, ShoppingCart } from "lucide-react";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "在庫", path: "/", icon: Home },
    { name: "レシート", path: "/receipt", icon: Receipt },
    { name: "買い物", path: "/shopping", icon: ShoppingCart },
    { name: "レシピ", path: "/recipe", icon: ChefHat },
    { name: "履歴", path: "/history", icon: BookOpen },
  ];

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            data-nav={item.name}
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
