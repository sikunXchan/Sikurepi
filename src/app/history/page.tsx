"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, ChevronDown, ChevronUp, BookOpen, Search, X, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import {
  getLocalSavedRecipes,
  deleteLocalSavedRecipe,
  SavedRecipe
} from "@/lib/storage";
import styles from "./History.module.css";

const GENRE_OPTIONS = ['和食', '洋食', '中華', 'アジア料理', 'イタリアン', 'フレンチ', 'その他'];
const TIME_OPTIONS = [
  { label: 'すべて', value: '' },
  { label: '10分以内', value: '10' },
  { label: '30分以内', value: '30' },
  { label: '60分以内', value: '60' },
];

export default function HistoryPage() {
  const [allRecipes, setAllRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<SavedRecipe | null>(null);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<SavedRecipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search/filter state
  const [searchText, setSearchText] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterTimeMax, setFilterTimeMax] = useState('');

  useEffect(() => {
    loadRecipes();
    const handleUpdate = () => loadRecipes();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
  }, []);

  const loadRecipes = () => {
    setAllRecipes(getLocalSavedRecipes());
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Client-side filtering
  const filteredRecipes = allRecipes.filter(recipe => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const inTitle = recipe.title.toLowerCase().includes(q);
      const inIngredients = Array.isArray(recipe.ingredients) &&
        recipe.ingredients.some(i => i.name.toLowerCase().includes(q));
      if (!inTitle && !inIngredients) return false;
    }
    if (filterGenre && recipe.genre !== filterGenre) return false;
    if (filterTimeMax) {
      const match = (recipe.time || '').match(/(\d+)/);
      if (match && parseInt(match[1], 10) > parseInt(filterTimeMax, 10)) return false;
    }
    return true;
  });

  const hasFilters = searchText || filterGenre || filterTimeMax;

  const clearFilters = () => {
    setSearchText('');
    setFilterGenre('');
    setFilterTimeMax('');
  };

  const confirmDelete = (id: number) => {
    setTargetId(id);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (targetId === null) return;
    deleteLocalSavedRecipe(targetId);
    if (expandedId === targetId) setExpandedId(null);
    setModalOpen(false);
    setTargetId(null);
    loadRecipes();
    showToast("🗑️ レシピを履歴から削除しました");
  };

  const getRecipeIcon = (recipe: SavedRecipe) => {
    const timeStr = recipe.time || "";
    const match = timeStr.match(/(\d+)/);
    const minutes = match ? parseInt(match[0], 10) : 10;
    return minutes <= 9 ? "/sub.png" : "/main.png";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
          fontSize: 12,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <h1 className={styles.title}>📚 レシピ履歴・保存</h1>

      {/* Search & Filter */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="料理名・食材名で検索…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className={styles.searchInput}
          />
          {searchText && (
            <button className={styles.clearBtn} onClick={() => setSearchText('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.filterRow}>
          <select
            value={filterGenre}
            onChange={e => setFilterGenre(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">ジャンル: すべて</option>
            {GENRE_OPTIONS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={filterTimeMax}
            onChange={e => setFilterTimeMax(e.target.value)}
            className={styles.filterSelect}
          >
            {TIME_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>
                {t.value ? `⏱ ${t.label}` : '時間: すべて'}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              <X size={13} /> リセット
            </button>
          )}
        </div>

        {hasFilters && (
          <p className={styles.filterResult}>
            {filteredRecipes.length} 件 / 全{allRecipes.length}件
          </p>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className={styles.modalIcon}>
                <Trash2 size={32} />
              </div>
              <h2 className={styles.modalTitle}>本当に削除しますか？</h2>
              <p className={styles.modalText}>
                このレシピを履歴から削除します。<br />この操作は取り消せません。
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  キャンセル
                </button>
                <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
                  削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && (
        <>
          {filteredRecipes.map((recipe) => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div key={recipe.id} className={styles.recipeCard}>
                <div
                  className={styles.cardTopRow}
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  <img
                    src={getRecipeIcon(recipe)}
                    alt={recipe.title}
                    className={styles.recipeIcon}
                  />

                  <div className={styles.titleInfo}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <div className={styles.recipeMetaRow}>
                      <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                      {recipe.genre && (
                        <span className={styles.genreBadge}>{recipe.genre}</span>
                      )}
                    </div>
                    <div className={styles.savedDate}>
                      📅 {formatDate(recipe.saved_at)}
                    </div>
                  </div>

                  <button className={styles.expandBtn}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      background: 'var(--gradient-cool)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onClick={(e) => { e.stopPropagation(); setCookingSessionRecipe(recipe); }}
                  >
                    <PlayCircle size={15} />
                    クッキング
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1.3,
                      background: 'linear-gradient(135deg, #ff7849 0%, #ff5722 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(255, 120, 73, 0.25)',
                    }}
                    onClick={(e) => { e.stopPropagation(); setCookedModalRecipe(recipe); }}
                  >
                    🍳 この料理を作った！
                  </button>

                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); confirmDelete(recipe.id); }}
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className={styles.detailBody}>
                    {recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <h3 className={styles.nutritionTitle}>📊 栄養バランス</h3>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    <div className={styles.section}>
                      <h3>材料・調味料</h3>
                      <ul className={styles.ingredientList}>
                        {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item, i) => (
                          <li key={i}>
                            <span>{item.name}</span>
                            <span className="text-muted">{item.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <h3>作り方</h3>
                      <ol className={styles.stepList}>
                        {(Array.isArray(recipe.steps) ? recipe.steps : []).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && (
                      <div className={styles.tipsBox}>
                        <strong>💡 ポイント: </strong> {recipe.tips}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredRecipes.length === 0 && allRecipes.length > 0 && (
            <div className={styles.emptyState}>
              <Search size={48} style={{ opacity: 0.4 }} />
              <p>条件に合うレシピが見つかりませんでした</p>
              <button className={styles.clearFiltersBtn2} onClick={clearFilters}>フィルターをリセット</button>
            </div>
          )}

          {allRecipes.length === 0 && (
            <div className={styles.emptyState}>
              <BookOpen size={48} style={{ opacity: 0.5 }} />
              <p>保存されたレシピはありません</p>
            </div>
          )}
        </>
      )}

      {/* 調理完了モーダル */}
      <AnimatePresence>
        {cookedModalRecipe && (
          <CookedModal
            recipe={cookedModalRecipe}
            onClose={() => setCookedModalRecipe(null)}
            onCompleted={() => {
              loadRecipes();
              showToast("🎉 自炊記録とお使いの在庫を更新しました！");
            }}
          />
        )}
      </AnimatePresence>

      {/* クッキングセッション */}
      <AnimatePresence>
        {cookingSessionRecipe && (
          <CookingSession
            title={cookingSessionRecipe.title}
            steps={cookingSessionRecipe.steps || []}
            ingredients={cookingSessionRecipe.ingredients || []}
            onClose={() => setCookingSessionRecipe(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

