"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLocalUserStats } from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./CookingCheerBear.module.css";

const SESSION_KEY = "lily_app_cheer_shown_session";

// 自炊してくれたことをねぎらう、下タブによじ登ってくる熊のマスコット。
// アプリを開いた時(セッション中1回だけ)、これまでに1回でも自炊記録があれば登場し、
// 定型のねぎらいメッセージを吹き出しで表示する。タップで下に降りて消える。
export default function CookingCheerBear() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // sessionStorageが使えない環境では、うるさくならないよう出現自体を諦める
      return;
    }

    const stats = getLocalUserStats();
    if (!stats.total_cooked || stats.total_cooked <= 0) return;

    const messages = t.cheer.messages;
    const chosen = messages[Math.floor(Math.random() * messages.length)];

    const timer = setTimeout(() => {
      setMessage(chosen);
      setVisible(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // 保存できなくても表示自体は続行する(次回また出るだけ)
      }
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.wrapper}
          onClick={handleDismiss}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <motion.div
            className={styles.bubble}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
          >
            {message}
          </motion.div>
          <motion.img
            src="/mascot/bear_wave.png"
            alt=""
            width={64}
            height={64}
            className={styles.bear}
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
