"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, ChevronDown, ChevronUp, Search, X, PlayCircle, Check, Plus } from "lucide-react";
import { getIngredientIconUrl } from "@/lib/ingredientIcons";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import IngredientIcon from "@/components/IngredientIcon";
import RecipeThumbnail, { GENRE_ICON_SLUGS } from "@/components/RecipeThumbnail";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  getLocalSavedRecipes,
  deleteLocalSavedRecipe,
  getLocalIngredients,
  addLocalShoppingItem,
  isIngredientMissing,
  getLocalUserProfile,
  SavedRecipe,
  Ingredient,
  UserProfile
} from "@/lib/storage";
import styles from "./History.module.css";

// ジャンル別サムネイル(RecipeThumbnail)と同じ一覧を使い回し、追加時の二重管理を防ぐ
const GENRE_OPTIONS = Object.keys(GENRE_ICON_SLUGS);

export default function HistoryPage() {
  const { t, language } = useLanguage();
  const TIME_OPTIONS = t.history.timeOptions;
  const [allRecipes, setAllRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<SavedRecipe | null>(null);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<SavedRecipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(getLocalUserProfile());
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());

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
    setIngredients(getLocalIngredients());
    setUserProfile(getLocalUserProfile());
    setLoading(false);
  };

  const handlePinToShopping = (recipeId: number, ingredientName: string) => {
    const key = `${recipeId}-${ingredientName}`;
    if (pinnedToShoppingSet.has(key)) return;
    addLocalShoppingItem(ingredientName);
    setPinnedToShoppingSet(prev => new Set(prev).add(key));
    showToast(t.recipe.pinnedToShoppingToast(ingredientName));
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
    showToast(t.history.deletedToast);
  };

  // サムネイルは犬(main.png/sub.png)固定だったのを、レシピの主材料アイコンに変更。
  // アイコンが見つかる最初の材料を選ぶ（無ければIngredientIcon側のプレースホルダーに任せる）。
  const getRecipeMainIngredientName = (recipe: SavedRecipe): string => {
    const list = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const withIcon = list.find(i => getIngredientIconUrl(i.name));
    return (withIcon || list[0])?.name || recipe.title;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
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
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <PageHeader
        title={t.history.title}
        subtitle={t.history.subtitle}
        mascot="bear_reading"
      />

      {/* Search & Filter */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={t.history.searchPlaceholder}
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
            <option value="">{t.history.genreAll}</option>
            {GENRE_OPTIONS.map(g => (
              <option key={g} value={g}>{t.tagLabel[g] || g}</option>
            ))}
          </select>

          <select
            value={filterTimeMax}
            onChange={e => setFilterTimeMax(e.target.value)}
            className={styles.filterSelect}
          >
            {TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.value ? `⏱ ${opt.label}` : t.history.timeAll}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              <X size={13} /> {t.history.resetFilters}
            </button>
          )}
        </div>

        {hasFilters && (
          <p className={styles.filterResult}>
            {t.history.filterResultCount(filteredRecipes.length, allRecipes.length)}
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
              <h2 className={styles.modalTitle}>{t.history.deleteConfirmTitle}</h2>
              <p className={styles.modalText}>
                {t.history.deleteConfirmLine1}<br />{t.history.deleteConfirmLine2}
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  {t.history.cancel}
                </button>
                <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
                  {t.history.confirmDelete}
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
                  <RecipeThumbnail
                    genre={recipe.genre}
                    fallbackIngredientName={getRecipeMainIngredientName(recipe)}
                    size={50}
                    className={styles.recipeIcon}
                  />

                  <div className={styles.titleInfo}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <div className={styles.recipeMetaRow}>
                      <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                      {recipe.genre && (
                        <span className={styles.genreBadge}>{t.tagLabel[recipe.genre] || recipe.genre}</span>
                      )}
                      {recipe.dish_badge && (
                        <span className={styles.genreBadge}>{recipe.dish_badge}</span>
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
                    {t.history.cookingButton}
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1.3,
                      background: 'linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)',
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
                      boxShadow: '0 2px 8px rgba(255, 111, 145, 0.25)',
                    }}
                    onClick={(e) => { e.stopPropagation(); setCookedModalRecipe(recipe); }}
                  >
                    {t.history.cookedButton}
                  </button>

                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); confirmDelete(recipe.id); }}
                    title={t.history.deleteButtonTitle}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className={styles.detailBody}>
                    {recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <h3 className={styles.nutritionTitle}>{t.history.nutritionTitle}</h3>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    <div className={styles.section}>
                      <h3>{t.history.ingredientsTitle}</h3>
                      <ul className={styles.ingredientList}>
                        {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item, i) => {
                          const missing = isIngredientMissing(item.name, ingredients, userProfile.assumeSeasoningsAvailable);
                          const pinKey = `${recipe.id}-${item.name}`;
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
                                    onClick={(e) => { e.stopPropagation(); handlePinToShopping(recipe.id, item.name); }}
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
                      <h3>{t.history.stepsTitle}</h3>
                      <ol className={styles.stepList}>
                        {(Array.isArray(recipe.steps) ? recipe.steps : []).map((step, i) => (
                          <li key={i}>
                            <span className={styles.stepNumber}>{i + 1}</span>
                            <span className={styles.stepText}>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && (
                      <div className={styles.tipsBox}>
                        <strong>{t.history.tipsPrefix}</strong> {recipe.tips}
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
              <p>{t.history.noFilterResults}</p>
              <button className={styles.clearFiltersBtn2} onClick={clearFilters}>{t.history.resetFiltersButton2}</button>
            </div>
          )}

          {allRecipes.length === 0 && (
            <div className={styles.emptyState}>
              <img src="/mascot/bear_reading.png" alt="" width={96} height={96} />
              <p>{t.history.emptyState}</p>
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
              showToast(t.recipe.cookedCompletedToast);
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

