"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, ChevronDown, ChevronUp, Bookmark, Check, Plus, Minus, Lightbulb, PlayCircle, RefreshCw, SlidersHorizontal, X } from "lucide-react";
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
import PremiumPaywall from "@/components/PremiumPaywall";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  getLocalSavedRecipes,
  saveLocalRecipe,
  addLocalShoppingItem,
  getRecentLocalRecipeNames,
  getRecentFlavorFeedbackSummary,
  saveLocalTip,
  isIngredientMissing,
  getLocalLastRecipeGeneration,
  setLocalLastRecipeGeneration,
  getLocalCachedRecipeGeneration,
  setLocalCachedRecipeGeneration,
  saveLocalRecentRecipes,
  consumePendingDailyPickHandoff,
  DEFAULT_USER_PROFILE,
  CATEGORY_ORDER,
  CATEGORY_ICON_SLUGS,
  Ingredient,
  UserProfile,
  NutritionData,
  MealComponent,
  MealFormat
} from "@/lib/storage";
import {
  canUseFreeRecipeGeneration,
  getFreeRecipeCreditsRemaining,
  incrementFreeRecipeGeneration,
} from "@/lib/storage";
import { createRecipeGenerationRequestKey } from "@/lib/recipeCache";
import { usePremium } from "@/lib/premium/PremiumContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getTrayTheme } from "@/lib/trayThemes";
import { setNavLocked } from "@/lib/navLock";
import { recipeServings, scaleIngredientAmount } from "@/lib/servingScale";
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
  source?: 'generated' | 'community' | 'daily-pick';
  sourceRecipeId?: string;
  servings?: number;
  meal_format?: MealFormat;
  components?: MealComponent[];
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
  const { isPremium } = usePremium();
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  // getLocalUserProfile()を直接初期値に渡すとSSR時のデフォルト値とクライアント
  // 初回レンダー時の実データが食い違いハイドレーションミスマッチになるため、
  // 安全な初期値を渡し実データはloadLocalData()のuseEffectでのみ取得する
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const requestCardRef = useRef<HTMLDivElement>(null);
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [creationMode, setCreationMode] = useState<'inventory' | 'free'>('inventory');
  // 単品の候補を複数出すか、主菜・副菜・汁物からなる定食セットを1組出すか
  const [mealStyle, setMealStyle] = useState<'single' | 'set'>('single');
  const [instruction, setInstruction] = useState("");
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([]);
  const [rescueIngredientName, setRescueIngredientName] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<Recipe | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<Recipe | null>(null);
  // おすすめ・みんなのレシピは「一時プレビュー」として保持し、前回の生成結果を上書きしない。
  const [externalPreviewRecipe, setExternalPreviewRecipe] = useState<Recipe | null>(null);
  const [externalPreviewSaved, setExternalPreviewSaved] = useState(false);
  const [servingOverrides, setServingOverrides] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [resultOrigin, setResultOrigin] = useState<'generated' | 'cache' | 'restored' | null>(null);
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  // マイページの人数設定はデフォルト値として使うが、生成のたびに個別に変えられるようにする
  const [sessionServings, setSessionServings] = useState<number>(2);
  // 「使いたい食材を選択」は在庫が多いと縦に長くなり圧迫感があるため、
  // デフォルトはたたんでおき、必要な時だけ開く
  const [ingredientPickerExpanded, setIngredientPickerExpanded] = useState(false);
  // 生成前の成立可否判定(要件8・9)でNGと判定された場合、レシピの代わりに
  // 警告(理由・不足食材・次のアクション)を表示する
  const [feasibilityWarning, setFeasibilityWarning] = useState<{ reason: string; missingKeyIngredients: string[] } | null>(null);
  const selectedTray = getTrayTheme(isPremium ? userProfile.trayTheme : 'wood');
  const validSelectedIngredientIds = selectedIngredientIds.filter((id) =>
    ingredients.some((ingredient) => ingredient.id === id)
  );

  useEffect(() => {
    loadLocalData();
    const handleUpdate = () => loadLocalData();
    window.addEventListener("storage-updated", handleUpdate);
    return () => {
      window.removeEventListener("storage-updated", handleUpdate);
      setNavLocked(false);
    };
  }, []);

  // 前回の生成結果を復元する（別タブへ移動して戻ってきても消えないように）。
  // マウント時に一度だけ行い、storage-updated発火のたびに入力中のフォームを
  // 上書きしてしまわないようにする。
  useEffect(() => {
    if (getLocalUserProfile().autoSaveRecipes === false) return;
    const cached = getLocalLastRecipeGeneration();
    if (cached) {
      setRecipes(cached.recipes.map((recipe) => ({
        ...recipe,
        servings: recipeServings(recipe.servings, cached.servings),
      })));
      setCookingTips(cached.cookingTips);
      // 一覧へ戻った時に詳細モーダルが勝手に開かないよう、結果だけ復元する。
      setExpandedIndex(-1);
      setSavedSet(new Set(cached.savedIndices));
      setCreationMode(cached.creationMode);
      setMealStyle(cached.mealStyle || (cached.recipes.length > 1 ? 'set' : 'single'));
      // リクエスト・気分は一時的な入力なので、前回結果と一緒には復元しない。
      setSelectedIngredientIds(cached.selectedIngredientIds);
      setSessionServings(cached.servings);
      setResultOrigin('restored');
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
    const targetIngredient = getLocalIngredients().find((item) => item.id === id);
    setCreationMode('inventory');
    setSelectedIngredientIds([id]);
    setIngredientPickerExpanded(true);
    if (new URLSearchParams(window.location.search).get("rescue") === "1" && targetIngredient) {
      setRescueIngredientName(targetIngredient.name);
    }
  }, []);

  // ホームタブの「今日のおすすめ」をタップして遷移してきた場合、専用の簡易表示
  // ではなく、このタブの通常のレシピカードと全く同じ見た目・機能(材料の不足表示・
  // クッキングモード・保存・料理完了ボタン等)で開けるようにする。復元したキャッシュ
  // より優先して表示する。
  useEffect(() => {
    const handoff = consumePendingDailyPickHandoff();
    if (!handoff) return;
    const preview = {
      ...handoff,
      image_url: null,
      nutrition: handoff.nutrition || null,
      servings: recipeServings(handoff.servings),
    };
    setExternalPreviewRecipe(preview);
    setExternalPreviewSaved(getLocalSavedRecipes().some((recipe) => recipe.title === preview.title));
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

  const persistRecipe = (recipe: Recipe): boolean => {
    const normalizedTitle = recipe.title.normalize('NFKC').trim().toLocaleLowerCase();
    if (getLocalSavedRecipes().some((saved) => saved.title.normalize('NFKC').trim().toLocaleLowerCase() === normalizedTitle)) {
      return false;
    }
    saveLocalRecipe({
      title: recipe.title,
      time: recipe.time,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tips: recipe.tips,
      image_url: recipe.image_url,
      nutrition: recipe.nutrition || null,
      genre: recipe.genre || null,
      dish_badge: recipe.dish_badge || null,
      servings: recipeServings(recipe.servings),
      meal_format: recipe.meal_format,
      components: recipe.components,
    });
    return true;
  };

  const toggleIngredientSelection = (id: number) => {
    setSelectedIngredientIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApplyTemplate = (query: string) => {
    setInstruction(query);
  };

  const handleGenerate = async (forceRefresh = false) => {
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
    const activeTemplate = TEMPLATES.find(tmpl => tmpl.query === instruction);

    const payload = {
      ingredients: selectedNames,
      pinnedIngredients: creationMode === 'inventory'
        ? (validSelectedIngredientIds.length > 0
            ? selectedNames
            : ingredients.filter((item) => item.is_pinned).map((item) => item.name))
        : [],
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
        flavorFeedback: getRecentFlavorFeedbackSummary(12),
      },
      climate: userProfile.enableClimate !== false ? currentClimate : undefined,
      recentHistory: recentRecipes,
      likedRecipeSummary,
      mode: creationMode === 'free' ? 'free' : 'inventory',
      mealStyle,
      language,
    };
    const requestKey = createRecipeGenerationRequestKey(payload);

    if (!forceRefresh) {
      const cached = getLocalCachedRecipeGeneration(requestKey);
      if (cached && cached.recipes.length > 0) {
        const savedTitles = new Set(getLocalSavedRecipes().map((recipe) => recipe.title));
        const savedIndices = cached.recipes
          .map((recipe, index) => savedTitles.has(recipe.title) ? index : -1)
          .filter((index) => index >= 0);
        const restoredRecipes = cached.recipes.map((recipe) => ({
          ...recipe,
          servings: recipeServings(recipe.servings, cached.servings),
        }));
        const restored = {
          ...cached,
          recipes: restoredRecipes,
          savedIndices,
          creationMode,
          mealStyle,
          instruction: '',
          selectedIngredientIds: validSelectedIngredientIds,
          servings: sessionServings,
        };
        setErrorMsg("");
        setFeasibilityWarning(null);
        setRecipes(restored.recipes);
        setCookingTips(restored.cookingTips);
        setShowTips(restored.cookingTips.length > 0);
        setExpandedIndex(-1);
        setSavedSet(new Set(savedIndices));
        setResultOrigin('cache');
        if (getLocalUserProfile().autoSaveRecipes !== false) {
          setLocalLastRecipeGeneration(restored);
        }
        showToast(t.recipe.cacheHitToast);
        return;
      }
    }

    if (!isPremium && !canUseFreeRecipeGeneration(mealStyle)) {
      setShowPaywall(true);
      return;
    }

    setLoading(true);
    setNavLocked(true);
    setErrorMsg("");
    setRecipes([]);
    setCookingTips([]);
    setSavedSet(new Set());
    setFeasibilityWarning(null);
    setResultOrigin(null);

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        // API内部の例外文が別言語でも、そのままUIへ漏らさず現在の表示言語で案内する。
        throw new Error(typeof data.error === 'string' && data.error.trim()
          ? data.error
          : t.recipe.errorGenerateFailed);
      }

      // 生成前の成立可否判定でNGと出た場合は、エラーではなく専用の警告として扱う
      if (data.feasibility && data.feasibility.feasible === false) {
        setFeasibilityWarning({
          reason: data.feasibility.reason || '',
          missingKeyIngredients: data.feasibility.missingKeyIngredients || [],
        });
        return;
      }

      const generatedRecipes: Recipe[] = Array.isArray(data.recipes)
        ? data.recipes.map((recipe: Recipe) => ({
            ...recipe,
            servings: recipeServings(recipe.servings, sessionServings),
          }))
        : [];
      const savedTitles = new Set(getLocalSavedRecipes().map((saved) => saved.title));
      const savedIndices = generatedRecipes
        .map((recipe, index) => savedTitles.has(recipe.title) ? index : -1)
        .filter((index) => index >= 0);
      if (generatedRecipes.length > 0) {
        // 自動保存は「前回の生成結果をレシピタブへ復元する」ための端末内保存。
        // 保存済みレシピや調理履歴へは自動登録せず、明示的な保存・調理完了を待つ。
        setSavedSet(new Set(savedIndices));
        setRecipes(generatedRecipes);
        setExpandedIndex(-1);
        setResultOrigin('generated');
        if (!isPremium) incrementFreeRecipeGeneration(mealStyle);

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

      // 別タブへ移動しても前回の生成結果が消えないように端末へ保存しておく。
      const generationSnapshot = {
        recipes: generatedRecipes,
        cookingTips: tips,
        expandedIndex: -1,
        savedIndices,
        creationMode,
        mealStyle,
        // リクエスト・気分の自由記述は結果キャッシュへ保存しない。
        instruction: '',
        selectedIngredientIds: validSelectedIngredientIds,
        servings: sessionServings,
        savedAt: new Date().toISOString(),
        requestKey,
      };
      if (getLocalUserProfile().autoSaveRecipes !== false) {
        setLocalLastRecipeGeneration(generationSnapshot);
        saveLocalRecentRecipes(generatedRecipes.map((recipe) => ({
          title: recipe.title,
          time: recipe.time,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tips: recipe.tips,
          image_url: recipe.image_url,
          nutrition: recipe.nutrition || null,
          genre: recipe.genre || null,
          dish_badge: recipe.dish_badge || null,
          servings: recipeServings(recipe.servings, sessionServings),
          meal_format: recipe.meal_format,
          components: recipe.components,
          source: recipe.source || 'generated',
          sourceRecipeId: recipe.sourceRecipeId,
        })));
      }
      setLocalCachedRecipeGeneration(generationSnapshot);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : t.recipe.errorGeneric);
    } finally {
      setLoading(false);
      setNavLocked(false);
    }
  };

  const scrollToGenerationForm = () => {
    requestAnimationFrame(() => {
      requestCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleReviewGenerationConditions = () => {
    setErrorMsg("");
    if (creationMode === "inventory") setIngredientPickerExpanded(true);
    scrollToGenerationForm();
  };

  const handleSwitchToFreeFromError = () => {
    setErrorMsg("");
    setCreationMode("free");
    scrollToGenerationForm();
  };

  const handleSaveRecipe = (recipe: Recipe, index?: number) => {
    const savingKey = index ?? -2;
    setSavingIndex(savingKey);
    try {
      persistRecipe(recipe);
      if (index === undefined) setExternalPreviewSaved(true);
      else setSavedSet(prev => new Set(prev).add(index));

      // キャッシュ上の保存済みフラグも更新しておく（タブを移動して戻っても保存済み表示が残るように）
      const cached = getLocalLastRecipeGeneration();
      if (cached && index !== undefined) {
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
      showToast(t.recipe.savedToast(recipe.title));
    } catch (e) {
      console.error(e);
      showToast(t.recipe.saveFailedToast);
    } finally {
      setSavingIndex(null);
    }
  };

  const handlePinToShopping = (recipeIndex: number | string, ingredientName: string) => {
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
  const detailRecipe = externalPreviewRecipe || (expandedIndex >= 0 ? recipes[expandedIndex] : null);
  const detailIndex = externalPreviewRecipe ? undefined : expandedIndex >= 0 ? expandedIndex : undefined;
  const detailRecipeKey = detailRecipe
    ? `${detailRecipe.source || 'generated'}:${detailRecipe.sourceRecipeId || (detailIndex ?? 'preview')}:${detailRecipe.title}`
    : '';
  const detailBaseServings = recipeServings(detailRecipe?.servings);
  const detailServings = servingOverrides[detailRecipeKey] || detailBaseServings;
  const scaledDetailRecipe = detailRecipe ? {
    ...detailRecipe,
    servings: detailServings,
    ingredients: detailRecipe.ingredients.map((item) => ({
      ...item,
      amount: scaleIngredientAmount(item.amount, detailBaseServings, detailServings),
    })),
  } : null;
  const detailIsSaved = externalPreviewRecipe ? externalPreviewSaved : detailIndex !== undefined && savedSet.has(detailIndex);

  const closeRecipeDetail = () => {
    if (externalPreviewRecipe) {
      router.back();
      return;
    }
    setExpandedIndex(-1);
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

      {creationMode === 'inventory' && rescueIngredientName && (
        <div className={styles.rescueModeBanner}>
          <span className={styles.rescueModeIcon}>
            <IngredientIcon name={rescueIngredientName} size={52} />
          </span>
          <span className={styles.rescueModeCopy}>
            <strong>{t.recipe.rescueModeTitle}</strong>
            <small>{t.recipe.rescueModeBody(rescueIngredientName)}</small>
          </span>
        </div>
      )}

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
      <div ref={requestCardRef} className={`card ${styles.requestCard}`}>
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
                  <UiIcon
                    slug={tmpl.iconSlug}
                    size={46}
                    alt=""
                    className={`${styles.templateEmoji} ${tmpl.key === 'sweets' ? styles.templateEmojiSweets : ''}`}
                  />
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
                padding: 0, flex: '0 0 40px', lineHeight: 0,
              }}
            >
              <Minus size={20} strokeWidth={3} aria-hidden="true" />
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
                padding: 0, flex: '0 0 40px', lineHeight: 0,
              }}
            >
              <Plus size={20} strokeWidth={3} aria-hidden="true" />
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
          onClick={() => void handleGenerate(false)}
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
        {!isPremium && (
          <p className={styles.freeQuotaHint}>
            {t.recipe.freeDailyRemaining(getFreeRecipeCreditsRemaining(), mealStyle)}
          </p>
        )}
      </div>
      </div>

      {loading && (
        <KitchenLoader text={t.recipe.loadingText} phaseMessages={t.recipe.loadingPhases} />
      )}

      {errorMsg && (
        <section className={styles.generationError} role="alert">
          <div className={styles.generationErrorHead}>
            <span className={styles.generationErrorIcon}><CircleAlert size={21} /></span>
            <span className={styles.generationErrorCopy}>
              <strong>{t.recipe.errorGuideTitle}</strong>
              <span>{t.recipe.errorGuideBody}</span>
            </span>
          </div>
          <p className={styles.generationErrorMessage}>{errorMsg}</p>
          <div className={styles.generationErrorActions}>
            <button type="button" className={styles.errorPrimary} onClick={() => void handleGenerate(true)}>
              <RefreshCw size={16} />{t.recipe.retryGenerate}
            </button>
            <button type="button" className={styles.errorSecondary} onClick={handleReviewGenerationConditions}>
              <SlidersHorizontal size={16} />{t.recipe.reviewConditions}
            </button>
          </div>
          {creationMode === "inventory" && (
            <button type="button" className={styles.errorTertiary} onClick={handleSwitchToFreeFromError}>
              {t.recipe.switchToFreeFromError}
            </button>
          )}
        </section>
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
            <div className={styles.resultsBannerCopy}>
              <div className={styles.resultsBannerTitle}>{t.recipe.resultsBannerTitle(recipes.length)}</div>
              <div className={styles.resultsBannerSub}>{t.recipe.resultsBannerSub}</div>
            </div>
            {resultOrigin === 'cache' && (
              <div className={styles.cacheActions}>
                <span className={styles.cacheBadge}>{t.recipe.cachedResultLabel}</span>
                <button
                  type="button"
                  className={styles.regenerateFreshButton}
                  onClick={() => void handleGenerate(true)}
                  disabled={loading}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {t.recipe.regenerateFresh}
                </button>
              </div>
            )}
          </div>
          <div
            className={styles.recipeTrayGallery}
            style={{
              backgroundImage: `url("${selectedTray.asset}")`,
              backgroundSize: selectedTray.backgroundSize,
            }}
          >
            <div className={`${styles.recipeDishGrid} ${mealStyle === 'single' ? styles.recipeDishGridSingle : ''} ${recipes.length === 1 ? styles.recipeDishGridSolo : ''}`}>
              {recipes.map((recipe, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.recipeDishChoice} ${mealStyle === 'single' ? styles.recipeDishChoiceSingle : ''} ${recipes.length === 1 ? styles.recipeDishChoiceSolo : ''}`}
                  onClick={() => setExpandedIndex(index)}
                  aria-label={`${recipe.title} — ${language === 'ja' ? 'レシピを表示' : 'View recipe'}`}
                >
                  <RecipeThumbnail
                    genre={recipe.genre}
                    fallbackIngredientName={recipe.title}
                    size={mealStyle === 'single' ? (recipes.length === 1 ? 248 : 216) : 176}
                    className={styles.recipeDishChoiceIcon}
                  />
                  <span className={styles.recipeDishChoiceName}>{recipe.title}</span>
                  <span className={styles.recipeDishChoiceServings}>{t.recipe.servingsUnit(recipeServings(recipe.servings, sessionServings))}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 豆知識セクション */}
      {!loading && cookingTips.length > 0 && isPremium && (
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

      {!loading && cookingTips.length > 0 && !isPremium && (
        <button type="button" className={styles.premiumTipsGate} onClick={() => setShowPaywall(true)}>
          <Lightbulb size={20} />
          <span><strong>{t.recipe.tipsPlusTitle}</strong>{t.recipe.tipsPlusBody}</span>
        </button>
      )}

      {/* クッキングセッション */}
      <AnimatePresence>
        {cookingSessionRecipe && (
          <CookingSession
            title={cookingSessionRecipe.title}
            steps={cookingSessionRecipe.steps}
            ingredients={cookingSessionRecipe.ingredients}
            completionRecipe={cookingSessionRecipe}
            source={cookingSessionRecipe.source || 'generated'}
            sourceRecipeId={cookingSessionRecipe.sourceRecipeId}
            onClose={() => setCookingSessionRecipe(null)}
          />
        )}
      </AnimatePresence>

      {/* 調理完了モーダル */}
      <AnimatePresence>
        {cookedModalRecipe && (
          <CookedModal
            recipe={cookedModalRecipe}
            source={cookedModalRecipe.source || 'generated'}
            sourceRecipeId={cookedModalRecipe.sourceRecipeId}
            onClose={() => setCookedModalRecipe(null)}
            onCompleted={() => {
              loadLocalData();
              showToast(t.recipe.cookedCompletedToast);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailRecipe && scaledDetailRecipe && !cookingSessionRecipe && !cookedModalRecipe && (
          <motion.div
            className={styles.recipeDetailOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={detailRecipe.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className={styles.recipeDetailTopbar}>
              <button
                type="button"
                className={styles.recipeDetailClose}
                onClick={closeRecipeDetail}
                aria-label={language === 'ja' ? '閉じる' : 'Close'}
              >
                <X size={22} />
              </button>
              <strong>{detailRecipe.title}</strong>
              <button
                type="button"
                className={detailIsSaved ? styles.savedBtn : styles.saveBtn}
                onClick={() => handleSaveRecipe(scaledDetailRecipe, detailIndex)}
                disabled={detailIsSaved || savingIndex === (detailIndex ?? -2)}
              >
                {detailIsSaved ? <Check size={15} /> : <Bookmark size={15} />}
                {detailIsSaved ? t.recipe.saved : t.recipe.save}
              </button>
            </div>

            <div className={styles.recipeDetailScroll}>
              <div
                className={styles.recipeDetailHero}
                style={{
                  backgroundImage: `url("${selectedTray.asset}")`,
                  backgroundSize: selectedTray.backgroundSize,
                }}
              >
                <RecipeThumbnail
                  genre={detailRecipe.genre}
                  fallbackIngredientName={detailRecipe.title}
                  size={320}
                  className={styles.recipeDetailDishIcon}
                />
              </div>

              <div className={styles.recipeDetailSummary}>
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
                  <span aria-hidden="true">・</span>{t.recipe.servingsUnit(detailServings)}
                </span>
                {detailRecipe.ingredients.length > 0 && (
                  <div className={styles.ingredientIconRow}>
                    {detailRecipe.ingredients.slice(0, 9).map((item, i) => (
                      <IngredientIcon key={i} name={item.name} size={25} />
                    ))}
                  </div>
                )}
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
                    <div className={styles.detailServingsControl} aria-label={t.recipe.servingsLabel}>
                      <button
                        type="button"
                        onClick={() => setServingOverrides((current) => ({ ...current, [detailRecipeKey]: Math.max(1, detailServings - 1) }))}
                        disabled={detailServings <= 1}
                        aria-label={language === 'ja' ? '人数を減らす' : 'Decrease servings'}
                      ><Minus size={17} strokeWidth={3} aria-hidden="true" /></button>
                      <strong>{t.recipe.servingsUnit(detailServings)}</strong>
                      <button
                        type="button"
                        onClick={() => setServingOverrides((current) => ({ ...current, [detailRecipeKey]: Math.min(15, detailServings + 1) }))}
                        disabled={detailServings >= 15}
                        aria-label={language === 'ja' ? '人数を増やす' : 'Increase servings'}
                      ><Plus size={17} strokeWidth={3} aria-hidden="true" /></button>
                    </div>
                  </div>
                  {detailServings !== detailBaseServings && (
                    <p className={styles.servingScaleNotice}>
                      {language === 'ja'
                        ? '分量は目安です。卵など分けにくい食材や調味料は、作りやすい量と味見で調整してください。'
                        : 'Amounts are estimates. Round indivisible ingredients and adjust seasonings to taste.'}
                    </p>
                  )}
                  <ul className={styles.ingredientList}>
                    {scaledDetailRecipe.ingredients.map((item, i) => {
                      const missing = isIngredientMissing(item.name, ingredients, userProfile.assumeSeasoningsAvailable);
                       const pinKey = `${detailRecipeKey}-${item.name}`;
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
                                 onClick={() => handlePinToShopping(detailRecipeKey, item.name)}
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
                      onClick={() => setCookingSessionRecipe(scaledDetailRecipe)}
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

                {detailRecipe.tips && isPremium && (
                  <div className={styles.tipsBox}>
                    <strong>{t.recipe.tipsPrefix}</strong> {detailRecipe.tips}
                  </div>
                )}

                {detailRecipe.tips && !isPremium && (
                  <button type="button" className={styles.premiumTipsGate} onClick={() => setShowPaywall(true)}>
                    <Lightbulb size={20} />
                    <span><strong>{t.recipe.tipsPlusTitle}</strong>{t.recipe.tipsPlusBody}</span>
                  </button>
                )}

                <button
                  type="button"
                  className={styles.cookedDetailBtn}
                  onClick={() => setCookedModalRecipe(scaledDetailRecipe)}
                >
                  {t.recipe.cookedButton}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PremiumPaywall open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}
