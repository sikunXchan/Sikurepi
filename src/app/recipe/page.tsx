"use client";

import { useEffect, useState } from "react";
import {
  ChefHat,
  Loader2,
  Bookmark,
  Check,
  Pin,
  Lightbulb,
  PlayCircle,
  Sparkles,
  ShoppingBag,
  Settings,
  Clock,
  Plus,
  Utensils
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import ClimateBar from "@/components/ClimateBar";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  saveLocalRecipe,
  addLocalShoppingItem,
  addLocalSavedTips,
  getRecentLocalRecipeNames,
  Ingredient,
  UserProfile,
  NutritionData
} from "@/lib/storage";
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
  difficulty?: 'かんたん' | 'ふつう' | 'むずかしい';
  rating?: number;
  category_tag?: 'メイン' | 'デザート' | 'その他';
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

const TEMPLATE_PRESETS = [
  { label: "🍱 栄養満点お弁当", prompt: "冷めても美味しく、汁気が出ない栄養バランス満点のお弁当おかず" },
  { label: "⏱ 10分クイック時短", prompt: "フライパンまたはレンジで10分以内にサッと作れる絶品時短メニュー" },
  { label: "🍲 からだ温まるヘルシー鍋・スープ", prompt: "野菜たっぷりで身体が芯から温まるヘルシーなスープ・鍋仕立て" },
  { label: "🍰 休日おうちカフェスイーツ", prompt: "おうちにある材料で手軽に作れる可愛いカフェ風デザート・おやつ" },
  { label: "💪 高タンパク・スタミナ飯", prompt: "タンパク質30g以上で脂質控えめ、筋肉と代謝を喜ばせるスタミナ料理" },
  { label: "🎉 特別な日のごちそう", prompt: "彩り華やかで家族や友達が喜ぶプチ贅沢ディナー" },
];

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(getLocalUserProfile());
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [instruction, setInstruction] = useState("");
  const [creationMode, setCreationMode] = useState<'free' | 'inventory'>('free');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([]);
  const [cookingRecipeIndex, setCookingRecipeIndex] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<Recipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadLocalData();
    const handleUpdate = () => loadLocalData();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadLocalData = () => {
    const list = getLocalIngredients();
    setIngredients(list);
    setUserProfile(getLocalUserProfile());
    setSelectedIngredientIds(list.filter(i => i.is_pinned).map(i => i.id));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSelectTemplate = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setInstruction(preset.prompt);
    showToast(`テンプレート「${preset.label}」をセットしました`);
  };

  const toggleIngredientSelection = (id: number) => {
    setSelectedIngredientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setRecipes([]);
    setCookingTips([]);

    try {
      const climate = getLocalClimateState();
      const recentRecipes = getRecentLocalRecipeNames(5);

      const targetIngredients = creationMode === 'inventory'
        ? ingredients.filter(i => selectedIngredientIds.length === 0 || selectedIngredientIds.includes(i.id)).map(i => i.name)
        : [];

      const payload = {
        ingredients: targetIngredients,
        instruction: instruction.trim() || undefined,
        servings: userProfile.servings || undefined,
        recentRecipes,
        tastePreferences: userProfile.tastePreferences.length > 0 ? userProfile.tastePreferences : undefined,
        excludedIngredients: userProfile.excludedIngredients.length > 0 ? userProfile.excludedIngredients : undefined,
        cookingStyles: userProfile.cookingStyles.length > 0 ? userProfile.cookingStyles : undefined,
        climate: userProfile.enableClimate ? climate : undefined,
      };

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("レシピの作成に失敗しました");
      }

      const data = await res.json();
      const generatedList: Recipe[] = (data.recipes || []).map((r: any) => ({
        ...r,
        difficulty: r.difficulty || (r.time?.includes("10") ? "かんたん" : "ふつう"),
        rating: r.rating || 5,
        category_tag: r.category_tag || (r.title?.includes("ケーキ") || r.title?.includes("スイーツ") ? "デザート" : "メイン"),
      }));
      setRecipes(generatedList);

      if (Array.isArray(data.cooking_tips) && data.cooking_tips.length > 0) {
        setCookingTips(data.cooking_tips);
        const added = addLocalSavedTips(data.cooking_tips);
        if (added > 0) {
          showToast(`💡 ${added}件の料理のコツをマイページに保存しました！`);
        }
      }

      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff758f', '#ffb703', '#52b788'],
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = (index: number) => {
    const r = recipes[index];
    if (!r) return;

    try {
      saveLocalRecipe({
        title: r.title,
        time: r.time,
        difficulty: r.difficulty || 'ふつう',
        rating: r.rating || 5,
        category_tag: r.category_tag || 'メイン',
        ingredients: r.ingredients,
        steps: r.steps,
        tips: r.tips,
        image_url: r.image_url,
        nutrition: r.nutrition || null,
        genre: r.genre || null,
      });

      setSavedSet(prev => new Set(prev).add(index));
      showToast(`💖 「${r.title}」をお気に入りに保存しました！`);
    } catch (e) {
      console.error(e);
      showToast("保存に失敗しました");
    }
  };

  const handleAddToShopping = (ingName: string) => {
    addLocalShoppingItem(ingName);
    showToast(`🛒 「${ingName}」を買い物リストに追加しました！`);
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(74, 40, 53, 0.95)', color: 'white', padding: '8px 18px',
          borderRadius: 9999, fontSize: 12, fontWeight: 700, zIndex: 9999, pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className={styles.title} style={{ margin: 0, fontSize: 22, color: '#ff5c8a', fontWeight: 900 }}>
          🍳 AIレシピ提案
        </h1>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
            border: '2px solid #ffd1dc', borderRadius: 9999, padding: '6px 14px',
            fontSize: 12, fontWeight: 800, color: '#8c3b58', cursor: 'pointer',
          }}
        >
          <Settings size={14} color="#ff5c8a" />
          <span>マイ設定・統計</span>
        </button>
      </div>

      <ClimateBar />

      <div style={{
        display: 'flex', background: '#ffffff', border: '2px solid #ffd1dc',
        borderRadius: 9999, padding: 4, gap: 4,
      }}>
        <button
          type="button"
          onClick={() => setCreationMode('free')}
          style={{
            flex: 1,
            background: creationMode === 'free' ? 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)' : 'transparent',
            color: creationMode === 'free' ? 'white' : '#8c3b58',
            border: 'none', borderRadius: 9999, padding: '8px 12px',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >
          <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          自由作成 ＆ テンプレート
        </button>
        <button
          type="button"
          onClick={() => setCreationMode('inventory')}
          style={{
            flex: 1,
            background: creationMode === 'inventory' ? 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)' : 'transparent',
            color: creationMode === 'inventory' ? 'white' : '#8c3b58',
            border: 'none', borderRadius: 9999, padding: '8px 12px',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >
          <Utensils size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          ❄️ 冷蔵庫の在庫を使う ({ingredients.length})
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8c3b58', marginBottom: 6 }}>
            ✨ ワンタップ・おすすめテンプレート
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TEMPLATE_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectTemplate(preset)}
                style={{
                  background: '#fff0f3', border: '1.5px solid #ffd1dc', color: '#4a2835',
                  padding: '5px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: '#4a2835', display: 'block', marginBottom: 4 }}>
            📝 リクエストや気分（自由に入力できます）
          </label>
          <textarea
            rows={2}
            placeholder="例: 子供が喜ぶチーズを使った料理、フライパン1つのパスタ、さっぱりした副菜など"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #ffd1dc' }}
          />
        </div>

        {creationMode === 'inventory' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#4a2835', marginBottom: 6 }}>
              🧺 使いたい食材を選択（未選択時は全在庫からAIが判断）:
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
                        background: isSelected ? '#ff5c8a' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#4a2835',
                        border: '1.5px solid #ffd1dc', padding: '4px 10px',
                        borderRadius: 9999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {ing.is_pinned && '📌 '}
                      {ing.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: '#a07888' }}>
                冷蔵庫に食材がありません。「自由作成」モードでレシピを作成できます。
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 800,
            background: 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)',
            color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
          }}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={18} />
              AIシェフが絶品レシピを考案中...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              ✨ AIにレシピを作ってもらう！
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: '#fff0f3', border: '1.5px solid #ff758f', borderRadius: 16, padding: '12px', color: '#e0245e', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      {recipes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ff5c8a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🎀</span> AIが考案したレシピ ({recipes.length}品)
          </div>

          {recipes.map((recipe, idx) => {
            const isSaved = savedSet.has(idx);
            return (
              <div key={idx} className="card">
                {/* ヘッダー: タイトル・難易度・カテゴリタグ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, background: '#ffe5ec', color: '#ff5c8a', padding: '2px 8px', borderRadius: 9999 }}>
                        {recipe.category_tag || 'メイン'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, background: '#d8f3dc', color: '#2d6a4f', padding: '2px 8px', borderRadius: 9999 }}>
                        👨‍🍳 {recipe.difficulty || 'かんたん'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#ffb703' }}>
                        {'★'.repeat(recipe.rating || 5)}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#4a2835', margin: 0 }}>
                      {recipe.title}
                    </h2>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a07888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      {recipe.time}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveRecipe(idx)}
                    style={{
                      background: isSaved ? '#f1f3f5' : '#ffb703',
                      color: isSaved ? '#868e96' : 'white',
                      border: 'none',
                      borderRadius: 9999,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      boxShadow: isSaved ? 'none' : '0 3px 10px rgba(255, 183, 3, 0.35)',
                      cursor: isSaved ? 'default' : 'pointer',
                    }}
                  >
                    {isSaved ? (
                      <>
                        <Check size={13} />
                        保存済み
                      </>
                    ) : (
                      <>
                        <Bookmark size={13} />
                        保存する 🐾
                      </>
                    )}
                  </button>
                </div>

                {/* 栄養成分PFC */}
                {recipe.nutrition && (
                  <div style={{ marginBottom: 12 }}>
                    <NutritionChart nutrition={recipe.nutrition} />
                  </div>
                )}

                {/* 材料リスト (メモ帳風カード) */}
                <div style={{ background: '#fff8fa', border: '1.5px solid #ffd1dc', borderRadius: 18, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#8c3b58', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>👨‍🍳 材料 (タップで買い物リストへ追加)</span>
                    <span style={{ fontSize: 10, color: '#a07888' }}>🛒 追加</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recipe.ingredients.map((ing, iIdx) => (
                      <div
                        key={iIdx}
                        onClick={() => handleAddToShopping(ing.name)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 8px',
                          background: '#ffffff',
                          border: '1px dashed #ffd1dc',
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        title="タップして買い物リストに追加"
                      >
                        <span style={{ fontWeight: 700, color: '#4a2835' }}>• {ing.name}</span>
                        <span style={{ color: '#8c3b58', fontWeight: 600 }}>{ing.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 作り方手順 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#ff5c8a', marginBottom: 6 }}>
                    🎀 作り方
                  </div>
                  <ol style={{ paddingLeft: 20, margin: 0, fontSize: 12, lineHeight: 1.6, color: '#4a2835' }}>
                    {recipe.steps.map((step, sIdx) => (
                      <li key={sIdx} style={{ marginBottom: 4 }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 料理のコツ＆Tips */}
                {recipe.tips && (
                  <div style={{ background: '#fff0f3', borderLeft: '4px solid #ff5c8a', padding: '8px 12px', borderRadius: '0 12px 12px 0', fontSize: 11, color: '#4a2835', marginBottom: 14, lineHeight: 1.4 }}>
                    💡 <strong>シェフのコツ:</strong> {recipe.tips}
                  </div>
                )}

                {/* アクションボタン */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCookingRecipeIndex(idx)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #74c69d 0%, #52b788 100%)',
                      boxShadow: '0 4px 12px rgba(82, 183, 136, 0.35)',
                    }}
                  >
                    <PlayCircle size={15} />
                    クッキングモード
                  </button>

                  <button
                    type="button"
                    onClick={() => setCookedModalRecipe(recipe)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #ff758f 0%, #ff5c8a 100%)',
                    }}
                  >
                    🍳 この料理を作った！
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* クッキングセッション */}
      {cookingRecipeIndex !== null && recipes[cookingRecipeIndex] && (
        <CookingSession
          recipe={recipes[cookingRecipeIndex]}
          onClose={() => setCookingRecipeIndex(null)}
          onShowToast={showToast}
        />
      )}

      {/* 調理完了モーダル */}
      {cookedModalRecipe && (
        <CookedModal
          recipe={cookedModalRecipe}
          onClose={() => setCookedModalRecipe(null)}
          onCompleted={() => {
            loadLocalData();
            showToast("🎉 調理を記録し、PFC統計を更新しました！");
          }}
        />
      )}

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadLocalData}
      />
    </div>
  );
}


