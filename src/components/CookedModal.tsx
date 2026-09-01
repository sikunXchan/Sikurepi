use client;

import { useState } from react;
import { motion, AnimatePresence } from framer-motion;
import { Check, X, Sparkles, Loader2, Trash2 } from lucide-react;
import confetti from canvas-confetti;
import styles from ./CookedModal.module.css;
import { getApiHeaders } from @/lib/user;

type Props = {
  recipeTitle: string;
  ingredients: { name: string; amount?: string }[];
  onClose: () => void;
  onSuccess?: () => void;
};

export default function CookedModal({ recipeTitle, ingredients, onClose, onSuccess }: Props) {
  // デフォルトで全食材を選択
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(ingredients.map((i) => i.name))
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

  const handleConfirm = async (consume: boolean) => {
    setLoading(true);
    try {
      const toConsume = consume ? Array.from(selectedItems) : [];
      const res = await fetch(/api/recipes/consume, {
        method: POST,
        headers: getApiHeaders(),
        body: JSON.stringify({ consumedIngredients: toConsume }),
      });

      if (res.ok) {
        setDone(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [#ff7849, #20b2aa, #10b981, #fbbf24],
        });
        window.dispatchEvent(new Event(stats-updated));
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      }
    } catch (e) {
      console.error(e);
      alert(エラーが発生しました);
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
                    <label key={idx} className={${styles.itemRow} }>
                      <input
                        type=checkbox
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
                    <Loader2 size={16} className=spin />
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
