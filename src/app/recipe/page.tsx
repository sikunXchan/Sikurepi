"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronUp, Bookmark, Check, Plus, Lightbulb, PlayCircle, Sparkles, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import ClimateBar from "@/components/ClimateBar";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import IngredientIcon from "@/components/IngredientIcon";
import PageHeader from "@/components/PageHeader";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  getLocalSavedRecipes,
  saveLocalRecipe,
  addLocalShoppingItem,
  getRecentLocalRecipeNames,
  saveLocalTip,
  isIngredientMissing,
  getLocalLastRecipeGeneration,
  setLocalLastRecipeGeneration,
  DEFAULT_USER_PROFILE,
  Ingredient,
  UserProfile,
  ClimateState,
  NutritionData
} from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./Recipe.module.css";

type RecipeItem = {
  name: string;
  amount: string;
};

type Recipe = {
  title: string;
  time: string;
  genre?: string;
  climate_badge?: string;
  dish_badge?: string;
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

const TEMPLATES = [
  { emoji: '⏳', key: 'quick', query: '10分以内で手早く作れる時短おかず' },
  { emoji: '🍱', key: 'bento', query: '冷めても美味しく汁気の出にくいお弁当用おかず' },
  { emoji: '💪', key: 'meaty', query: 'ご飯が進むボリューミーなスタミナ肉料理' },
  { emoji: '🥗', key: 'healthy', query: '野菜たっぷり高タンパク低カロリーなヘルシー料理' },
  { emoji: '🍲', key: 'soup', query: '野菜や肉の旨味が溶け込んだ温まる鍋・スープ料理' },
  { emoji: '🍰', key: 'sweets', query: 'フライパンや電子レンジで作れる簡単デザート・おやつ' },
  { emoji: '🧽', key: 'easyClean', query: '使う鍋・フライパン・ボウル・皿の数が最小限になる、洗い物が少ないレシピ' },
] as const;

const TIP_CATEGORY_COLORS: Record<string, string> = {
  '保存方法': '#20b2aa',
  '調理のコツ': '#ff6f91',
  '栄養豆知識': '#8b5cf6',
};

export default function RecipePage() {
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  // getLocalUserProfile()を直接初期値に渡すとSSR時のデフォルト値とクライアント
  // 初回レンダー時の実データが食い違いハイドレーションミスマッチになるため、
  // 安全な初期値を渡し実データはloadLocalData()のuseEffectでのみ取得する
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [creationMode, setCreationMode] = useState<'inventory' | 'free'>('inventory');
  const [instruction, setInstruction] = useState("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [cookingRecipeIndex, setCookingRecipeIndex] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<Recipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  // マイページの人数設定はデフォルト値として使うが、生成のたびに個別に変えられるようにする
  const [sessionServings, setSessionServings] = useState<number>(2);

  useEffect(() => {
    loadLocalData();
    const handleUpdate = () => loadLocalData();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  // 前回の生成結果を復元する（別タブへ移動して戻ってきても消えないように）。
  // マウント時に一度だけ行い、storage-updated発火のたびに入力中のフォームを
  // 上書きしてしまわないようにする。
  useEffect(() => {
    const cached = getLocalLastRecipeGeneration();
    if (cached) {
      setRecipes(cached.recipes);
      setCookingTips(cached.cookingTips);
      setExpandedIndex(cached.expandedIndex);
      setSavedSet(new Set(cached.savedIndices));
      setCreationMode(cached.creationMode);
      setInstruction(cached.instruction);
      setSelectedIngredientIds(cached.selectedIngredientIds);
      setSessionServings(cached.servings);
    } else {
      setSessionServings(getLocalUserProfile().servings || 2);
    }
  }, []);

  const loadLocalData = () => {
    const list = getLocalIngredients();
    setIngredients(list);
    setUserProfile(getLocalUserProfile());
    const pinned = list.filter(i => i.is_pinned).map(i => i.id);
    setSelectedIngredientIds(prev => prev.length === 0 ? pinned : prev);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleIngredientSelection = (id: number) => {
    setSelectedIngredientIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApplyTemplate = (query: string) => {
    setInstruction(query);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg("");
    setRecipes([]);
    setCookingTips([]);
    setSavedSet(new Set());

    try {
      const selectedNames = creationMode === 'inventory'
        ? ingredients.filter(i => selectedIngredientIds.length === 0 ? true : selectedIngredientIds.includes(i.id)).map(i => i.name)
        : [];

      const currentClimate = getLocalClimateState();
      const recentRecipes = getRecentLocalRecipeNames(5);

      const payload = {
        ingredients: selectedNames,
        instruction: instruction.trim() || undefined,
        servings: sessionServings,
        userProfile: {
          ...userProfile,
          tastePreferences: userProfile.tastePreferences || [],
          excludedIngredients: userProfile.excludedIngredients || [],
          cookingStyles: userProfile.cookingStyles || [],
          dietaryRestrictions: userProfile.dietaryRestrictions || [],
          preferredGenres: userProfile.preferredGenres || [],
        },
        climate: userProfile.enableClimate !== false ? currentClimate : undefined,
        recentRecipes,
        mode: creationMode === 'free' ? 'free' : 'inventory',
      };

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.recipe.errorGenerateFailed);
      }

      if (data.recipes && data.recipes.length > 0) {
        setRecipes(data.recipes);
        setExpandedIndex(0);
      } else {
        throw new Error(t.recipe.errorNoRecipes);
      }

      const tips = data.cooking_tips && data.cooking_tips.length > 0 ? data.cooking_tips : [];
      if (tips.length > 0) {
        setCookingTips(tips);
        setShowTips(true);
        // Tips を豆知識ライブラリへ自動蓄積
        tips.forEach((t: CookingTip) => {
          saveLocalTip(t.category, t.tip);
        });
      }

      // 別タブへ移動しても前回の生成結果が消えないように保存しておく
      setLocalLastRecipeGeneration({
        recipes: data.recipes,
        cookingTips: tips,
        expandedIndex: 0,
        savedIndices: [],
        creationMode,
        instruction,
        selectedIngredientIds,
        servings: sessionServings,
        savedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || t.recipe.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = (index: number) => {
    const r = recipes[index];
    if (!r) return;

    setSavingIndex(index);
    try {
      saveLocalRecipe({
        title: r.title,
        time: r.time,
        ingredients: r.ingredients,
        steps: r.steps,
        tips: r.tips,
        image_url: r.image_url,
        nutrition: r.nutrition || null,
        genre: r.genre || null,
        dish_badge: r.dish_badge || null,
      });

      setSavedSet(prev => new Set(prev).add(index));

      // キャッシュ上の保存済みフラグも更新しておく（タブを移動して戻っても保存済み表示が残るように）
      const cached = getLocalLastRecipeGeneration();
      if (cached) {
        setLocalLastRecipeGeneration({
          ...cached,
          savedIndices: Array.from(new Set([...cached.savedIndices, index])),
        });
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#ff6f91', '#20b2aa', '#fbbf24', '#f472b6'],
      });
      showToast(t.recipe.savedToast(r.title));
    } catch (e) {
      console.error(e);
      showToast(t.recipe.saveFailedToast);
    } finally {
      setSavingIndex(null);
    }
  };

  const handlePinToShopping = (recipeIndex: number, ingredientName: string) => {
    const key = `${recipeIndex}-${ingredientName}`;
    if (pinnedToShoppingSet.has(key)) return;
    addLocalShoppingItem(ingredientName);
    setPinnedToShoppingSet(prev => new Set(prev).add(key));
    showToast(t.recipe.pinnedToShoppingToast(ingredientName));
  };

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
          padding: '8px 18px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      {/* ヘッダーエリア */}
      <PageHeader
        title={t.recipe.title}
        subtitle={t.recipe.subtitle}
        mascot="bear_hero"
        actions={
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setIsSettingsOpen(true)}
            title={t.recipe.settingsButtonTitle}
          >
            <Settings size={18} />
          </button>
        }
      />

      <ClimateBar />

      {/* AI作成モード切り替え (在庫から作成 ⇄ 自由作成) */}
      <div style={{
        display: 'flex',
        background: 'var(--card-bg-solid)',
        border: '1px solid var(--glass-border)',
        borderRadius: 16,
        padding: 4,
        gap: 4,
        marginBottom: 12,
      }}>
        <button
          type="button"
          onClick={() => setCreationMode('inventory')}
          style={{
            flex: 1,
            background: creationMode === 'inventory' ? 'var(--gradient-primary)' : 'transparent',
            color: creationMode === 'inventory' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            boxShadow: 'none',
            borderRadius: 12,
            padding: '10px 8px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {t.recipe.modeInventory}
        </button>
        <button
          type="button"
          onClick={() => setCreationMode('free')}
          style={{
            flex: 1,
            background: creationMode === 'free' ? 'var(--gradient-primary)' : 'transparent',
            color: creationMode === 'free' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            boxShadow: 'none',
            borderRadius: 12,
            padding: '10px 8px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {t.recipe.modeFree}
        </button>
      </div>

      {/* 設定・リクエストフォーム */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {/* 補助テンプレート */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)', marginBottom: 8 }}>
            {t.recipe.templatesLabel}
          </div>
          {/* モックアップに合わせて、アイコンを上・ラベルを下に置いた横スクロールのタイルにする */}
          <div className={styles.templateRow}>
            {TEMPLATES.map((tmpl, i) => {
              const selected = instruction === tmpl.query;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.query)}
                  className={`${styles.templateTile} ${selected ? styles.templateTileActive : ''}`}
                >
                  <span className={styles.templateEmoji}>{tmpl.emoji}</span>
                  <span className={styles.templateLabel}>{t.recipe.templates[tmpl.key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自由リクエスト入力 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)', display: 'block', marginBottom: 8 }}>
            {t.recipe.requestLabel}
          </label>
          <textarea
            rows={2}
            placeholder={t.recipe.requestPlaceholder}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </div>

        {/* 人数 (マイページの設定をデフォルトに使いつつ、生成のたびに個別に変更できる。大人数の集まり等も想定し1〜15人分まで対応) */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)', display: 'block', marginBottom: 8 }}>
            {t.recipe.servingsLabel}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 12px' }}>
            <button
              type="button"
              onClick={() => setSessionServings(prev => Math.max(1, prev - 1))}
              disabled={sessionServings <= 1}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'var(--gradient-primary)', color: 'white',
                fontSize: 20, fontWeight: 900, cursor: 'pointer',
                opacity: sessionServings <= 1 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              −
            </button>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#ea580c', minWidth: 64, textAlign: 'center' }}>
              {t.recipe.servingsUnit(sessionServings)}
            </span>
            <button
              type="button"
              onClick={() => setSessionServings(prev => Math.min(15, prev + 1))}
              disabled={sessionServings >= 15}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'var(--gradient-primary)', color: 'white',
                fontSize: 20, fontWeight: 900, cursor: 'pointer',
                opacity: sessionServings >= 15 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ＋
            </button>
          </div>
        </div>

        {/* 在庫選択 (在庫モード時のみ) */}
        {creationMode === 'inventory' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--foreground)', marginBottom: 8 }}>
              {t.recipe.selectIngredientsLabel}
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 6 }}>{t.recipe.selectIngredientsHint}</span>
            </div>
            {ingredients.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ingredients.map(ing => {
                  const isSelected = selectedIngredientIds.includes(ing.id);
                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => toggleIngredientSelection(ing.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: isSelected ? 'var(--primary)' : 'var(--card-bg-solid)',
                        color: isSelected ? '#ffffff' : 'var(--foreground)',
                        border: '1px solid var(--border)',
                        padding: '4px 10px 4px 6px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <IngredientIcon name={ing.name} size={20} />
                      {ing.is_pinned && '📌 '}
                      {ing.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {t.recipe.noIngredients}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              {t.recipe.generateLoading}
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {t.recipe.generateButton}
            </>
          )}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
          <motion.img
            src="/mascot/bear_delivering.png"
            alt={t.recipe.loadingAlt}
            width={96}
            height={96}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.recipe.loadingText}</p>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 12, color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      {/* レシピ一覧表示 */}
      {recipes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.resultsBanner}>
            <img src="/mascot/bear_serving.png" alt="" width={52} height={52} />
            <div>
              <div className={styles.resultsBannerTitle}>{t.recipe.resultsBannerTitle(recipes.length)}</div>
              <div className={styles.resultsBannerSub}>{t.recipe.resultsBannerSub}</div>
            </div>
          </div>
          {recipes.map((recipe, index) => {
            const isExpanded = expandedIndex === index;
            const isSaved = savedSet.has(index);

            return (
              <div key={index} className={styles.recipeCard}>
                <div
                  className={styles.cardHeader}
                  onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                >
                  <div className={styles.titleInfo}>
                    <div className={styles.badgeRow}>
                      {recipe.genre && (
                        <span className={styles.genreBadge}>{recipe.genre}</span>
                      )}
                      {recipe.climate_badge && (
                        <span className={styles.climateBadge}>🌤️ {recipe.climate_badge}</span>
                      )}
                      {recipe.dish_badge && (
                        <span className={styles.climateBadge}>{recipe.dish_badge}</span>
                      )}
                    </div>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                    {recipe.ingredients.length > 0 && (
                      <div className={styles.ingredientIconRow}>
                        {recipe.ingredients.map((item, i) => (
                          <IngredientIcon key={i} name={item.name} size={24} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      className={isSaved ? styles.savedBtn : styles.saveBtn}
                      onClick={(e) => { e.stopPropagation(); handleSaveRecipe(index); }}
                      disabled={isSaved || savingIndex === index}
                    >
                      {isSaved ? <Check size={14} /> : <Bookmark size={14} />}
                      {isSaved ? t.recipe.saved : t.recipe.save}
                    </button>
                    <button className={styles.expandBtn}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.cardContent}>
                    {recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    {/* 材料リスト（不足分は赤字＋「追加」ボタンで買い物リストへ） */}
                    <div className={styles.section}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h3>{t.recipe.ingredientsSectionTitle}</h3>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.recipe.ingredientsSectionHint}</span>
                      </div>
                      <ul className={styles.ingredientList}>
                        {recipe.ingredients.map((item, i) => {
                          const missing = isIngredientMissing(item.name, ingredients, userProfile.assumeSeasoningsAvailable);
                          const pinKey = `${index}-${item.name}`;
                          const isPinned = pinnedToShoppingSet.has(pinKey);
                          return (
                            <li key={i} className={missing ? styles.ingredientMissing : undefined}>
                              <span className={styles.ingredientName}>
                                <IngredientIcon name={item.name} size={30} />
                                <span style={{ color: missing ? '#d92b3f' : 'var(--foreground)', fontWeight: missing ? 800 : 600 }}>
                                  {item.name}
                                </span>
                              </span>
                              <span className={styles.ingredientRight}>
                                <span className={styles.ingredientAmount}>{item.amount}</span>
                                {missing && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handlePinToShopping(index, item.name); }}
                                    className={isPinned ? styles.addedBtn : styles.addToCartBtn}
                                    disabled={isPinned}
                                  >
                                    {isPinned ? <Check size={15} /> : <Plus size={15} />}
                                    {isPinned ? t.recipe.addedToShopping : t.recipe.addToShopping}
                                  </button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* 作り方 */}
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <h3>{t.recipe.stepsSectionTitle}</h3>
                        <button
                          className={styles.startCookingBtn}
                          onClick={(e) => { e.stopPropagation(); setCookingRecipeIndex(index); }}
                        >
                          <PlayCircle size={16} />
                          {t.recipe.cookingModeButton}
                        </button>
                      </div>
                      <ol className={styles.stepList}>
                        {recipe.steps.map((step, i) => (
                          <li key={i}>
                            <span className={styles.stepNumber}>{i + 1}</span>
                            <span className={styles.stepText}>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && (
                      <div className={styles.tipsBox}>
                        <strong>{t.recipe.tipsPrefix}</strong> {recipe.tips}
                      </div>
                    )}

                    {/* 調理完了ボタン (在庫消費 & PFC累積) */}
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <button
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          background: 'linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 3px 10px rgba(255, 111, 145, 0.25)',
                        }}
                        onClick={() => setCookedModalRecipe(recipe)}
                      >
                        {t.recipe.cookedButton}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 豆知識セクション */}
      {!loading && cookingTips.length > 0 && (
        <div className={styles.cookingTipsSection}>
          <button
            className={styles.cookingTipsHeader}
            onClick={() => setShowTips(!showTips)}
          >
            <span className={styles.cookingTipsTitle}>
              <Lightbulb size={18} color="#8b5cf6" />
              {t.recipe.cookingTipsHeader}
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

      {/* クッキングセッション */}
      <AnimatePresence>
        {cookingRecipeIndex !== null && recipes[cookingRecipeIndex] && (
          <CookingSession
            title={recipes[cookingRecipeIndex].title}
            steps={recipes[cookingRecipeIndex].steps}
            ingredients={recipes[cookingRecipeIndex].ingredients}
            onClose={() => setCookingRecipeIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* 調理完了モーダル */}
      <AnimatePresence>
        {cookedModalRecipe && (
          <CookedModal
            recipe={cookedModalRecipe}
            onClose={() => setCookedModalRecipe(null)}
            onCompleted={() => {
              loadLocalData();
              showToast(t.recipe.cookedCompletedToast);
            }}
          />
        )}
      </AnimatePresence>

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadLocalData}
      />
    </div>
  );
}
