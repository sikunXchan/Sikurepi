"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, ChefHat, Heart, User } from "lucide-react";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.navWrapper}>
      {/* 1. ホーム (在庫) */}
      <Link
        href="/"
        className={`${styles.navItem} ${pathname === "/" ? styles.active : ""}`}
        data-nav="在庫"
      >
        <Home size={20} />
        <span>ホーム</span>
      </Link>

      {/* 2. 買い物 */}
      <Link
        href="/shopping"
        className={`${styles.navItem} ${pathname === "/shopping" ? styles.active : ""}`}
        data-nav="買い物"
      >
        <ShoppingBag size={20} />
        <span>買い物</span>
      </Link>

      {/* 3. 中央フローティング レシピ作成 */}
      <Link
        href="/recipe"
        className={styles.centerBtn}
        data-nav="レシピ"
        title="AIレシピ作成"
      >
        <ChefHat size={26} />
      </Link>

      {/* 4. お気に入り・履歴 */}
      <Link
        href="/history"
        className={`${styles.navItem} ${pathname === "/history" ? styles.active : ""}`}
        data-nav="履歴"
      >
        <Heart size={20} />
        <span>お気に入り</span>
      </Link>

      {/* 5. スキャン (レシート・画像) */}
      <Link
        href="/receipt"
        className={`${styles.navItem} ${pathname === "/receipt" ? styles.active : ""}`}
        data-nav="レシート"
      >
        <User size={20} />
        <span>スキャン</span>
      </Link>
    </nav>
  );
}
