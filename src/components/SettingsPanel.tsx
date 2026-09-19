"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate as animateValue, PanInfo } from "framer-motion";
import {
  getLocalUserProfile,
  setLocalUserProfile,
  UserProfile,
  DEFAULT_USER_PROFILE,
  exportBackupJSON,
  importBackupJSON,
  getLocalUserStats,
  getLocalSavedTips,
  deleteLocalSavedTip,
  deleteLocalCookedRecord,
  getForgottenIngredients,
  getIgnoredForgottenIngredientIds,
  ignoreForgottenIngredient,
  clearIgnoredForgottenIngredients,
  DEFAULT_USER_STATS,
  UserStats,
  CookedRecord,
  SavedTip,
  Ingredient
} from "@/lib/storage";
import { Download, Upload, Check, Trash2, Activity, Lightbulb, User, Database, Mail, LogOut, EyeOff, RotateCcw, Crown, Film } from "lucide-react";
import IngredientIcon from "./IngredientIcon";
import { GENRE_ICON_SLUGS } from "./RecipeThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { TRAY_THEMES, TrayThemeId } from "@/lib/trayThemes";
import { DIETARY_RESTRICTION_OPTIONS } from "@/lib/dietaryRules";
import { FREE_HISTORY_ITEMS } from "@/lib/premiumQuota";
import { usePremium } from "@/lib/premium/PremiumContext";
import PremiumPaywall from "./PremiumPaywall";
import { applyProfileChange, parseExcludedIngredients, type ProfileChange } from "@/lib/profileSettings";
import { hasVideoShowcaseBackup, installVideoShowcaseData, restoreBeforeVideoShowcaseData } from "@/lib/videoShowcaseData";
import styles from "./ProfileSettingsModal.module.css";

const RECORD_SWIPE_OPEN_X = -68;
const RECORD_SWIPE_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

// 自炊記録1件分の横スライド削除行。在庫タブのSwipeableIngredientRowと同じ
// ジェスチャー(左にドラッグで削除ボタンを出す→そのボタンを押して初めて削除)にし、
// 「意図しないタップだけで削除される」ことがないようにする。
function SwipeableRecordRow({
  record,
  isOpen,
  onOpenChange,
  onDelete,
  deleteTitle,
}: {
  record: CookedRecord;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleteTitle: string;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [RECORD_SWIPE_OPEN_X, RECORD_SWIPE_OPEN_X / 2, 0], [1, 1, 0]);

  useEffect(() => {
    if (!isOpen) animateValue(x, 0, RECORD_SWIPE_SPRING);
  }, [isOpen, x]);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const shouldOpen = info.offset.x < -32 || info.velocity.x < -300;
    animateValue(x, shouldOpen ? RECORD_SWIPE_OPEN_X : 0, RECORD_SWIPE_SPRING);
    onOpenChange(shouldOpen);
  };

  return (
    <div className={styles.recordSwipeWrapper}>
      <motion.div className={styles.recordSwipeDeleteBg} style={{ opacity: bgOpacity }}>
        <button type="button" className={styles.recordSwipeDeleteBtn} onClick={onDelete} title={deleteTitle}>
          <Trash2 size={16} />
        </button>
      </motion.div>
      <motion.div
        className={styles.recordRow}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: RECORD_SWIPE_OPEN_X, right: 0 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        onTap={() => { if (isOpen) onOpenChange(false); }}
      >
        <div className={styles.recordMain}>
          <div className={styles.recordTitle}>{record.recipeTitle}</div>
          <div className={styles.recordDate}>{new Date(record.date).toLocaleDateString('ja-JP')}</div>
        </div>
        <div className={styles.recordNutrition}>
          {record.calories ? `${record.calories}kcal` : ''}
          {record.protein_g ? ` (P:${record.protein_g}g)` : ''}
        </div>
      </motion.div>
    </div>
  );
}

// 優先ジャンル選択の選択肢。ジャンル別サムネイルと同じ一覧を使い回して二重管理を防ぐ
// (「その他」はジャンルとして選ぶ意味が薄いため除外)
const PREFERRED_GENRE_OPTIONS = Object.keys(GENRE_ICON_SLUGS).filter(g => g !== "その他");

const TASTE_OPTIONS = [
  "うす味・減塩",
  "しっかり濃いめ",
  "高タンパク",
  "低糖質・ヘルシー",
  "辛さ控えめ",
  "酸味が苦手",
  "子供が喜ぶ味付け",
  "お酒のおつまみ風",
];

const STYLE_OPTIONS = [
  "15分以内の時短",
  "フライパン1つ（ワンパン）",
  "電子レンジフル活用",
  "節約・高コスパ",
  "作り置き・常備菜",
  "包丁・まな板最小限",
];

type TabType = 'profile' | 'stats' | 'tips' | 'backup';

type Props = {
  onSaved?: () => void;
};

// マイ設定モーダルとマイページの両方から使われる共通の中身。
// モーダル側はこのコンポーネントをオーバーレイでラップし、マイページはPageHeaderの下にそのまま埋め込む。
export default function SettingsPanel({ onSaved }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const { isPremium } = usePremium();
  const { user, isSupabaseConfigured, sendLoginCode, verifyLoginCode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [accountEmail, setAccountEmail] = useState("");
  const [accountSending, setAccountSending] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  // コード送信後は入力欄を「確認コード入力」に切り替える
  const [accountCodeSent, setAccountCodeSent] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [accountVerifying, setAccountVerifying] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  // getLocalUserStats()を直接初期値に渡すとハイドレーションミスマッチになるため、
  // 安全な初期値を渡し実データはマウント後のuseEffectでのみ取得する
  const [stats, setStats] = useState<UserStats>(DEFAULT_USER_STATS);
  const [tips, setTips] = useState<SavedTip[]>([]);
  const [forgottenItems, setForgottenItems] = useState<Ingredient[]>([]);
  const [ignoredForgottenCount, setIgnoredForgottenCount] = useState(0);
  const [renderedAt] = useState(() => Date.now());
  const [excludedInput, setExcludedInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');
  const writingProfile = useRef(false);
  const composingExcluded = useRef(false);
  const editingExcluded = useRef(false);
  const [openRecordSwipeIndex, setOpenRecordSwipeIndex] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showcaseStatus, setShowcaseStatus] = useState<string | null>(null);
  const [canRestoreShowcase, setCanRestoreShowcase] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let refreshQueued = false;
    const refresh = () => {
      if (writingProfile.current) return;
      const p = getLocalUserProfile();
      // SSRと初回クライアント描画を一致させるため、端末データはマウント後に復元する。
      setProfile(p);
      if (!editingExcluded.current) setExcludedInput((p.excludedIngredients || []).join(", "));
      setStats(getLocalUserStats());
      setTips(getLocalSavedTips());
      setForgottenItems(getForgottenIngredients());
      setIgnoredForgottenCount(getIgnoredForgottenIngredientIds().length);
      setCanRestoreShowcase(hasVideoShowcaseBackup());
    };
    const scheduleRefresh = () => {
      if (writingProfile.current || refreshQueued) return;
      refreshQueued = true;
      // Storage readers may migrate old data during another component's render.
      // Defer subscriptions and coalesce backup writes to avoid cross-render updates.
      queueMicrotask(() => {
        refreshQueued = false;
        if (active) refresh();
      });
    };
    refresh();
    window.addEventListener('storage-updated', scheduleRefresh);
    window.addEventListener('storage', scheduleRefresh);
    return () => {
      active = false;
      window.removeEventListener('storage-updated', scheduleRefresh);
      window.removeEventListener('storage', scheduleRefresh);
    };
  }, []);

  const updateProfile = (change: ProfileChange) => {
    const updated = applyProfileChange(getLocalUserProfile(), change);
    // Write in the input event, not a state updater/effect: Strict Mode and
    // mounting the page must never persist defaults or duplicate writes.
    writingProfile.current = true;
    const saved = setLocalUserProfile(updated);
    writingProfile.current = false;
    setProfile(updated);
    setSaveState(saved ? 'saved' : 'failed');
    if (saved) onSaved?.();
  };

  const updateExcludedInput = (value: string) => {
    setExcludedInput(value);
    if (!composingExcluded.current) updateProfile({ excludedIngredients: parseExcludedIngredients(value) });
  };

  const toggleTaste = (taste: string) => {
    updateProfile(prev => {
      const current = prev.tastePreferences || [];
      const list = current.includes(taste)
        ? current.filter(t => t !== taste)
        : [...current, taste];
      return { tastePreferences: list };
    });
  };

  const toggleStyle = (style: string) => {
    updateProfile(prev => {
      const current = prev.cookingStyles || [];
      const list = current.includes(style)
        ? current.filter(s => s !== style)
        : [...current, style];
      return { cookingStyles: list };
    });
  };

  const toggleDietary = (option: string) => {
    updateProfile(prev => {
      const current = prev.dietaryRestrictions || [];
      const list = current.includes(option)
        ? current.filter(d => d !== option)
        : [...current, option];
      return { dietaryRestrictions: list };
    });
  };

  const togglePreferredGenre = (genre: string) => {
    updateProfile(prev => {
      const current = prev.preferredGenres || [];
      const list = current.includes(genre)
        ? current.filter(g => g !== genre)
        : [...current, genre];
      return { preferredGenres: list };
    });
  };

  const handleDeleteTip = (id: string) => {
    deleteLocalSavedTip(id);
    setTips(getLocalSavedTips());
  };

  const handleDownloadBackup = () => {
    exportBackupJSON();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importBackupJSON(content);
      if (res.success) {
        setImportStatus(t.settings.importSuccess);
        setProfile(getLocalUserProfile());
        setStats(getLocalUserStats());
        setTips(getLocalSavedTips());
        setForgottenItems(getForgottenIngredients());
        setIgnoredForgottenCount(getIgnoredForgottenIngredientIds().length);
        if (onSaved) onSaved();
      } else {
        setImportStatus(t.settings.importError(res.error || ""));
      }
    };
    reader.readAsText(file);
  };

  const handleSendLoginCode = async () => {
    if (!accountEmail.trim() || accountSending) return;
    setAccountSending(true);
    setAccountMessage(null);
    const res = await sendLoginCode(accountEmail.trim());
    setAccountSending(false);
    if (res.success) {
      setAccountCodeSent(true);
      setAccountMessage(t.settings.accountCodeSent(accountEmail.trim()));
    } else {
      setAccountMessage(t.settings.accountCodeError(res.error || ""));
    }
  };

  const handleVerifyLoginCode = async () => {
    if (!accountCode.trim() || accountVerifying) return;
    setAccountVerifying(true);
    setAccountMessage(null);
    const res = await verifyLoginCode(accountEmail.trim(), accountCode.trim());
    setAccountVerifying(false);
    if (!res.success) {
      setAccountMessage(t.settings.accountCodeError(res.error || ""));
    }
    // 成功時はuseAuthのsessionが更新され、ログイン後の画面に自動で切り替わる
  };

  const handleInstallShowcase = () => {
    if (!window.confirm(t.settings.showcaseConfirm)) return;
    installVideoShowcaseData();
    setLanguage('en');
    setCanRestoreShowcase(true);
    setShowcaseStatus(t.settings.showcaseLoaded);
  };

  const handleRestoreShowcase = () => {
    const restoredLanguage = restoreBeforeVideoShowcaseData();
    if (!restoredLanguage) return;
    setLanguage(restoredLanguage);
    setCanRestoreShowcase(false);
    setShowcaseStatus(t.settings.showcaseRestored);
  };

  return (
    <>
      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t.settings.tabProfile}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'stats' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <Activity size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t.settings.tabStats}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'tips' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            if (isPremium) setActiveTab('tips');
            else setShowPaywall(true);
          }}
        >
          <Lightbulb size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t.settings.tabTips(tips.length)}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'backup' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          <Database size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t.settings.tabBackup}
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className={styles.body}>
          <p className={styles.description}>
            {t.settings.profileDescription}
          </p>
          <p className={`${styles.autoSaveStatus} ${saveState === 'failed' ? styles.autoSaveError : ''}`} role="status">
            {saveState === 'failed' ? t.settings.autoSaveFailed : saveState === 'saved' ? t.settings.autoSaved : t.settings.autoSaveHint}
          </p>

          <div className={styles.section}>
            <div className={styles.trayHeadingRow}>
              <label className={styles.sectionLabel}>
                {language === 'ja' ? '配膳トレー' : 'Serving tray'}
              </label>
              <span className={styles.trayAvailableBadge}>
                {isPremium
                  ? (language === 'ja' ? 'すべて利用可能' : 'All available')
                  : (language === 'ja' ? 'Plusで追加' : 'More with Plus')}
              </span>
            </div>
            <div className={styles.trayGrid}>
              {TRAY_THEMES.map(theme => {
                const locked = theme.premiumOnly && !isPremium;
                const active = !locked && (profile.trayTheme || 'wood') === theme.id;
                const label = theme.name[language === 'ja' ? 'ja' : 'en'];
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={active}
                    className={`${styles.trayOption} ${active ? styles.trayOptionActive : ''} ${locked ? styles.trayOptionLocked : ''}`}
                    onClick={() => {
                      if (locked) setShowPaywall(true);
                      else updateProfile({ trayTheme: theme.id as TrayThemeId });
                    }}
                  >
                    <span
                      className={styles.trayPreview}
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url("${theme.asset}")`,
                        backgroundSize: theme.backgroundSize,
                      }}
                    />
                    <span>{label}</span>
                    {active && <Check size={14} className={styles.trayCheck} />}
                    {locked && <Crown size={14} className={styles.trayLock} />}
                  </button>
                );
              })}
            </div>
            <span className={styles.hint}>
              {t.settings.trayAutoSaveHint}
            </span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>
              {language === 'ja' ? 'みんなのレシピへの自動共有' : 'Auto-share to Community Recipes'}
            </label>
            <button
              type="button"
              className={`${styles.shareToggle} ${(isPremium ? profile.shareGeneratedRecipes !== false : true) ? styles.shareToggleOn : ''}`}
              aria-pressed={isPremium ? profile.shareGeneratedRecipes !== false : true}
              onClick={() => {
                if (!isPremium) setShowPaywall(true);
                else updateProfile(prev => ({ shareGeneratedRecipes: prev.shareGeneratedRecipes === false }));
              }}
            >
              <span className={styles.shareToggleTrack}><i /></span>
              <span>
                <strong>{isPremium && profile.shareGeneratedRecipes === false
                  ? (language === 'ja' ? '共有しない' : 'Do not share')
                  : (language === 'ja' ? '作ったレシピを共有する' : 'Share recipes I cooked')}</strong>
                <small>{isPremium
                  ? (language === 'ja' ? '「この料理を作った！」で記録したレシピ本文のみ。個人設定や在庫は送信しません。' : 'Only recipes recorded with “I made this!” are shared. Your settings and pantry are never sent.')
                  : (language === 'ja' ? '実際に作った料理は自動共有。PlusではOFFにできます。' : 'Recipes you actually cook are shared automatically; Plus can turn this off.')}</small>
              </span>
            </button>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.addressLabel}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={t.settings.addressPlaceholder}
              value={profile.address || ''}
              onChange={(e) => updateProfile({ address: e.target.value })}
            />
            <span className={styles.hint}>{t.settings.addressHint}</span>
          </div>

          <div className={styles.section}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              <input
                type="checkbox"
                checked={profile.assumeSeasoningsAvailable !== false}
                onChange={(e) => updateProfile({ assumeSeasoningsAvailable: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#ff6f91' }}
              />
              <span>{t.settings.seasoningsToggleLabel}</span>
            </label>
            <span className={styles.hint}>{t.settings.seasoningsHint}</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.pfcLabel}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={0}
                className={styles.input}
                placeholder={t.settings.caloriesPlaceholder}
                value={profile.targetCalories ?? ''}
                onChange={(e) => updateProfile({ targetCalories: e.target.value ? Math.max(0, Number(e.target.value)) : null })}
              />
              <input
                type="number"
                min={0}
                className={styles.input}
                placeholder={t.settings.proteinPlaceholder}
                value={profile.targetProtein ?? ''}
                onChange={(e) => updateProfile({ targetProtein: e.target.value ? Math.max(0, Number(e.target.value)) : null })}
              />
            </div>
            <span className={styles.hint}>{t.settings.pfcHint}</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.preferredGenresLabel}</label>
            <div className={styles.tagGrid}>
              {PREFERRED_GENRE_OPTIONS.map(genre => {
                const active = (profile.preferredGenres || []).includes(genre);
                const label = t.tagLabel[genre] || genre;
                return (
                  <button
                    key={genre}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => togglePreferredGenre(genre)}
                  >
                    {active ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
            <span className={styles.hint}>{t.settings.preferredGenresHint}</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.tasteLabel}</label>
            <div className={styles.tagGrid}>
              {TASTE_OPTIONS.map(taste => {
                const active = (profile.tastePreferences || []).includes(taste);
                const label = t.tagLabel[taste] || taste;
                return (
                  <button
                    key={taste}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => toggleTaste(taste)}
                  >
                    {active ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.styleLabel}</label>
            <div className={styles.tagGrid}>
              {STYLE_OPTIONS.map(style => {
                const active = (profile.cookingStyles || []).includes(style);
                const label = t.tagLabel[style] || style;
                return (
                  <button
                    key={style}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => toggleStyle(style)}
                  >
                    {active ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.dietaryLabel}</label>
            <div className={styles.tagGrid}>
              {DIETARY_RESTRICTION_OPTIONS.map(option => {
                const active = (profile.dietaryRestrictions || []).includes(option);
                const label = t.tagLabel[option] || option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => toggleDietary(option)}
                  >
                    {active ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
            <span className={styles.hint}>{t.settings.dietaryHint}</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.excludedLabel}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={t.settings.excludedPlaceholder}
              value={excludedInput}
              onFocus={() => { editingExcluded.current = true; }}
              onChange={(e) => updateExcludedInput(e.target.value)}
              onCompositionStart={() => { composingExcluded.current = true; }}
              onCompositionEnd={(e) => { composingExcluded.current = false; updateExcludedInput(e.currentTarget.value); }}
              onBlur={(e) => { editingExcluded.current = false; composingExcluded.current = false; updateExcludedInput(e.currentTarget.value); }}
            />
            <span className={styles.hint}>{t.settings.excludedHint}</span>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className={styles.body}>
          <p className={styles.description}>
            {t.settings.statsDescription}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{t.settings.statTotalCooked}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ff6f91', marginTop: 2 }}>{t.settings.statTotalCookedUnit(stats.total_cooked)}</div>
            </div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{t.settings.statStreak}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{t.settings.statStreakUnit(stats.streak_days)}</div>
            </div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{t.settings.statSaved}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{t.settings.statSavedUnit(stats.saved_food_count)}</div>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.callingIngredientsLabel}</label>
            {forgottenItems.length > 0 ? (
              <div className={styles.callingList}>
                {forgottenItems.map((item) => {
                  const ageDays = Math.floor((renderedAt - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={item.id} className={styles.callingRow}>
                      <IngredientIcon name={item.name} size={30} />
                      <div className={styles.callingCopy}>
                        <div className={styles.callingName}>{item.name}</div>
                        <div className={styles.callingMessage}>{t.settings.callingIngredientMessage(ageDays)}</div>
                      </div>
                      <button
                        type="button"
                        className={styles.callingIgnoreBtn}
                        onClick={() => {
                          ignoreForgottenIngredient(item.id);
                          setForgottenItems(getForgottenIngredients());
                          setIgnoredForgottenCount(getIgnoredForgottenIngredientIds().length);
                        }}
                      >
                        <EyeOff size={14} /> {t.settings.callingIngredientIgnore}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                {t.settings.noCallingIngredients}
              </p>
            )}
            {ignoredForgottenCount > 0 && (
              <button
                type="button"
                className={styles.restoreCallingBtn}
                onClick={() => {
                  clearIgnoredForgottenIngredients();
                  setIgnoredForgottenCount(0);
                  setForgottenItems(getForgottenIngredients());
                }}
              >
                <RotateCcw size={14} /> {t.settings.restoreCallingIngredients}
              </button>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.recentHistoryLabel}</label>
            {(stats.cooked_records && stats.cooked_records.length > 0) ? (
              <>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>{t.settings.historySwipeHint}</p>
                <div className={styles.recordList}>
                  {stats.cooked_records.slice(0, isPremium ? undefined : FREE_HISTORY_ITEMS).map((rec, i) => (
                    <SwipeableRecordRow
                      key={`${rec.date}-${i}`}
                      record={rec}
                      isOpen={openRecordSwipeIndex === i}
                      onOpenChange={(open) => setOpenRecordSwipeIndex(open ? i : null)}
                      onDelete={() => {
                        setOpenRecordSwipeIndex(null);
                        setStats(deleteLocalCookedRecord(i));
                      }}
                      deleteTitle={t.history.deleteButtonTitle}
                    />
                  ))}
                </div>
                {!isPremium && stats.cooked_records.length > FREE_HISTORY_ITEMS && (
                  <button type="button" className={styles.premiumSettingsGate} onClick={() => setShowPaywall(true)}>
                    <Crown size={17} />
                    <span>{language === 'ja' ? 'Plusで過去の記録をすべて表示' : 'View your full history with Plus'}</span>
                  </button>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{t.settings.noHistory}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tips' && isPremium && (
        <div className={styles.body}>
          <p className={styles.description}>
            {t.settings.tipsDescription}
          </p>

          {tips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tips.map((tip) => (
                <div key={tip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 12, padding: '10px 12px', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>
                      {tip.category}
                    </span>
                    <span style={{ fontSize: 13, color: '#92400e', lineHeight: 1.4 }}>
                      {tip.tip}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTip(tip.id)}
                    style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', padding: 2 }}
                    title={t.settings.deleteTipTitle}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
              <Lightbulb size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>{t.settings.noTips}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'backup' && (
        <div className={styles.body}>
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.accountTitle}</label>
            <p className={styles.hint} style={{ display: 'block', marginBottom: 10 }}>
              {t.settings.accountDescription}
            </p>

            {!isSupabaseConfigured ? (
              <p className={styles.hint}>{t.settings.accountNotConfigured}</p>
            ) : user ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>
                  {t.settings.accountLoggedInAs(user.email || '')}
                </p>
                <p className={styles.hint} style={{ display: 'block', marginBottom: 10 }}>
                  {t.settings.accountSyncNote}
                </p>
                <button type="button" className={styles.uploadBtn} onClick={() => signOut()}>
                  <LogOut size={15} />
                  <span>{t.settings.accountLogout}</span>
                </button>
              </div>
            ) : !accountCodeSent ? (
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    className={styles.input}
                    style={{ flex: '1 1 160px', width: 'auto' }}
                    placeholder={t.settings.accountEmailPlaceholder}
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.downloadBtn}
                    style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                    disabled={accountSending || !accountEmail.trim()}
                    onClick={handleSendLoginCode}
                  >
                    <Mail size={15} />
                    <span>{accountSending ? t.settings.accountSending : t.settings.accountSendCode}</span>
                  </button>
                </div>
                {accountMessage && (
                  <div className={styles.importStatusAlert} style={{ marginTop: 10 }}>
                    {accountMessage}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className={styles.hint} style={{ display: 'block', marginBottom: 10 }}>
                  {t.settings.accountCodeSent(accountEmail.trim())}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    style={{ flex: '1 1 120px', width: 'auto' }}
                    placeholder={t.settings.accountCodePlaceholder}
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.downloadBtn}
                    style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                    disabled={accountVerifying || !accountCode.trim()}
                    onClick={handleVerifyLoginCode}
                  >
                    <Check size={15} />
                    <span>{accountVerifying ? t.settings.accountVerifying : t.settings.accountVerifyCode}</span>
                  </button>
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: 13,
                    padding: 4,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => {
                    setAccountCodeSent(false);
                    setAccountCode("");
                    setAccountMessage(null);
                  }}
                >
                  {t.settings.accountBackToEmail}
                </button>
                {accountMessage && (
                  <div className={styles.importStatusAlert} style={{ marginTop: 10 }}>
                    {accountMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className={styles.description}>
            {t.settings.backupDescription}
          </p>

          <div className={styles.backupSection}>
            <div className={styles.backupActionRow}>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handleDownloadBackup}
              >
                <Download size={15} />
                <span>{t.settings.downloadBackup}</span>
              </button>

              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} />
                <span>{t.settings.restoreBackup}</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".json,application/json"
                onChange={handleFileImport}
              />
            </div>

            {importStatus && (
              <div className={styles.importStatusAlert}>
                {importStatus}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.showcaseTitle}</label>
            <p className={styles.hint} style={{ display: 'block', marginBottom: 10 }}>
              {t.settings.showcaseDescription}
            </p>
            <div className={styles.backupActionRow}>
              <button type="button" className={styles.downloadBtn} onClick={handleInstallShowcase}>
                <Film size={15} />
                <span>{t.settings.showcaseLoad}</span>
              </button>
              {canRestoreShowcase && (
                <button type="button" className={styles.uploadBtn} onClick={handleRestoreShowcase}>
                  <RotateCcw size={15} />
                  <span>{t.settings.showcaseRestore}</span>
                </button>
              )}
            </div>
            {showcaseStatus && <div className={styles.importStatusAlert}>{showcaseStatus}</div>}
          </div>
        </div>
      )}

      <PremiumPaywall open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  );
}
