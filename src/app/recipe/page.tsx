"use client";

import { useEffect, useState, useCallback, Fragment, useRef } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Bookmark, Check, Utensils, Pin, Users, Lightbulb, PlayCircle, Sparkles, ShoppingCart, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CookingModeToggle } from "@/components/CookingModeToggle";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import { getApiHeaders } from "@/lib/user";
import styles from "./Recipe.module.css";

type Ingredient = {
  id: number;
  name: string;
  is_pinned: boolean;
};

type RecipeItem = {
  name: string;
  amount: string;
};

type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Recipe = {
  title: string;
  time: string;
  genre?: string;
  ingredients: RecipeItem[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition?: NutritionData | null;
};

type CookingTip = {
  category: string;
  tip: string;
};

const CONDITION_OPTIONS = [
  { id: "low-cal", label: "低カロリー", icon: "🍃" },
  { id: "party", label: "パーティメニュー", icon: "🎉" },
  { id: "gentle", label: "🤒お腹にやさしい", icon: "" },
  { id: "protein", label: "💪ガッツリ高タンパク", icon: "" },
  { id: "fast", label: "⏳超時短 (10分以内)", icon: "" },
];

const SERVINGS_OPTIONS = [5, 4, 3, 2, 1];

const TIP_CATEGORY_COLORS: Record<string, string> = {
  '保存方法': '#20b2aa',
  '調理のコツ': '#ff7849',
  '栄養豆知識': '#8b5cf6',
};

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [showConditions, setShowConditions] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [cookingRecipeIndex, setCookingRecipeIndex] = useState<number | null>(null);
  const [cookingAutoImages, setCookingAutoImages] = useState(false);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<Recipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchIngredients();
    try {
      const saved = localStorage.getItem("cooking_app_last_recipes");
      if (saved) setRecipes(JSON.parse(saved));
      const savedTips = localStorage.getItem("cooking_app_last_tips");
      if (savedTips) setCookingTips(JSON.parse(savedTips));
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cooking_app_model", selectedModel);
    if (selectedModel === 'lily-1.1') {
      fetchHistoryWithNutrition();
    }
  const fetchIngredients = async () => {
    try {
      const res = await fetch("/api/inventory", { headers: getApiHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        const seen = new Set<string>();
        const deduplicated = data.filter((item: Ingredient) => {
          const normalized = item.name.trim().toLowerCase();
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        });
        setIngredients(deduplicated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const addToShoppingList = async (itemName: string) => {
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ name: itemName }),
      });
      if (res.ok) {
        showToast(`🛒 「${itemName}」を買い物リストに追加しました！`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCondition = (label: string) => {
    setSelectedConditions(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    setExpandedIndex(-1);

    const ingredientNames = ingredients.map(i => i.name);
    const pinnedNames = ingredients.filter(i => i.is_pinned).map(i => i.name);

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          ingredients: ingredientNames,
          pinnedIngredients: pinnedNames,
          conditions: selectedConditions,
          instruction,
          servings,
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "生成に失敗しました");

      const newRecipes = data.recipes || [];
      const newTips: CookingTip[] = data.cooking_tips || [];
      setRecipes(newRecipes);
      setCookingTips(newTips);

      localStorage.setItem("cooking_app_last_recipes", JSON.stringify(newRecipes));
      localStorage.setItem("cooking_app_last_tips", JSON.stringify(newTips));

      setSavedSet(new Set());
      if (newTips.length > 0) setShowTips(true);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff7849', '#20b2aa', '#fbbf24']
      });
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getRecipeIcon = (recipe: Recipe) => {
    const timeStr = recipe.time || "";
    const match = timeStr.match(/(\d+)/);
    const minutes = match ? parseInt(match[0], 10) : 10;
    return minutes <= 9 ? "/sub.png" : "/main.png";
  };

  const handleSave = async (index: number) => {
    const recipe = recipes[index];
    if (!recipe || savedSet.has(index)) return;

    setSavingIndex(index);
    try {
      const res = await fetch("/api/saved-recipes", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          title: recipe.title,
          time: recipe.time ?? '',
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          tips: recipe.tips ?? '',
          image_url: null,
          nutrition: recipe.nutrition ?? null,
          genre: recipe.genre ?? null,
        }),
      });

      if (res.ok) {
        setSavedSet(prev => new Set(prev).add(index));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }
    } catch (e: any) {
    } catch (e: any) {
      console.error(e);
      alert("保存エラー: " + e.message);
    } finally {
      setSavingIndex(null);
    }
  };

  const activeConditionsText = selectedConditions.length > 0
    ? ` (${selectedConditions.length}件選択中)`
    : "";

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(31, 41, 55, 0.95)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 24,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>🍳 AIレシピ提案</h1>
        <CookingModeToggle />
      </div>

      <div className={styles.inputSection}>
        <div className={styles.inventorySummary}>
          現在の在庫: {ingredients.length > 0 ? ingredients.map((i, idx) => (
            <Fragment key={i.id || idx}>
              {i.is_pinned ? <strong>{i.name}<Pin size={14} fill="#ef4444" color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }} /></strong> : i.name}
              {idx < ingredients.length - 1 ? ", " : ""}
            </Fragment>
          )) : "なし"}
        </div>

        <div className={styles.conditionsAccordion}>
          <button
            className={styles.conditionsHeader}
            onClick={() => setShowConditions(!showConditions)}
          >
            <span>✨ 条件オプションを選択 {activeConditionsText}</span>
            {showConditions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence>
            {showConditions && (
              <motion.div
                className={styles.conditionsContent}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.conditionsContainer}>
                  {CONDITION_OPTIONS.map((opt) => {
                    const isActive = selectedConditions.includes(opt.label);
                    return (
                      <button
                        key={opt.id}
                        className={`${styles.conditionToggle} ${isActive ? styles.conditionActive : ""}`}
                        onClick={() => toggleCondition(opt.label)}
                      >
                        {opt.icon && <span>{opt.icon}</span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.servingsRow}>
                  <div className={styles.servingsHeader}>
                    <label className={styles.servingsLabel}>
                      <Utensils size={18} color="#ff7849" />
                      <span>🍽️ 分量を調整</span>
                    </label>
                    <div className={styles.servingsHint}>
                      レシピの人数分を指定できます
                    </div>
                  </div>
                  <select
                    className={styles.servingsSelect}
                    value={servings ?? ""}
                    onChange={(e) => setServings(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">指定なし (材料のみで提案)</option>
                    {SERVINGS_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}人分 の分量で提案</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          placeholder="カスタム指示 (任意) 例: 子供が喜ぶ味付け、辛さ控えめなど"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          className={styles.textarea}
        />

        <button
          className={styles.generateBtn}
          onClick={generateRecipes}
          disabled={loading || ingredients.length === 0}
        >
          {loading ? <Loader2 className="spinner" size={20} /> : <ChefHat size={20} />}
          レシピを提案する
        </button>
      </div>

      {errorMsg && (
        <div className={styles.errorAlert}>
          {errorMsg}
        </div>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.cookingAnimation}>
            <span className={styles.emoji}>🍳</span>
            <span className={styles.emoji}>🥕</span>
            <span className={styles.emoji}>🔪</span>
            <span className={styles.emoji}>🥘</span>
          </div>
          <p className={styles.loadingText}>在庫から最高のレシピを考案中...</p>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>✨ 提案結果</h2>
          </div>

          {recipes.map((recipe, index) => {
            const isExpanded = expandedIndex === index;
            const isSaved = savedSet.has(index);
            return (
              <div key={index} className={styles.recipeCard}>
                <div className={styles.recipeHeader} onClick={() => setExpandedIndex(isExpanded ? -1 : index)}>
                  <img
                    src={getRecipeIcon(recipe)}
                    alt={recipe.title}
                    className={styles.recipeIcon}
                  />

                  <div className={styles.recipeTitleGroup}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                    {recipe.genre && (
                      <span className={styles.genreBadge}>{recipe.genre}</span>
                    )}
                  </div>

                  <div className={styles.recipeActions}>
                    <button
                      className={isSaved ? styles.savedBtn : styles.saveBtn}
                      onClick={(e) => { e.stopPropagation(); handleSave(index); }}
                      disabled={isSaved || savingIndex === index}
                    >
                      {savingIndex === index ? (
                        <Loader2 className="spinner" size={14} />
                      ) : isSaved ? (
                        <><Check size={14} /><span>保存済み</span></>
                      ) : (
                        <><Bookmark size={14} /><span>保存</span></>
                      )}
                    </button>

                    <button className={styles.chevronBtn}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.recipeBody}>
                    {recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <h3 className={styles.nutritionTitle}>📊 栄養バランス（1人分目安）</h3>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    <div className={styles.section}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3>材料・調味料</h3>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>💡 タップで買い物リストへ追加</span>
                      </div>
                      <ul className={styles.ingredientList}>
                        {recipe.ingredients.map((item, i) => (
                          <li
                            key={i}
                            style={{ cursor: 'pointer', transition: 'background 0.2s', padding: '6px 8px', borderRadius: 8 }}
                            title="タップして買い物リストに追加"
                            onClick={() => addToShoppingList(item.name)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ShoppingCart size={13} style={{ color: '#20b2aa', opacity: 0.6 }} />
                              {item.name}
                            </span>
                            <span className="text-muted">{item.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.stepsSectionHeader}>
                        <h3>作り方</h3>
                        <div className={styles.stepsActionsRow}>
                          <button
                            className={styles.startCookingBtn}
                            onClick={(e) => { e.stopPropagation(); setCookingRecipeIndex(index); setCookingAutoImages(false); }}
                          >
                            <PlayCircle size={16} />
                            タイムラインで調理
                          </button>
                          <button
                            className={styles.startCookingAlphaBtn}
                            onClick={(e) => { e.stopPropagation(); setCookingRecipeIndex(index); setCookingAutoImages(true); }}
                          >
                            <Sparkles size={16} />
                            タイムラインα
                          </button>
                        </div>
                      </div>
                      <ol className={styles.stepList}>
                        {recipe.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && (
                      <div className={styles.tipsBox}>
                        <strong>💡 ポイント: </strong> {recipe.tips}
                      </div>
                    )}

                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                      <button
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          background: 'linear-gradient(135deg, #ff7849 0%, #ff5722 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 12,
                          padding: '10px 14px',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(255, 120, 73, 0.25)',
                        }}
                        onClick={() => setCookedModalRecipe(recipe)}
                      >
                        🍳 この料理を作った！（在庫を減らす）
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cooking Tips Section */}
      {!loading && cookingTips.length > 0 && (
        <div className={styles.cookingTipsSection}>
          <button
            className={styles.cookingTipsHeader}
            onClick={() => setShowTips(!showTips)}
          >
            <span className={styles.cookingTipsTitle}>
              <Lightbulb size={18} color="#8b5cf6" />
              料理のコツ &amp; 豆知識
            </span>
            {showTips ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence>
            {showTips && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={styles.cookingTipsList}
              >
                {cookingTips.map((tip, i) => (
                  <div key={i} className={styles.cookingTipItem}>
                    <span
                      className={styles.tipCategoryBadge}
                      style={{ background: `${TIP_CATEGORY_COLORS[tip.category] || '#8b5cf6'}20`, color: TIP_CATEGORY_COLORS[tip.category] || '#8b5cf6' }}
                    >
                      {tip.category}
                    </span>
                    <p className={styles.tipText}>{tip.tip}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {cookingRecipeIndex !== null && recipes[cookingRecipeIndex] && (
          <CookingSession
            title={recipes[cookingRecipeIndex].title}
            steps={recipes[cookingRecipeIndex].steps}
            ingredients={recipes[cookingRecipeIndex].ingredients}
            autoGenerateImages={cookingAutoImages}
            onClose={() => setCookingRecipeIndex(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cookedModalRecipe && (
          <CookedModal
            recipeTitle={cookedModalRecipe.title}
            ingredients={cookedModalRecipe.ingredients}
            onClose={() => setCookedModalRecipe(null)}
            onSuccess={() => {
              fetchIngredients();
              showToast("🎉 自炊記録とお使いの在庫を更新しました！");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
