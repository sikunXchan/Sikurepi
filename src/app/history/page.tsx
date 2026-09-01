"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, History, ChevronDown, ChevronUp, RefreshCw, BookOpen, ChefHat, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import NutritionChart from "@/components/NutritionChart";
import { getApiHeaders } from "@/lib/user";
import styles from "./History.module.css";

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

type SavedRecipe = {
  id: number;
  title: string;
  time: string;
  ingredients: RecipeItem[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition: NutritionData | null;
  genre: string | null;
  saved_at: string;
};

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
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [remakingId, setRemakingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);

  // Search/filter state
  const [searchText, setSearchText] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterTimeMax, setFilterTimeMax] = useState('');

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-recipes", { headers: getApiHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllRecipes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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

  const handleDelete = async () => {
    if (targetId === null) return;
    const id = targetId;
    setModalOpen(false);
    setDeletingId(id);
    try {
      await fetch(`/api/saved-recipes/${id}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      setAllRecipes(allRecipes.filter(r => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
      setTargetId(null);
    }
  };

  const handleRecook = async (id: number) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/saved-recipes/${id}`, {
        method: "PATCH",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const updated = await res.json();
        setAllRecipes(prev => {
          const filtered = prev.filter(r => r.id !== id);
          return [updated, ...filtered];
        });

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#ff7849', '#20b2aa', '#fbbf24', '#f472b6'],
        });
      }
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemake = async (recipe: SavedRecipe) => {
    setRemakingId(recipe.id);
    try {
      const res = await fetch("/api/recipes/remake", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ recipe }),
      });
      const remakeData = await res.json();

      if (!res.ok) throw new Error(remakeData.error || "リメイクに失敗しました");

      const saveRes = await fetch("/api/saved-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...remakeData, image_url: null }),
      });

      if (saveRes.ok) {
        const saved = await saveRes.json();
        setAllRecipes([saved, ...allRecipes]);
        setExpandedId(saved.id);

        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff7849', '#f472b6', '#8b5cf6'],
        });
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setRemakingId(null);
    }
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
      <h1 className={styles.title}>📚 レシピ履歴</h1>

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
                    className={styles.remakeBtn}
                    onClick={(e) => { e.stopPropagation(); handleRemake(recipe); }}
                    disabled={remakingId === recipe.id}
                  >
                    {remakingId === recipe.id ? (
                      <Loader2 className="spinner" size={14} />
                    ) : (
                      <ChefHat size={14} />
                    )}
                    この残りでリメイク！
                  </button>
                  <button
                    className={styles.recookBtn}
                    onClick={(e) => { e.stopPropagation(); handleRecook(recipe.id); }}
                    disabled={updatingId === recipe.id}
                    title="今日作った"
                  >
                    {updatingId === recipe.id ? (
                      <Loader2 className="spinner" size={14} />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    再作成
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); confirmDelete(recipe.id); }}
                    disabled={deletingId === recipe.id}
                  >
                    {deletingId === recipe.id ? (
                      <Loader2 className="spinner" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
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
    </div>
  );
}
