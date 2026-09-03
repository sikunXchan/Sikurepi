"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Timer as TimerIcon,
  Check,
  Play,
  Pause,
  PartyPopper,
  RefreshCw,
  Loader2,
  ClipboardList,
} from "lucide-react";
import CookedModal from "./CookedModal";
import IngredientIcon from "./IngredientIcon";
import styles from "./CookingSession.module.css";

type IngredientItem = {
  name: string;
  amount: string;
};

type Props = {
  title: string;
  steps: string[];
  ingredients?: IngredientItem[];
  autoGenerateImages?: boolean;
  onClose: () => void;
};

type StepMeta = {
  seconds: number | null;
  heat: string | null;
};

function parseStepMeta(step: string): StepMeta {
  const timeMatch = step.match(/(\d+)\s*(時間|分|秒)/);
  let seconds: number | null = null;
  if (timeMatch) {
    const n = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2];
    seconds = unit === "時間" ? n * 3600 : unit === "分" ? n * 60 : n;
  }
  const heatMatch = step.match(/強火|中火|弱火|予熱|沸騰|余熱/);
  return { seconds, heat: heatMatch ? heatMatch[0] : null };
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -40 : 40, opacity: 0 }),
};

export default function CookingSession({
  title,
  steps,
  ingredients,
  autoGenerateImages = false,
  onClose,
}: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStepIndex, setTimerStepIndex] = useState(index);
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [showIngredients, setShowIngredients] = useState(false);
  const [showCookedModal, setShowCookedModal] = useState(false);

  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ingredientNames = useMemo(() => ingredients?.map((i) => i.name), [ingredients]);

  const metas = useMemo(() => steps.map(parseStepMeta), [steps]);
  const total = steps.length;
  const progressPct = total > 1 ? (index / (total - 1)) * 100 : 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    nodeRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index]);

  // Reset the per-step timer whenever the step changes (adjusting state during
  // render, per React's guidance, instead of an effect that would cascade a render)
  if (timerStepIndex !== index) {
    setTimerStepIndex(index);
    setTimerRunning(false);
    setTimerRemaining(metas[index]?.seconds ?? null);
  }

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((prev) => {
      if (prev >= total - 1) {
        setFinished(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ff6f91", "#20b2aa", "#fbbf24"],
        });
        return prev;
      }
      return prev + 1;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goTo = useCallback(
    (i: number) => {
      setDirection(i >= index ? 1 : -1);
      setFinished(false);
      setIndex(i);
    },
    [index]
  );

  const generateStepImage = useCallback(
    async (i: number) => {
      setImageLoading((prev) => ({ ...prev, [i]: true }));
      setImageErrors((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
      try {
        const res = await fetch("/api/recipes/step-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, step: steps[i], ingredients: ingredientNames }),
        });
        const data = await res.json();
        if (!res.ok || !data.image) throw new Error(data.error || "画像の生成に失敗しました");
        setStepImages((prev) => ({ ...prev, [i]: data.image }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "画像の生成に失敗しました";
        setImageErrors((prev) => ({ ...prev, [i]: message }));
      } finally {
        setImageLoading((prev) => ({ ...prev, [i]: false }));
      }
    },
    [title, steps, ingredientNames]
  );

  // α mode: generate every step's image up front, one at a time
  useEffect(() => {
    if (!autoGenerateImages) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        await generateStepImage(i);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateImages]);

  const generatedImageCount = useMemo(
    () => steps.filter((_, i) => stepImages[i]).length,
    [steps, stepImages]
  );

  // Keyboard support (desktop testing / accessibility)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timerRemaining === null || timerRemaining <= 0) return;
    const t = setTimeout(() => {
      setTimerRemaining((s) => {
        if (s === null) return s;
        const next = s - 1;
        if (next <= 0) {
          setTimerRunning(false);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timerRemaining]);

  const handleTapZone = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.noTap}`)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      goPrev();
    } else {
      goNext();
    }
  };

  const currentMeta = metas[index];

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.headerTitle}>{title}</div>
          {autoGenerateImages && (
            <div className={styles.headerSubtitle}>
              画像を準備中 {generatedImageCount}/{total}
            </div>
          )}
        </div>
        {ingredients && ingredients.length > 0 && (
          <button className={styles.ingredientsBtn} onClick={() => setShowIngredients(true)}>
            <ClipboardList size={16} />
            材料
          </button>
        )}
        <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
          <X size={22} />
        </button>
      </div>

      <AnimatePresence>
        {showIngredients && (
          <motion.div
            className={styles.ingredientsBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIngredients(false)}
          >
            <motion.div
              className={styles.ingredientsSheet}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.ingredientsSheetHeader}>
                <span>材料</span>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowIngredients(false)}
                  aria-label="閉じる"
                >
                  <X size={20} />
                </button>
              </div>
              <ul className={styles.ingredientsSheetList}>
                {ingredients?.map((item, i) => (
                  <li key={i}>
                    <span className={styles.ingredientsSheetNameGroup}>
                      <IngredientIcon name={item.name} size={26} />
                      <span className={styles.ingredientsSheetName}>{item.name}</span>
                    </span>
                    <span className={styles.ingredientsSheetAmount}>{item.amount}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.timelineWrap}>
        <div className={styles.timelineTrack}>
          <div className={styles.timelineLineBg} />
          <motion.div
            className={styles.timelineLineFill}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
          {steps.map((_, i) => (
            <button
              key={i}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              className={`${styles.node} ${i === index ? styles.nodeActive : ""} ${
                i < index || finished ? styles.nodeDone : ""
              }`}
              onClick={() => goTo(i)}
            >
              {i < index || (finished && i <= index) ? <Check size={14} /> : i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stage}>
        <AnimatePresence mode="wait" custom={direction}>
          {finished ? (
            <motion.div
              key="finished"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={styles.finishedCard}
            >
              <PartyPopper size={56} color="#ff6f91" />
              <h2>完成です！</h2>
              <p>お疲れさまでした 🍽️</p>
              <button
                className={styles.finishBtn}
                style={{ marginBottom: "12px", background: "linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)", color: "white" }}
                onClick={() => setShowCookedModal(true)}
              >
                🍳 在庫の消費を記録する
              </button>
              <button className={styles.finishBtn} onClick={onClose}>
                閉じる
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={index}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className={styles.stepCard}
              onClick={handleTapZone}
            >
              <div className={styles.stepLabel}>
                STEP {index + 1} / {total}
              </div>

              {(currentMeta?.heat || currentMeta?.seconds) && (
                <div className={styles.badgeRow}>
                  {currentMeta?.heat && (
                    <span className={styles.badge}>
                      <Flame size={14} /> {currentMeta.heat}
                    </span>
                  )}
                  {currentMeta?.seconds != null && (
                    <span className={styles.badge}>
                      <TimerIcon size={14} /> {formatClock(currentMeta.seconds)}
                    </span>
                  )}
                </div>
              )}

              {autoGenerateImages && (
                <div className={`${styles.imageBox} ${styles.noTap}`}>
                  {stepImages[index] ? (
                    <div className={styles.imageWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stepImages[index]} alt={`STEP ${index + 1}`} className={styles.stepImage} />
                      <button
                        className={styles.imageRegenBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateStepImage(index);
                        }}
                        disabled={imageLoading[index]}
                        title="画像を再生成"
                      >
                        {imageLoading[index] ? (
                          <Loader2 className="spinner" size={14} />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                    </div>
                  ) : imageLoading[index] ? (
                    <div className={styles.imagePlaceholder}>
                      <Loader2 className="spinner" size={20} />
                      <span>画像を生成中...</span>
                    </div>
                  ) : imageErrors[index] ? (
                    <button
                      className={styles.imageRetryBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        generateStepImage(index);
                      }}
                    >
                      <RefreshCw size={14} /> 再試行
                    </button>
                  ) : null}
                  {imageErrors[index] && <p className={styles.imageError}>{imageErrors[index]}</p>}
                </div>
              )}

              <p className={styles.stepText}>{steps[index]}</p>

              {currentMeta?.seconds != null && (
                <div className={`${styles.timerBox} ${styles.noTap}`}>
                  <span className={styles.timerClock}>
                    {formatClock(timerRemaining ?? currentMeta.seconds)}
                  </span>
                  <button
                    className={styles.timerBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimerRunning((r) => !r);
                    }}
                  >
                    {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                    {timerRunning ? "一時停止" : "タイマー開始"}
                  </button>
                </div>
              )}

              <div className={styles.tapHint}>画面タップ：右で次へ / 左で戻る</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.controls}>
        <button className={styles.navBtn} onClick={goPrev} disabled={index === 0 || finished}>
          <ChevronLeft size={20} />
        </button>

        <button className={styles.navBtn} onClick={goNext} disabled={finished}>
          {index === total - 1 ? <Check size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {showCookedModal && (
        <CookedModal
          recipeTitle={title}
          ingredients={ingredients || []}
          onClose={() => setShowCookedModal(false)}
          onSuccess={() => onClose()}
        />
      )}
    </motion.div>
  );
}
