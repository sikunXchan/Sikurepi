"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Flame, Leaf, LockKeyhole, Search, Star, UtensilsCrossed, X } from "lucide-react";
import UiIcon from "./UiIcon";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getLocalUserStats } from "@/lib/storage";
import {
  buildIngredientCollection,
  type IngredientCollectionEntry,
  STREAK_BADGE_MILESTONES,
} from "@/lib/ingredientCollection";
import { buildDishCollection, type DishCollectionEntry } from "@/lib/dishCollection";
import styles from "./IngredientEncyclopedia.module.css";

type Filter = "all" | "unlocked" | "rescued";
type CollectionBook = "ingredient" | "dish";
type CollectionEntry = IngredientCollectionEntry | DishCollectionEntry;

const COLLECTION_PAGE_SIZE = 72;
const INGREDIENT_CATEGORIES = [
  "all", "vegetable", "mushroom_seaweed", "meat", "seafood", "egg_dairy_soy",
  "grain", "fruit_nut", "seasoning", "sweet", "drink", "other",
] as const;
const DISH_CATEGORIES = [
  "all", "rice", "noodle", "soup_stew", "meat", "seafood", "egg_bean",
  "vegetable", "bread_snack", "dessert_drink", "other",
] as const;

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("storage-updated", onStoreChange);
  window.addEventListener("stats-updated", onStoreChange);
  return () => {
    window.removeEventListener("storage-updated", onStoreChange);
    window.removeEventListener("stats-updated", onStoreChange);
  };
};

const getSnapshot = () => JSON.stringify(getLocalUserStats().cooked_records || []);
const getServerSnapshot = () => "[]";

function safeParseRecords(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function CollectionIcon({ entry, size = 64 }: { entry: CollectionEntry; size?: number }) {
  if (!entry.imageUrl) return <UiIcon slug="other" size={size} alt={entry.unlocked ? entry.displayName : ""} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={entry.imageUrl}
      alt={entry.unlocked ? entry.displayName : ""}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
    />
  );
}

export default function IngredientEncyclopedia() {
  const { t, language } = useLanguage();
  const recordsSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const records = useMemo(() => safeParseRecords(recordsSnapshot), [recordsSnapshot]);
  const ingredientSummary = useMemo(
    () => buildIngredientCollection(records, language),
    [language, records],
  );
  const dishSummary = useMemo(
    () => buildDishCollection(records, language),
    [language, records],
  );
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<CollectionBook>("ingredient");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CollectionEntry | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(COLLECTION_PAGE_SIZE);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, selected]);

  const isDishBook = book === "dish";
  const activeEntries: CollectionEntry[] = isDishBook ? dishSummary.entries : ingredientSummary.entries;
  const activeSummary = isDishBook ? dishSummary : ingredientSummary;
  const activeCategories = isDishBook ? DISH_CATEGORIES : INGREDIENT_CATEGORIES;
  const filters: Filter[] = isDishBook ? ["all", "unlocked"] : ["all", "unlocked", "rescued"];

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
    return activeEntries.filter((entry) => {
      if (filter === "unlocked" && !entry.unlocked) return false;
      if (filter === "rescued" && entry.rescueCount === 0) return false;
      if (category !== "all" && entry.category !== category) return false;
      if (normalizedQuery && !entry.displayName.normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [activeEntries, category, filter, query]);
  const visibleEntries = filteredEntries.slice(0, visibleLimit);
  const remainingEntries = filteredEntries.length - visibleEntries.length;

  const previewEntries = useMemo(
    () => [...ingredientSummary.entries.slice(0, 4), ...dishSummary.entries.slice(0, 4)],
    [dishSummary.entries, ingredientSummary.entries],
  );
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", { dateStyle: "medium" }).format(new Date(value))
    : "—";

  const switchBook = (nextBook: CollectionBook) => {
    setBook(nextBook);
    setFilter("all");
    setCategory("all");
    setQuery("");
    setSelected(null);
    setVisibleLimit(COLLECTION_PAGE_SIZE);
  };

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kitchen-book-title"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.bookMark}>{isDishBook ? <UtensilsCrossed size={21} /> : <BookOpen size={22} />}</span>
                <div>
                  <p>{t.myPage.collectionEyebrow}</p>
                  <h2 id="kitchen-book-title">{isDishBook ? t.myPage.dishCollectionTitle : t.myPage.ingredientCollectionTitle}</h2>
                </div>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label={t.myPage.collectionClose}><X size={20} /></button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.bookTabs} role="tablist" aria-label={t.myPage.collectionBookLabel}>
                <button type="button" role="tab" aria-selected={!isDishBook} className={!isDishBook ? styles.bookTabActive : ""} onClick={() => switchBook("ingredient")}>
                  <Leaf size={16} /><span>{t.myPage.ingredientCollectionTab}</span><small>{ingredientSummary.unlockedKnown}/{ingredientSummary.totalKnown}</small>
                </button>
                <button type="button" role="tab" aria-selected={isDishBook} className={isDishBook ? styles.bookTabActive : ""} onClick={() => switchBook("dish")}>
                  <UtensilsCrossed size={16} /><span>{t.myPage.dishCollectionTab}</span><small>{dishSummary.unlockedKnown}/{dishSummary.totalKnown}</small>
                </button>
              </div>

              <section className={styles.progressPanel}>
                <div className={styles.progressCopy}>
                  <strong>{t.myPage.collectionProgress(activeSummary.unlockedKnown, activeSummary.totalKnown)}</strong>
                  <span>{t.myPage.collectionCompletion(activeSummary.completionPercent)}</span>
                </div>
                <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${activeSummary.completionPercent}%` }} /></div>
                <div className={styles.progressStats}>
                  <span><BookOpen size={14} />{isDishBook ? t.myPage.dishCollectionDiscovered(activeSummary.discoveredCount) : t.myPage.collectionDiscovered(activeSummary.discoveredCount)}</span>
                  {!isDishBook && <span><Leaf size={14} />{t.myPage.collectionRescued(ingredientSummary.rescuedCount)}</span>}
                  <span><UtensilsCrossed size={14} />{t.myPage.collectionCatalogSize(activeSummary.totalKnown)}</span>
                </div>
              </section>

              {!isDishBook && (
                <section className={styles.streakPanel}>
                  <div className={styles.streakHeading}>
                    <span><Flame size={17} />{t.myPage.streakBadgesTitle}</span>
                    <small>{t.myPage.bestStreak(ingredientSummary.bestStreak)}</small>
                  </div>
                  <div className={styles.streakBadges}>
                    {STREAK_BADGE_MILESTONES.map((milestone) => {
                      const achieved = ingredientSummary.bestStreak >= milestone;
                      return (
                        <div key={milestone} className={`${styles.streakBadge} ${achieved ? styles.streakBadgeAchieved : ""}`}>
                          {achieved ? <Flame size={18} /> : <LockKeyhole size={15} />}
                          <strong>{milestone}</strong><small>{t.myPage.daysUnit}</small>
                        </div>
                      );
                    })}
                  </div>
                  <p>{ingredientSummary.nextStreakMilestone
                    ? t.myPage.nextStreakBadge(ingredientSummary.nextStreakMilestone - ingredientSummary.bestStreak, ingredientSummary.nextStreakMilestone)
                    : t.myPage.allStreakBadges}</p>
                </section>
              )}

              <div className={styles.tools}>
                <div className={styles.primaryTools}>
                  <label className={styles.searchBox}>
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setVisibleLimit(COLLECTION_PAGE_SIZE);
                      }}
                      placeholder={isDishBook ? t.myPage.dishCollectionSearch : t.myPage.collectionSearch}
                    />
                  </label>
                  <div className={styles.filters} role="group" aria-label={t.myPage.collectionFilterLabel}>
                    {filters.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={filter === value ? styles.filterActive : ""}
                        aria-pressed={filter === value}
                        onClick={() => {
                          setFilter(value);
                          setVisibleLimit(COLLECTION_PAGE_SIZE);
                        }}
                      >
                        {value === "all" ? t.myPage.collectionFilterAll : value === "unlocked" ? t.myPage.collectionFilterUnlocked : t.myPage.collectionFilterRescued}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.categoryStrip} role="group" aria-label={t.myPage.collectionCategoryLabel}>
                  {activeCategories.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={category === value ? styles.categoryActive : ""}
                      aria-pressed={category === value}
                      onClick={() => {
                        setCategory(value);
                        setVisibleLimit(COLLECTION_PAGE_SIZE);
                      }}
                    >
                      {t.myPage.collectionCategoryName(value)}
                    </button>
                  ))}
                </div>
              </div>

              {visibleEntries.length > 0 ? (
                <div className={styles.collectionGrid}>
                  {visibleEntries.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={!entry.unlocked}
                      className={`${styles.collectionItem} ${entry.unlocked ? styles.collectionItemUnlocked : styles.collectionItemLocked}`}
                      onClick={() => entry.unlocked && setSelected(entry)}
                      aria-label={entry.unlocked ? entry.displayName : `${entry.displayName}、${t.myPage.collectionLocked}`}
                    >
                      <span className={styles.iconWrap}>
                        <CollectionIcon entry={entry} />
                        {!isDishBook && entry.rescueCount > 0 && <span className={styles.rescueStamp} title={t.myPage.collectionRescueStamp}><Leaf size={12} /></span>}
                      </span>
                      <strong>{entry.displayName}</strong>
                      <span className={styles.masteryDots} aria-label={entry.unlocked ? t.myPage.masteryLevel(entry.masteryLevel) : undefined}>
                        {[1, 2, 3].map((level) => <i key={level} className={entry.masteryLevel >= level ? styles.masteryDotActive : ""} />)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.noResults}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mascot/bear_reading.png" alt="" width={82} height={82} />
                  <p>{isDishBook ? t.myPage.dishCollectionNoResults : t.myPage.collectionNoResults}</p>
                </div>
              )}
              {remainingEntries > 0 && (
                <button type="button" className={styles.showMoreButton} onClick={() => setVisibleLimit((current) => current + COLLECTION_PAGE_SIZE)}>
                  {t.myPage.collectionShowMore(Math.min(COLLECTION_PAGE_SIZE, remainingEntries), remainingEntries)}
                </button>
              )}
            </div>

            <AnimatePresence>
              {selected && (
                <motion.div className={styles.detailBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
                  <motion.article className={styles.detailSheet} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} onClick={(event) => event.stopPropagation()}>
                    <button type="button" className={styles.detailClose} onClick={() => setSelected(null)} aria-label={t.myPage.collectionClose}><X size={18} /></button>
                    <div className={styles.detailHero}>
                      <span className={styles.detailIcon}><CollectionIcon entry={selected} size={104} /></span>
                      <div>
                        <p>{t.myPage.masteryLevel(selected.masteryLevel)}</p>
                        <h3>{selected.displayName}</h3>
                        <div className={styles.masteryStars}>{[1, 2, 3].map((level) => <Star key={level} size={16} fill={selected.masteryLevel >= level ? "currentColor" : "none"} />)}</div>
                      </div>
                    </div>
                    <div className={`${styles.detailStats} ${isDishBook ? styles.detailStatsSingle : ""}`}>
                      <span><strong>{selected.usageCount}</strong>{isDishBook ? t.myPage.dishCollectionUses : t.myPage.collectionUses}</span>
                      {!isDishBook && <span><strong>{selected.rescueCount}</strong>{t.myPage.collectionRescueUses}</span>}
                    </div>
                    <div className={styles.masteryProgress}>
                      <div><span>{isDishBook ? t.myPage.dishMasteryTitle : t.myPage.masteryTitle}</span><strong>{selected.nextMasteryAt ? t.myPage.nextMastery(selected.nextMasteryAt - selected.usageCount) : t.myPage.masteryComplete}</strong></div>
                      <div className={styles.progressTrack}><span style={{ width: `${selected.nextMasteryAt ? Math.min(100, selected.usageCount / selected.nextMasteryAt * 100) : 100}%` }} /></div>
                    </div>
                    <dl className={styles.dateList}>
                      <div><dt>{isDishBook ? t.myPage.dishCollectionFirstUsed : t.myPage.collectionFirstUsed}</dt><dd>{formatDate(selected.firstUsedAt)}</dd></div>
                      <div><dt>{isDishBook ? t.myPage.dishCollectionLastUsed : t.myPage.collectionLastUsed}</dt><dd>{formatDate(selected.lastUsedAt)}</dd></div>
                    </dl>
                    <h4>{isDishBook ? t.myPage.dishCollectionRecipesTitle : t.myPage.collectionRecipesTitle}</h4>
                    <ul className={styles.recipeList}>
                      {selected.recipes.slice(0, 12).map((recipe, index) => (
                        <li key={`${recipe.date}-${recipe.title}-${index}`}>
                          <span>{!isDishBook && recipe.rescued ? <Leaf size={14} /> : <Check size={14} />}</span>
                          <div><strong>{recipe.title}</strong><small>{formatDate(recipe.date)}</small></div>
                        </li>
                      ))}
                    </ul>
                  </motion.article>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardCopy}>
          <p className={styles.eyebrow}>{t.myPage.collectionEyebrow}</p>
          <h2><BookOpen size={21} />{t.myPage.collectionTitle}</h2>
          <p className={styles.subtitle}>{t.myPage.collectionSubtitle}</p>
          <div className={styles.cardBookStats}>
            <span><Leaf size={13} />{t.myPage.ingredientCollectionTab}<strong>{ingredientSummary.unlockedKnown}/{ingredientSummary.totalKnown}</strong></span>
            <span><UtensilsCrossed size={13} />{t.myPage.dishCollectionTab}<strong>{dishSummary.unlockedKnown}/{dishSummary.totalKnown}</strong></span>
          </div>
        </div>
        <div className={styles.previewGrid} aria-hidden="true">
          {previewEntries.map((entry) => (
            <span key={entry.key} className={entry.unlocked ? styles.previewUnlocked : styles.previewLocked}>
              <CollectionIcon entry={entry} size={43} />
              {entry.rescueCount > 0 && <i><Leaf size={9} /></i>}
            </span>
          ))}
        </div>
        <button
          type="button"
          className={styles.openButton}
          onClick={() => {
            setVisibleLimit(COLLECTION_PAGE_SIZE);
            setOpen(true);
          }}
        >
          {t.myPage.collectionOpen}<BookOpen size={17} />
        </button>
      </section>
      {typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
