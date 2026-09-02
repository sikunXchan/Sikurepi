"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Loader2, Sparkles, RefreshCw, Trash2, ChevronDown, ChevronUp, ShoppingCart, Crown, X, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  getRecentLocalRecipeNames,
  addLocalShoppingItem,
  getLocalWeekPlan,
  setLocalWeekPlanEntries,
  removeLocalWeekPlanEntry,
  getFreeGenerationsUsed,
  incrementFreeGenerationsUsed,
  isIngredientMissing,
  FREE_WEEKLY_PLAN_GENERATIONS,
  Ingredient,
  UserProfile,
  MealSlot,
  WeeklyPlanEntry,
} from "@/lib/storage";
import { isNativeApp, hasPremiumEntitlement, purchasePremium } from "@/lib/purchases";
import styles from "./MealPlan.module.css";

const SLOT_LABEL: Record<MealSlot, string> = { lunch: "☀️ 昼", dinner: "🌙 夜" };
const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
const SLOTS: MealSlot[] = ['lunch', 'dinner'];

type DayInfo = { date: string; label: string };

function buildDays(): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const date = d.toISOString().split('T')[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY[d.getDay()]})`;
    days.push({ date, label });
  }
  return days;
}

const chip = (active: boolean): CSSProperties => ({
  background: active ? 'var(--primary)' : 'var(--card-bg-solid)',
  color: active ? '#ffffff' : 'var(--foreground)',
  border: '1px solid var(--border)',
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
});

const iconBtn: CSSProperties = {
  background: 'rgba(0,0,0,0.04)',
  border: 'none',
  borderRadius: 8,
  padding: 6,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function MealPlanPage() {
  const [days] = useState<DayInfo[]>(() => buildDays());
  const [active, setActive] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    buildDays().forEach(d => {
      init[`${d.date}_lunch`] = false;
      init[`${d.date}_dinner`] = true;
    });
    return init;
  });
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getLocalUserProfile());
  const [generating, setGenerating] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weeklyTargets, setWeeklyTargets] = useState<{ calories: number; protein_g: number; fat_g: number; carbs_g: number } | null>(null);
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("storage-updated", handleUpdate);
    if (isNativeApp()) {
      hasPremiumEntitlement().then(setIsPremium);
    }
    return () => window.removeEventListener("storage-updated", handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = () => {
    setIngredients(getLocalIngredients());
    setProfile(getLocalUserProfile());
    const dateSet = new Set(days.map(d => d.date));
    setPlan(getLocalWeekPlan().filter(e => dateSet.has(e.date)));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleSlot = (date: string, slot: MealSlot) => {
    setActive(prev => ({ ...prev, [`${date}_${slot}`]: !prev[`${date}_${slot}`] }));
  };

  const toggleDay = (date: string, on: boolean) => {
    setActive(prev => ({ ...prev, [`${date}_lunch`]: on, [`${date}_dinner`]: on }));
  };

  const activeSlots = () => {
    const list: { date: string; mealSlot: MealSlot }[] = [];
    days.forEach(d => {
      SLOTS.forEach(slot => {
        if (active[`${d.date}_${slot}`]) list.push({ date: d.date, mealSlot: slot });
      });
    });
    return list;
  };

  const buildPayload = (slots: { date: string; mealSlot: MealSlot }[]) => {
    const currentClimate = getLocalClimateState();
    const recentHistory = getRecentLocalRecipeNames(10);
    return {
      slots,
      ingredients: ingredients.map(i => i.name),
      pinnedIngredients: ingredients.filter(i => i.is_pinned).map(i => i.name),
      userProfile: {
        ...profile,
        tastePreferences: profile.tastePreferences || [],
        excludedIngredients: profile.excludedIngredients || [],
        cookingStyles: profile.cookingStyles || [],
      },
      climate: profile.enableClimate !== false ? currentClimate : undefined,
      recentHistory,
      mode: ingredients.length > 0 ? 'inventory' : 'free',
    };
  };

  type ApiPlanItem = {
    date: string;
    meal_slot: MealSlot;
    title: string;
    time: string;
    genre?: string | null;
    dish_badge?: string | null;
    ingredients: { name: string; amount: string }[];
    steps: string[];
    tips: string;
    nutrition?: { calories: number; protein_g: number; fat_g: number; carbs_g: number } | null;
  };

  const mapPlanItem = (r: ApiPlanItem): WeeklyPlanEntry => ({
    date: r.date,
    mealSlot: r.meal_slot,
    recipe: {
      title: r.title,
      time: r.time,
      genre: r.genre,
      dish_badge: r.dish_badge,
      ingredients: r.ingredients,
      steps: r.steps,
      tips: r.tips,
      nutrition: r.nutrition,
    },
  });

  const handleGenerate = async () => {
    const slots = activeSlots();
    if (slots.length === 0) {
      setErrorMsg("少なくとも1つの日付・食事枠を選んでください");
      return;
    }
    if (isNativeApp() && !isPremium && getFreeGenerationsUsed() >= FREE_WEEKLY_PLAN_GENERATIONS) {
      setShowPaywall(true);
      return;
    }
    setGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/recipes/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(slots)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "週間献立の生成に失敗しました");

      const entries: WeeklyPlanEntry[] = (data.plan || []).map(mapPlanItem);
      setLocalWeekPlanEntries(entries);
      setWeeklyTargets(data.weeklyTargets || null);
      if (isNativeApp() && !isPremium) incrementFreeGenerationsUsed();
      loadData();
      showToast(`🪄 ${entries.length}食分の献立を生成しました！`);
    } catch (err: any) {
      setErrorMsg(err.message || "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handlePurchasePremium = async () => {
    setPurchasing(true);
    setPurchaseError("");
    try {
      const result = await purchasePremium();
      if (result.success) {
        setIsPremium(true);
        setShowPaywall(false);
        showToast("👑 プレミアムプランへようこそ！これから週間献立を無制限に生成できます");
      } else if (result.error) {
        setPurchaseError(result.error);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRegenerateSlot = async (date: string, mealSlot: MealSlot) => {
    const key = `${date}_${mealSlot}`;
    setRegeneratingKey(key);
    setErrorMsg("");
    try {
      const res = await fetch("/api/recipes/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload([{ date, mealSlot }])),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "作り直しに失敗しました");
      const r = (data.plan || [])[0];
      if (!r) throw new Error("レシピが見つかりませんでした");
      setLocalWeekPlanEntries([mapPlanItem(r)]);
      loadData();
      showToast("🔄 この1食を作り直しました");
    } catch (err: any) {
      showToast(err.message || "作り直しに失敗しました");
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleRemoveSlot = (date: string, mealSlot: MealSlot) => {
    removeLocalWeekPlanEntry(date, mealSlot);
    loadData();
  };

  const handleAddMissingToShopping = () => {
    const haveNames = ingredients.map(i => i.name.trim().toLowerCase());
    const needed = new Map<string, string>();
    plan.forEach(entry => {
      (entry.recipe.ingredients || []).forEach(item => {
        const key = item.name.trim().toLowerCase();
        if (!key) return;
        const already = haveNames.some(h => key.includes(h) || h.includes(key));
        if (!already) needed.set(key, item.name.trim());
      });
    });
    if (needed.size === 0) {
      showToast("在庫だけで足りています！");
      return;
    }
    needed.forEach(name => addLocalShoppingItem(name));
    showToast(`🛒 不足食材 ${needed.size}件を買い物リストに追加しました！`);
  };

  const handlePinToShopping = (slotKey: string, ingredientName: string) => {
    const pinKey = `${slotKey}-${ingredientName}`;
    if (pinnedToShoppingSet.has(pinKey)) return;
    addLocalShoppingItem(ingredientName);
    setPinnedToShoppingSet(prev => new Set(prev).add(pinKey));
    showToast(`📌 「${ingredientName}」を買い物リストに追加しました！`);
  };

  const weeklyNutritionSum = () => {
    let calories = 0, protein_g = 0, fat_g = 0, carbs_g = 0;
    plan.forEach(e => {
      const n = e.recipe.nutrition;
      if (n) { calories += n.calories || 0; protein_g += n.protein_g || 0; fat_g += n.fat_g || 0; carbs_g += n.carbs_g || 0; }
    });
    return { calories, protein_g, fat_g, carbs_g };
  };

  const findEntry = (date: string, mealSlot: MealSlot) => plan.find(e => e.date === date && e.mealSlot === mealSlot);

  const hasAnyRow = days.some(d => active[`${d.date}_lunch`] || active[`${d.date}_dinner`] || findEntry(d.date, 'lunch') || findEntry(d.date, 'dinner'));

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(31, 41, 55, 0.95)', color: 'white', padding: '8px 18px',
          borderRadius: 9999, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999, pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>📅 週間献立プランナー</h1>
        {isNativeApp() && isPremium && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#b45309', background: 'rgba(245, 158, 11, 0.12)', padding: '4px 10px', borderRadius: 20 }}>
            <Crown size={13} /> プレミアム
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8 }}>
        いらない日・食事はチェックを外してから生成してください。今日から7日分、在庫とPFC目標に合わせてAIが自動で組みます。
      </p>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {days.map(d => {
            const lunchOn = !!active[`${d.date}_lunch`];
            const dinnerOn = !!active[`${d.date}_dinner`];
            return (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                <span style={{ width: 64, fontSize: 13, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>{d.label}</span>
                <button type="button" onClick={() => toggleSlot(d.date, 'lunch')} style={chip(lunchOn)}>☀️ 昼</button>
                <button type="button" onClick={() => toggleSlot(d.date, 'dinner')} style={chip(dinnerOn)}>🌙 夜</button>
                <button
                  type="button"
                  onClick={() => toggleDay(d.date, false)}
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  この日はいらない
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary"
          style={{ width: '100%', padding: 12, fontSize: 14, fontWeight: 700, marginTop: 14 }}
        >
          {generating ? (
            <>
              <Loader2 className="spinner" size={18} />
              AIシェフが週間献立を考案中...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              🪄 週間献立を自動生成
            </>
          )}
        </button>
        {isNativeApp() && !isPremium && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            無料プラン: 残り{Math.max(0, FREE_WEEKLY_PLAN_GENERATIONS - getFreeGenerationsUsed())}回生成できます
          </p>
        )}
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 12, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      {plan.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>📊 週間PFCサマリー（現在の献立合計）</div>
          <NutritionChart nutrition={weeklyNutritionSum()} />
          {weeklyTargets && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
              週間目標目安: {weeklyTargets.calories}kcal / P{weeklyTargets.protein_g}g・F{weeklyTargets.fat_g}g・C{weeklyTargets.carbs_g}g
            </p>
          )}
          <button
            type="button"
            onClick={handleAddMissingToShopping}
            style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--gradient-cool)', color: 'white', border: 'none', borderRadius: 12, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <ShoppingCart size={15} /> 不足食材を買い物リストへ一括追加
          </button>
        </div>
      )}

      {hasAnyRow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {days.map(d => {
            const slotsToShow = SLOTS.filter(s => active[`${d.date}_${s}`] || findEntry(d.date, s));
            if (slotsToShow.length === 0) return null;
            return (
              <div key={d.date}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>{d.label}</div>
                {slotsToShow.map(slot => {
                  const entry = findEntry(d.date, slot);
                  const key = `${d.date}_${slot}`;
                  const isExpanded = expandedKey === key;
                  return (
                    <div key={key} className={styles.slotCard}>
                      {!entry ? (
                        <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                          {SLOT_LABEL[slot]}・未生成
                        </div>
                      ) : (
                        <>
                          <div className={styles.slotHeader} onClick={() => setExpandedKey(isExpanded ? null : key)}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span className={styles.slotBadge}>{SLOT_LABEL[slot]}</span>
                                {entry.recipe.genre && <span className={styles.slotBadge}>{entry.recipe.genre}</span>}
                                {entry.recipe.dish_badge && <span className={styles.slotBadge}>{entry.recipe.dish_badge}</span>}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700 }}>{entry.recipe.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                ⏱ {entry.recipe.time}{entry.recipe.nutrition ? ` ・ ${entry.recipe.nutrition.calories}kcal` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRegenerateSlot(d.date, slot); }}
                                disabled={regeneratingKey === key}
                                title="この1食だけ作り直す"
                                style={iconBtn}
                              >
                                {regeneratingKey === key ? <Loader2 className="spinner" size={14} /> : <RefreshCw size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveSlot(d.date, slot); }}
                                title="この予定を削除"
                                style={iconBtn}
                              >
                                <Trash2 size={14} />
                              </button>
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ padding: '0 14px 14px' }}>
                                  {entry.recipe.nutrition && (
                                    <div style={{ marginBottom: 10 }}>
                                      <NutritionChart nutrition={entry.recipe.nutrition} />
                                    </div>
                                  )}
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>材料（不足分は📌で買い物リストへ）</div>
                                  <ul style={{ fontSize: 12, marginBottom: 10, paddingLeft: 16, listStyle: 'none' }}>
                                    {(entry.recipe.ingredients || []).map((it, i) => {
                                      const missing = isIngredientMissing(it.name, ingredients);
                                      const pinKey = `${key}-${it.name}`;
                                      const isPinned = pinnedToShoppingSet.has(pinKey);
                                      return (
                                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                          {missing && (
                                            <button
                                              type="button"
                                              onClick={() => handlePinToShopping(key, it.name)}
                                              title={isPinned ? '買い物リストに追加済み' : 'ピン留めして買い物リストに追加'}
                                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: isPinned ? 'var(--primary)' : '#ef4444' }}
                                            >
                                              <Pin size={12} fill={isPinned ? 'var(--primary)' : 'none'} />
                                            </button>
                                          )}
                                          <span style={{ color: missing ? '#ef4444' : 'var(--foreground)', fontWeight: missing ? 700 : 400 }}>
                                            {it.name} {it.amount}
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>作り方</div>
                                  <ol style={{ fontSize: 12, color: 'var(--foreground)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {(entry.recipe.steps || []).map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ol>
                                  {entry.recipe.tips && <div className={styles.slotTips}>💡 {entry.recipe.tips}</div>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}
            onClick={() => !purchasing && setShowPaywall(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', background: 'var(--card-bg-solid, #fff)', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}
            >
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                disabled={purchasing}
                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
              <Crown size={40} color="#f59e0b" style={{ marginBottom: 8 }} />
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>プレミアムプラン</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                無料プランの週間献立生成（{FREE_WEEKLY_PLAN_GENERATIONS}回）を使い切りました。プレミアムプランに登録すると、週間献立の自動生成が無制限になります。
              </p>
              {purchaseError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 12 }}>
                  {purchaseError}
                </div>
              )}
              <button
                type="button"
                onClick={handlePurchasePremium}
                disabled={purchasing}
                className="btn-primary"
                style={{ width: '100%', padding: 12, fontSize: 14, fontWeight: 700 }}
              >
                {purchasing ? (<><Loader2 className="spinner" size={16} />処理中...</>) : (<><Crown size={16} />プレミアムプランに登録する</>)}
              </button>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                disabled={purchasing}
                style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 8 }}
              >
                また今度にする
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
