"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, Loader2, Trash2 } from "lucide-react";
import { consumeLocalIngredients, recordLocalCookingDone, NutritionData } from "@/lib/storage";
import IngredientIcon from "./IngredientIcon";
import styles from "./CookedModal.module.css";

type RecipeLike = {
  title: string;
  ingredients: { name: string; amount?: string }[];
  nutrition?: NutritionData | null;
};

type Props = {
  recipe?: RecipeLike;
  recipeTitle?: string;
  ingredients?: { name: string; amount?: string }[];
  nutrition?: NutritionData | null;
  onClose: () => void;
  onCompleted?: () => void;
  onSuccess?: () => void;
};

export default function CookedModal({
  recipe,
  recipeTitle: propTitle,
  ingredients: propIngredients,
  nutrition: propNutrition,
  onClose,
  onCompleted,
  onSuccess
}: Props) {
  const title = recipe?.title || propTitle || "料理";
  const rawIngredients = recipe?.ingredients || propIngredients || [];
  const nutrition = recipe?.nutrition || propNutrition || null;

  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(rawIngredients.map((i) => i.name))
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // 食材が空から降ってくるアニメーション用に、食材ごとの落ち方(横位置・揺れ・回転・
  // タイミング)をランダムに1回だけ決めておく。横位置は食材の数だけレーン分けした上で
  // 少しランダムにずらし、まんべんなく画面上に降ってくるようにする。
  const [fall] = useState(() =>
    rawIngredients.map((_, i) => {
      const lane = rawIngredients.length > 1 ? i / (rawIngredients.length - 1) : 0.5;
      return {
        leftPercent: 10 + lane * 80 + (Math.random() - 0.5) * 8,
        sway: (Math.random() - 0.5) * 50,
        rotate: (Math.random() - 0.5) * 360,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 0.7,
      };
    })
  );

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
      recordLocalCookingDone(consumedCount, title, nutrition || undefined, rawIngredients.map((i) => i.name));

      setDone(true);
      window.dispatchEvent(new Event("storage-updated"));
      window.dispatchEvent(new Event("stats-updated"));
      // 降ってくるアニメーションの最大所要時間(delay+duration)を待ってから閉じる
      setTimeout(() => {
        if (onCompleted) onCompleted();
        if (onSuccess) onSuccess();
        onClose();
      }, 3400);
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
            <div className={styles.doneState} style={{ position: "relative", overflow: "hidden" }}>
              {rawIngredients.map((item, idx) => (
                <motion.div
                  key={idx}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${fall[idx]?.leftPercent ?? 50}%`,
                    marginLeft: -34,
                    pointerEvents: "none",
                  }}
                  initial={{ y: -160, x: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    y: 420,
                    x: [0, fall[idx]?.sway ?? 0, 0],
                    opacity: [0, 1, 1, 0],
                    rotate: fall[idx]?.rotate ?? 0,
                  }}
                  transition={{
                    duration: fall[idx]?.duration ?? 2,
                    delay: 0.2 + (fall[idx]?.delay ?? 0),
                    ease: "easeIn",
                    times: [0, 0.12, 0.8, 1],
                  }}
                >
                  <IngredientIcon name={item.name} size={68} />
                </motion.div>
              ))}
              <motion.img
                src="/mascot/bear_hero.png"
                alt=""
                width={132}
                height={132}
                className={styles.doneBear}
                initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              />
              <h3>調理完了！お疲れさまでした！</h3>
              <p>自炊記録と在庫が更新されました</p>
            </div>
          ) : (
            <>
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <Sparkles size={18} className={styles.sparkleIcon} />
                  <h3>「{title}」を調理しました！</h3>
                </div>
                <button className={styles.closeBtn} onClick={onClose}>
                  <X size={18} />
                </button>
              </div>

              <p className={styles.desc}>
                使い切った食材にチェックを入れてください。選択した食材が冷蔵庫の在庫から削除されます。
              </p>

              <div className={styles.itemList}>
                {rawIngredients.map((item, idx) => {
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
