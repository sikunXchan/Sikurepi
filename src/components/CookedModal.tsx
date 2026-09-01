"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { consumeLocalIngredients, recordLocalCookingDone, NutritionData } from "@/lib/storage";
import styles from "./CookedModal.module.css";

type Props = {
  recipeTitle?: string;
  ingredients?: { name: string; amount?: string }[];
  recipe?: {
    title: string;
    ingredients: { name: string; amount?: string }[];
    nutrition?: NutritionData | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
  onCompleted?: () => void;
};

export default function CookedModal({
  recipeTitle,
  ingredients: rawIngredients,
  recipe,
  onClose,
  onSuccess,
  onCompleted,
}: Props) {
  const finalTitle = recipe?.title || recipeTitle || "料理";
  const finalIngredients = recipe?.ingredients || rawIngredients || [];

  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(finalIngredients.map((i) => i.name))
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const toggleItem = (name: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleConfirm = (consume: boolean) => {
    setLoading(true);
    try {
      const toConsume = consume ? Array.from(selectedItems) : [];
      let consumedCount = 0;
      if (toConsume.length > 0) {
        consumedCount = consumeLocalIngredients(toConsume);
      }

      // PFC統計および調理記録を累積更新
      recordLocalCookingDone(consumedCount, finalTitle, recipe?.nutrition);

      setDone(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ff758f", "#52b788", "#ffb703", "#ff5c8a"],
      });
      window.dispatchEvent(new Event("storage-updated"));
      window.dispatchEvent(new Event("stats-updated"));
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onCompleted) onCompleted();
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {done ? (
            <div className={styles.doneState}>
              <div className={styles.doneIcon}>🎉</div>
              <h3>調理完了！お疲れさまでした！</h3>
              <p>自炊記録と在庫が更新されました</p>
            </div>
          ) : (
            <>
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <Sparkles size={18} className={styles.sparkleIcon} />
                  <h3>「{recipeTitle}」を調理しました！</h3>
                </div>
                <button className={styles.closeBtn} onClick={onClose}>
                  <X size={18} />
                </button>
              </div>

              <p className={styles.desc}>
                使い切った食材にチェックを入れてください。選択した食材が冷蔵庫の在庫から削除されます。
              </p>

              <div className={styles.itemList}>
                {ingredients.map((item, idx) => {
                  const isChecked = selectedItems.has(item.name);
                  return (
                    <label key={idx} className={`${styles.itemRow} ${isChecked ? styles.itemRowActive : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item.name)}
                        className={styles.checkbox}
                      />
                      <span className={styles.itemName}>{item.name}</span>
                      {item.amount && <span className={styles.itemAmount}>{item.amount}</span>}
                    </label>
                  );
                })}
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.consumeBtn}
                  disabled={loading}
                  onClick={() => handleConfirm(true)}
                >
                  {loading ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>{selectedItems.size}個を在庫から削除して完了</span>
                    </>
                  )}
                </button>

                <button
                  className={styles.skipBtn}
                  disabled={loading}
                  onClick={() => handleConfirm(false)}
                >
                  在庫を減らさずに記録のみ
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
