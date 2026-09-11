"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronUp, Bookmark, Check, Plus, Lightbulb, PlayCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import ClimateBar from "@/components/ClimateBar";
import KitchenLoader from "@/components/KitchenLoader";
import IngredientIcon from "@/components/IngredientIcon";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import UiIcon from "@/components/UiIcon";
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
  consumePendingDailyPickHandoff,
  DEFAULT_USER_PROFILE,
  CATEGORY_ORDER,
  CATEGORY_ICON_SLUGS,
  Ingredient,
  UserProfile,
  NutritionData
} from "@/lib/storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getTrayTheme } from "@/lib/trayThemes";
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
  course?: string;
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
  { iconSlug: 'bento', key: 'bento', query: '冷めても美味しく汁気の出にくいお弁当用おかず' },
  { iconSlug: 'stamina', key: 'meaty', query: 'ご飯が進むボリューミーなスタミナ肉料理' },
  { iconSlug: 'healthy', key: 'healthy', query: '野菜たっぷり高タンパク低カロリーなヘルシー料理' },
  { iconSlug: 'hotpot', key: 'soup', query: '野菜や肉の旨味が溶け込んだ温まる鍋・スープ料理' },
  { iconSlug: 'sweets_template', key: 'sweets', query: 'フライパンや電子レンジで作れる簡単デザート・おやつ' },
  { iconSlug: 'dishwashing', key: 'easyClean', query: '使う鍋・フライパン・ボウル・皿の数が最小限になる、洗い物が少ないレシピ' },
] as const;

// 定食モードで各品に付くコース名(主菜/副菜/汁物/ご飯・主食)のアイコン
const COURSE_ICON_SLUGS: Record<string, string> = {
  '主菜': 'main_dish',
  '副菜': 'side_dish',
  '汁物': 'soup_course',
  'ご飯・主食': 'rice_staple',
};

const TIP_CATEGORY_COLORS: Record<string, string> = {
  '保存方法': '#20b2aa',
  '調理のコツ': '#ff6f91',
  '栄養豆知識': '#8b5cf6',
};

// Geminiの過去キャッシュにはバッジ先頭の絵文字が残っている場合がある。
// 専用アイコンと二重表示にならないよう、表示時だけ装飾記号を除去する。
const stripLeadingEmoji = (value: string) => value
  .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/gu, '')
  .trim();

export default function RecipePage() {
  const { t, language } = useLanguage();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  // getLocalUserProfile()を直接初期値に渡すとSSR時のデフォルト値とクライアント
  // 初回レンダー時の実データが食い違いハイドレーションミスマッチになるため、
  // 安全な初期値を渡し実データはloadLocalData()のuseEffectでのみ取得する
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [creationMode, setCreationMode] = useState<'inventory' | 'free'>('inventory');
  // 単品の候補を複数出すか、主菜・副菜・汁物からなる定食セットを1組出すか
  const [mealStyle, setMealStyle] = useState<'single' | 'set'>('single');
  const [instruction, setInstruction] = useState("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [cookingRecipeIndex, setCookingRecipeIndex] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<Recipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  // マイページの人数設定はデフォルト値として使うが、生成のたびに個別に変えられるようにする
  const [sessionServings, setSessionServings] = useState<number>(2);
  // 「使いたい食材を選択」は在庫が多いと縦に長くなり圧迫感があるため、
  // デフォルトはたたんでおき、必要な時だけ開く
  const [ingredientPickerExpanded, setIngredientPickerExpanded] = useState(false);
  // 生成前の成立可否判定(要件8・9)でNGと判定された場合、レシピの代わりに
  // 警告(理由・不足食材・次のアクション)を表示する
  const [feasibilityWarning, setFeasibilityWarning] = useState<{ reason: string; missingKeyIngredients: string[] } | null>(null);
  const selectedTray = getTrayTheme(userProfile.trayTheme);
  const validSelectedIngredientIds = selectedIngredientIds.filter((id) =>
    ingredients.some((ingredient) => ingredient.id === id)
  );

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
      // 一覧へ戻った時に詳細モーダルが勝手に開かないよう、結果だけ復元する。
      setExpandedIndex(-1);
      setSavedSet(new Set(cached.savedIndices));
      setCreationMode(cached.creationMode);
      setInstruction(cached.instruction);
      setSelectedIngredientIds(cached.selectedIngredientIds);
      setSessionServings(cached.servings);
    }
  }, []);

  // 在庫タブの「呼びかけ」食材カードから「このXでレシピを探す」で遷移してきた場合、
  // ?ingredient=<id> にその食材IDが入っている。復元したキャッシュより優先して
  // その食材だけを選択状態にし、ピッカーを開いて選択済みであることが見えるようにする。
  // (useSearchParamsだとSuspense境界が必要になるため、location.searchを直接読む)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const idParam = new URLSearchParams(window.location.search).get("ingredient");
    if (!idParam) return;
    const id = Number(idParam);
    if (!Number.isFinite(id)) return;
    setCreationMode('inventory');
    setSelectedIngredientIds([id]);
    setIngredientPickerExpanded(true);
  }, []);

  // ホームタブの「今日のおすすめ」をタップして遷移してきた場合、専用の簡易表示
  // ではなく、このタブの通常のレシピカードと全く同じ見た目・機能(材料の不足表示・
  // クッキングモード・保存・料理完了ボタン等)で開けるようにする。復元したキャッシュ
  // より優先して表示する。
  useEffect(() => {
    const handoff = consumePendingDailyPickHandoff();
    if (!handoff) return;
    setRecipes([{ ...handoff, image_url: null, nutrition: null }]);
    setExpandedIndex(0);
    setSavedSet(new Set());
  }, []);

  const loadLocalData = () => {
    const list = getLocalIngredients();
    setIngredients(list);
    setUserProfile(getLocalUserProfile());
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
    setFeasibilityWarning(null);

    try {
      const selectedNames = creationMode === 'inventory'
        ? ingredients.filter(i => validSelectedIngredientIds.length === 0 ? true : validSelectedIngredientIds.includes(i.id)).map(i => i.name)
        : [];

      const currentClimate = getLocalClimateState();
      const recentRecipes = getRecentLocalRecipeNames(5);
      // 「気に入って保存した」という明示的なシグナルから、この人の好みの傾向を
      // AIに伝え、より本人好みで美味しく感じられる提案につなげる
      const likedRecipeSummary = getLocalSavedRecipes()
        .slice(0, 15)
        .map(r => ({ title: r.title, genre: r.genre }));

      // 入力欄のテキストが選択中テンプレートの定型文と完全一致する場合だけ、
      // そのテンプレートを「絶対条件」としてサーバーに伝える(要件7)。
      // ユーザーが文章を書き換えた時点で一致しなくなり、自然に解除される。
      const activeTemplate = TEMPLATES.find(tmpl => tmpl.query === instruction);

      const payload = {
        ingredients: selectedNames,
        instruction: instruction.trim() || undefined,
        templateKey: activeTemplate?.key,
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
        // 旧実装ではサーバー側が読む項目名(recentHistory)と送信側の項目名
        // (recentRecipes)が一致しておらず、直近レシピの重複防止が機能して
        // いなかったため、正しい項目名で送るよう修正
        recentHistory: recentRecipes,
        likedRecipeSummary,
        mode: creationMode === 'free' ? 'free' : 'inventory',
        mealStyle,
        language,
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

      // 生成前の成立可否判定でNGと出た場合は、エラーではなく専用の警告として扱う
      if (data.feasibility && data.feasibility.feasible === false) {
        setFeasibilityWarning({
          reason: data.feasibility.reason || '',
          missingKeyIngredients: data.feasibility.missingKeyIngredients || [],
        });
        return;
      }

      if (data.recipes && data.recipes.length > 0) {
        setRecipes(data.recipes);
        setExpandedIndex(-1);
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
        expandedIndex: -1,
        savedIndices: [],
        creationMode,
        instruction,
        selectedIngredientIds: validSelectedIngredientIds,
        servings: sessionServings,
        savedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : t.recipe.errorGeneric);
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

  // 食材選択チップを在庫画面と同じカテゴリ順にグルーピングし、目的の食材を探しやすくする
  const groupedIngredients = CATEGORY_ORDER.reduce<Record<string, Ingredient[]>>((acc, cat) => {
    const items = ingredients.filter(i => (i.category || 'その他') === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const detailRecipe = expandedIndex >= 0 ? recipes[expandedIndex] : null;
  const detailIsSaved = expandedIndex >= 0 && savedSet.has(expandedIndex);

  useEffect(() => {
    if (!detailRecipe) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailRecipe]);

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
      />

      <ClimateBar />

      {/* AI生成中は下のフォーム一式を操作不可にし、リクエスト内容が生成中に
          変わってしまう混乱を防ぐ(ボタン自体は押せるが見た目にも分かるよう薄くする) */}
      <div style={{ pointerEvents: loading ? 'none' : undefined, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }} aria-disabled={loading}>
      {/* AI作成モード切り替え (在庫から作成 ⇄ 自由作成) */}
      <div className={styles.modeTabs}>
        <button
          type="button"
          onClick={() => setCreationMode('inventory')}
          className={`${styles.modeTab} ${creationMode === 'inventory' ? styles.modeTabPrimary : ''}`}
        >
          {t.recipe.modeInventory}
        </button>
        <button
          type="button"
          onClick={() => setCreationMode('free')}
          className={`${styles.modeTab} ${creationMode === 'free' ? styles.modeTabPrimary : ''}`}
        >
          {t.recipe.modeFree}
        </button>
      </div>

      {/* 単品の候補を複数出す ⇄ 主菜・副菜・汁物からなる定食セットを1組出す */}
      <div className={`${styles.modeTabs} ${styles.mealTabs}`}>
        <button
          type="button"
          onClick={() => setMealStyle('single')}
          className={`${styles.modeTab} ${mealStyle === 'single' ? styles.mealTabActive : ''}`}
        >
          {t.recipe.mealStyleSingle}
        </button>
        <button
          type="button"
          onClick={() => setMealStyle('set')}
          className={`${styles.modeTab} ${mealStyle === 'set' ? styles.mealTabActive : ''}`}
        >
          {t.recipe.mealStyleSet}
        </button>
      </div>

      {/* 設定・リクエストフォーム */}
      <div className={`card ${styles.requestCard}`}>
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
                  <UiIcon slug={tmpl.iconSlug} size={28} alt={tmpl.key} className={styles.templateEmoji} />
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

        {/* 在庫選択 (在庫モード時のみ)。在庫が多いと縦に長くなるため、
            デフォルトはたたんでおき、タップで開閉する */}
        {creationMode === 'inventory' && (
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setIngredientPickerExpanded(v => !v)}
              className={styles.ingredientPickerToggle}
            >
              <span className={styles.ingredientPickerCopy}>
                <span className={styles.ingredientPickerLabel}>{t.recipe.selectIngredientsLabel}</span>
                <span className={styles.ingredientPickerHint}>{t.recipe.selectIngredientsHint}</span>
              </span>
              <span className={styles.ingredientPickerStatus}>
                {validSelectedIngredientIds.length > 0 && (
                  <span className={styles.ingredientPickerCount}>
                    {t.recipe.selectIngredientsSelectedCount(validSelectedIngredientIds.length)}
                  </span>
                )}
                {ingredientPickerExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>
            {ingredientPickerExpanded && (ingredients.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(groupedIngredients).map(([category, items]) => (
                  <div key={category}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <UiIcon slug={CATEGORY_ICON_SLUGS[category] || 'other'} size={16} alt={category} />
                      <span>{t.category[category] || category}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {items.map(ing => {
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
                            {ing.is_pinned && <UiIcon slug="pin" collection="core" size={14} alt="" />}
                            {ing.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {t.recipe.noIngredients}
              </p>
            ))}
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
              <UiIcon slug="cooking_pot" size={24} alt="" />
              {t.recipe.generateButton}
            </>
          )}
        </button>
      </div>
      </div>

      {loading && (
        <KitchenLoader text={t.recipe.loadingText} />
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 12, color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      {/* 生成前の成立可否判定でNGだった場合の警告(要件8): エラーではなく、
          理由・不足食材・次のアクション(自由作成に切り替える/買い物リストへ追加する)を示す */}
      {feasibilityWarning && (
        <div style={{ background: 'rgba(240, 165, 0, 0.1)', border: '1px solid rgba(240, 165, 0, 0.3)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <img src="/mascot/bear_sleeping.png" alt="" width={36} height={36} />
            <strong style={{ fontSize: 14, color: '#92600a' }}>{t.recipe.feasibilityTitle}</strong>
          </div>
          {feasibilityWarning.reason && (
            <p style={{ fontSize: 13, color: '#92600a', margin: '0 0 10px' }}>{feasibilityWarning.reason}</p>
          )}
          {feasibilityWarning.missingKeyIngredients.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {feasibilityWarning.missingKeyIngredients.map((name, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 700, color: '#92600a', background: 'rgba(240, 165, 0, 0.18)', padding: '3px 9px', borderRadius: 999 }}>
                  <UiIcon slug="shopping_cart" collection="core" size={15} alt="" />
                  {name}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setCreationMode('free'); setFeasibilityWarning(null); }}
              style={{ flex: 1, background: 'var(--card-bg-solid)', color: '#92600a', border: '1px solid rgba(240, 165, 0, 0.4)', borderRadius: 10, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {t.recipe.feasibilitySwitchToFree}
            </button>
            {feasibilityWarning.missingKeyIngredients.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  feasibilityWarning.missingKeyIngredients.forEach(name => addLocalShoppingItem(name));
                  showToast(t.recipe.feasibilityAddedToShoppingToast(feasibilityWarning.missingKeyIngredients.length));
                  setFeasibilityWarning(null);
                }}
                style={{ flex: 1, background: 'var(--gradient-cool)', color: 'white', border: 'none', borderRadius: 10, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {t.recipe.feasibilityGoShopping}
              </button>
            )}
          </div>
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
          <div
            className={styles.recipeTrayGallery}
            style={{ backgroundImage: `url("${selectedTray.asset}")` }}
          >
            <div className={styles.recipeDishGrid}>
              {recipes.map((recipe, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.recipeDishChoice}
                  onClick={() => setExpandedIndex(index)}
                  aria-label={`${recipe.title} — ${language === 'ja' ? 'レシピを表示' : 'View recipe'}`}
                >
                  <RecipeThumbnail
                    genre={recipe.genre}
                    fallbackIngredientName={recipe.title}
                    size={168}
                    className={styles.recipeDishChoiceIcon}
                  />
                  <span className={styles.recipeDishChoiceName}>{recipe.title}</span>
                </button>
              ))}
            </div>
          </div>
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

      <AnimatePresence>
        {detailRecipe && expandedIndex >= 0 && cookingRecipeIndex === null && !cookedModalRecipe && (
          <motion.div
            className={styles.recipeDetailOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={detailRecipe.title}
          >
            <div className={styles.recipeDetailTopbar}>
              <button
                type="button"
                className={styles.recipeDetailClose}
                onClick={() => setExpandedIndex(-1)}
                aria-label={language === 'ja' ? '閉じる' : 'Close'}
              >
                <X size={22} />
              </button>
              <strong>{detailRecipe.title}</strong>
              <button
                type="button"
                className={detailIsSaved ? styles.savedBtn : styles.saveBtn}
                onClick={() => handleSaveRecipe(expandedIndex)}
                disabled={detailIsSaved || savingIndex === expandedIndex}
              >
                {detailIsSaved ? <Check size={15} /> : <Bookmark size={15} />}
                {detailIsSaved ? t.recipe.saved : t.recipe.save}
              </button>
            </div>

            <div className={styles.recipeDetailScroll}>
              <div
                className={styles.recipeDetailHero}
                style={{ backgroundImage: `url("${selectedTray.asset}")` }}
              >
                <RecipeThumbnail
                  genre={detailRecipe.genre}
                  fallbackIngredientName={detailRecipe.title}
                  size={184}
                  className={styles.recipeDetailDishIcon}
                />
                <div className={styles.recipeDetailHeroInfo}>
                  <div className={styles.badgeRow}>
                    {detailRecipe.course && (
                      <span className={styles.genreBadge}>
                        <UiIcon slug={COURSE_ICON_SLUGS[detailRecipe.course] || 'other'} size={16} alt={detailRecipe.course} />
                        {' '}{t.recipe.courseLabel[detailRecipe.course] || detailRecipe.course}
                      </span>
                    )}
                    {detailRecipe.genre && (
                      <span className={styles.genreBadge}>{t.tagLabel[detailRecipe.genre] || detailRecipe.genre}</span>
                    )}
                    {detailRecipe.climate_badge && (
                      <span className={styles.climateBadge}>
                        <UiIcon slug="clear" size={15} alt="" />
                        {stripLeadingEmoji(detailRecipe.climate_badge)}
                      </span>
                    )}
                    {detailRecipe.dish_badge && (
                      <span className={styles.climateBadge}>
                        <UiIcon slug="dishwashing" size={15} alt="" />
                        {stripLeadingEmoji(detailRecipe.dish_badge)}
                      </span>
                    )}
                  </div>
                  <h2 className={styles.recipeTitle}>{detailRecipe.title}</h2>
                  <span className={styles.recipeTime}>
                    <UiIcon slug="timer_clock" collection="core" size={16} alt="" />
                    {detailRecipe.time}
                  </span>
                  {detailRecipe.ingredients.length > 0 && (
                    <div className={styles.ingredientIconRow}>
                      {detailRecipe.ingredients.slice(0, 9).map((item, i) => (
                        <IngredientIcon key={i} name={item.name} size={25} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.recipeDetailContent}>
                {detailRecipe.nutrition && (
                  <div className={styles.nutritionSection}>
                    <NutritionChart nutrition={detailRecipe.nutrition} />
                  </div>
                )}

                <div className={styles.section}>
                  <div className={styles.detailSectionHeading}>
                    <h3>{t.recipe.ingredientsSectionTitle}</h3>
                    <span>{t.recipe.ingredientsSectionHint}</span>
                  </div>
                  <ul className={styles.ingredientList}>
                    {detailRecipe.ingredients.map((item, i) => {
                      const missing = isIngredientMissing(item.name, ingredients, userProfile.assumeSeasoningsAvailable);
                      const pinKey = `${expandedIndex}-${item.name}`;
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
                                onClick={() => handlePinToShopping(expandedIndex, item.name)}
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

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3>{t.recipe.stepsSectionTitle}</h3>
                    <button
                      className={styles.startCookingBtn}
                      onClick={() => setCookingRecipeIndex(expandedIndex)}
                    >
                      <PlayCircle size={16} />
                      {t.recipe.cookingModeButton}
                    </button>
                  </div>
                  <ol className={styles.stepList}>
                    {detailRecipe.steps.map((step, i) => (
                      <li key={i}>
                        <span className={styles.stepNumber}>{i + 1}</span>
                        <span className={styles.stepText}>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {detailRecipe.tips && (
                  <div className={styles.tipsBox}>
                    <strong>{t.recipe.tipsPrefix}</strong> {detailRecipe.tips}
                  </div>
                )}

                <button
                  type="button"
                  className={styles.cookedDetailBtn}
                  onClick={() => setCookedModalRecipe(detailRecipe)}
                >
                  {t.recipe.cookedButton}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
