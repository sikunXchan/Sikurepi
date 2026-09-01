"use client";

import { useEffect, useState } from "react";
import { Trash2, Search, X, Clock, PlayCircle, Utensils, Heart } from "lucide-react";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import {
  getLocalSavedRecipes,
  deleteLocalSavedRecipe,
  SavedRecipe
} from "@/lib/storage";
import styles from "./History.module.css";

export default function HistoryPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [activeTab, setActiveTab] = useState<'すべて' | 'メイン' | 'デザート'>('すべて');
  const [searchText, setSearchText] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<SavedRecipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadData = () => {
    setRecipes(getLocalSavedRecipes());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDelete = (id: number, title: string) => {
    deleteLocalSavedRecipe(id);
    loadData();
    showToast(`🗑️ 「${title}」を削除しました`);
  };

  const filtered = recipes.filter(r => {
    if (activeTab === 'メイン' && r.category_tag === 'デザート') return false;
    if (activeTab === 'デザート' && r.category_tag !== 'デザート') return false;

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchIng = r.ingredients?.some(i => i.name.toLowerCase().includes(q));
      if (!matchTitle && !matchIng) return false;
    }
    return true;
  });

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(74, 40, 53, 0.95)',
          color: 'white',
          padding: '8px 18px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(255, 92, 138, 0.3)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <h1 className={styles.title}>❤️ お気に入り・レシピ履歴</h1>

      {/* 検索バー */}
      <div className={styles.searchBar}>
        <Search size={16} color="#ff5c8a" />
        <input
          type="text"
          placeholder="レシピや食材を検索... 🐾"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={styles.searchInput}
        />
        {searchText && (
          <button
            type="button"
            onClick={() => setSearchText("")}
            style={{ background: 'none', border: 'none', color: '#c9a7b5', padding: 0, boxShadow: 'none', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ピル型カテゴリタブ (すべて / メイン / デザート) */}
      <div className={styles.tabRow}>
        {(['すべて', 'メイン', 'デザート'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* レシピ一覧 */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(recipe => (
            <div key={recipe.id} className={styles.recipeCard}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.badgeRow}>
                    <span className={styles.categoryBadge}>
                      {recipe.category_tag || 'メイン'}
                    </span>
                    <span className={
                      recipe.difficulty === 'むずかしい' ? styles.diffHard :
                      recipe.difficulty === 'ふつう' ? styles.diffNormal : styles.diffEasy
                    }>
                      👨‍🍳 {recipe.difficulty || 'かんたん'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#ffb703' }}>
                      {'★'.repeat(recipe.rating || 5)}
                    </span>
                  </div>

                  <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                  <div className={styles.recipeMeta}>
                    <Clock size={12} />
                    <span>{recipe.time}</span>
                    <span>• 📅 {recipe.saved_at.split('T')[0]}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(recipe.id, recipe.title)}
                  title="削除"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* 栄養バランスPFC */}
              {recipe.nutrition && (
                <div>
                  <NutritionChart nutrition={recipe.nutrition} />
                </div>
              )}

              {/* 材料 */}
              <div style={{ background: '#fff8fa', border: '1.5px solid #ffd1dc', borderRadius: 16, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8c3b58', marginBottom: 4 }}>
                  👨‍🍳 材料
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                  {(recipe.ingredients || []).map((ing, iIdx) => (
                    <span key={iIdx} style={{ background: '#ffffff', border: '1px solid #ffd1dc', padding: '2px 8px', borderRadius: 9999, color: '#4a2835', fontWeight: 600 }}>
                      {ing.name} ({ing.amount})
                    </span>
                  ))}
                </div>
              </div>

              {/* アクションボタン */}
              <div className={styles.actionRow}>
                <button
                  type="button"
                  onClick={() => setCookingSessionRecipe(recipe)}
                  style={{
                    background: 'linear-gradient(135deg, #74c69d 0%, #52b788 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PlayCircle size={14} />
                  クッキング
                </button>

                {/* 履歴画面の「この料理を作った！」ボタン */}
                <button
                  type="button"
                  className={styles.cookBtn}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  🍳 この料理を作った！（記録）
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#a07888' }}>
          <Heart size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ fontSize: 13, fontWeight: 700 }}>
            {recipes.length === 0 ? "まだ保存されたレシピがありません" : "該当するレシピが見つかりませんでした"}
          </p>
        </div>
      )}

      {/* 調理完了モーダル */}
      {selectedRecipe && (
        <CookedModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onCompleted={() => {
            loadData();
            showToast("🎉 調理を記録し、PFC統計を更新しました！");
          }}
        />
      )}

      {/* クッキングセッション */}
      {cookingSessionRecipe && (
        <CookingSession
          recipe={cookingSessionRecipe}
          onClose={() => setCookingSessionRecipe(null)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}
