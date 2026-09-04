"use client";

import { useState, useRef, useEffect } from "react";
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
  getForgottenIngredients,
  DEFAULT_USER_STATS,
  UserStats,
  SavedTip,
  Ingredient
} from "@/lib/storage";
import { Download, Upload, Check, Trash2, Activity, Lightbulb, User, Database } from "lucide-react";
import IngredientIcon from "./IngredientIcon";
import { GENRE_ICON_SLUGS } from "./RecipeThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./ProfileSettingsModal.module.css";

// 優先ジャンル選択の選択肢。ジャンル別サムネイルと同じ一覧を使い回して二重管理を防ぐ
// (「その他」はジャンルとして選ぶ意味が薄いため除外)
const PREFERRED_GENRE_OPTIONS = Object.keys(GENRE_ICON_SLUGS).filter(g => g !== "その他");

const TASTE_OPTIONS = [
  "うす味・減塩",
  "しっかり濃いめ",
  "高タンパク",
  "低糖質・ヘルシー",
  "辛さ控えめ",
  "子供が喜ぶ味付け",
  "お酒のおつまみ風",
];

const DIETARY_OPTIONS = [
  "ベジタリアン",
  "ヴィーガン",
  "ハラール（イスラム教）",
  "コーシャ（ユダヤ教）",
  "豚肉不可",
  "牛肉不可",
  "アルコール不可",
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
  /** 保存ボタン押下後にモーダルを閉じたい場合に渡す（マイページ単体表示では未指定でOK） */
  onCloseRequest?: () => void;
  onSaved?: () => void;
};

// マイ設定モーダルとマイページの両方から使われる共通の中身。
// モーダル側はこのコンポーネントをオーバーレイでラップし、マイページはPageHeaderの下にそのまま埋め込む。
export default function SettingsPanel({ onCloseRequest, onSaved }: Props) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  // getLocalUserStats()を直接初期値に渡すとハイドレーションミスマッチになるため、
  // 安全な初期値を渡し実データはマウント後のuseEffectでのみ取得する
  const [stats, setStats] = useState<UserStats>(DEFAULT_USER_STATS);
  const [tips, setTips] = useState<SavedTip[]>([]);
  const [forgottenItems, setForgottenItems] = useState<Ingredient[]>([]);
  const [excludedInput, setExcludedInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = getLocalUserProfile();
    setProfile(p);
    setExcludedInput((p.excludedIngredients || []).join(", "));
    setStats(getLocalUserStats());
    setTips(getLocalSavedTips());
    setForgottenItems(getForgottenIngredients());
  }, []);

  const handleServingsChange = (n: number) => {
    setProfile(prev => ({ ...prev, servings: n }));
  };

  const toggleTaste = (taste: string) => {
    setProfile(prev => {
      const current = prev.tastePreferences || [];
      const list = current.includes(taste)
        ? current.filter(t => t !== taste)
        : [...current, taste];
      return { ...prev, tastePreferences: list };
    });
  };

  const toggleStyle = (style: string) => {
    setProfile(prev => {
      const current = prev.cookingStyles || [];
      const list = current.includes(style)
        ? current.filter(s => s !== style)
        : [...current, style];
      return { ...prev, cookingStyles: list };
    });
  };

  const toggleDietary = (option: string) => {
    setProfile(prev => {
      const current = prev.dietaryRestrictions || [];
      const list = current.includes(option)
        ? current.filter(d => d !== option)
        : [...current, option];
      return { ...prev, dietaryRestrictions: list };
    });
  };

  const togglePreferredGenre = (genre: string) => {
    setProfile(prev => {
      const current = prev.preferredGenres || [];
      const list = current.includes(genre)
        ? current.filter(g => g !== genre)
        : [...current, genre];
      return { ...prev, preferredGenres: list };
    });
  };

  const handleSave = () => {
    const excludedList = excludedInput
      .split(/[,、\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const updated: UserProfile = {
      ...profile,
      excludedIngredients: excludedList,
    };

    setLocalUserProfile(updated);
    if (onSaved) onSaved();
    if (onCloseRequest) {
      onCloseRequest();
    } else {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
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
        if (onSaved) onSaved();
      } else {
        setImportStatus(t.settings.importError(res.error || ""));
      }
    };
    reader.readAsText(file);
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
          onClick={() => setActiveTab('tips')}
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

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.addressLabel}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={t.settings.addressPlaceholder}
              value={profile.address || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
            />
            <span className={styles.hint}>{t.settings.addressHint}</span>
          </div>

          <div className={styles.section}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              <input
                type="checkbox"
                checked={profile.enableClimate !== false}
                onChange={(e) => setProfile(prev => ({ ...prev, enableClimate: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#ff6f91' }}
              />
              <span>{t.settings.climateToggleLabel}</span>
            </label>
          </div>

          <div className={styles.section}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              <input
                type="checkbox"
                checked={profile.assumeSeasoningsAvailable !== false}
                onChange={(e) => setProfile(prev => ({ ...prev, assumeSeasoningsAvailable: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#ff6f91' }}
              />
              <span>{t.settings.seasoningsToggleLabel}</span>
            </label>
            <span className={styles.hint}>{t.settings.seasoningsHint}</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.servingsLabel}</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '8px 12px' }}>
              <button
                type="button"
                onClick={() => handleServingsChange(Math.max(1, profile.servings - 1))}
                disabled={profile.servings <= 1}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: 'linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)', color: 'white',
                  fontSize: 20, fontWeight: 900, cursor: 'pointer',
                  opacity: profile.servings <= 1 ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                −
              </button>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#ea580c', minWidth: 64, textAlign: 'center' }}>
                {t.settings.servingsUnit(profile.servings)}
              </span>
              <button
                type="button"
                onClick={() => handleServingsChange(Math.min(15, profile.servings + 1))}
                disabled={profile.servings >= 15}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: 'linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)', color: 'white',
                  fontSize: 20, fontWeight: 900, cursor: 'pointer',
                  opacity: profile.servings >= 15 ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ＋
              </button>
            </div>
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
                onChange={(e) => setProfile(prev => ({ ...prev, targetCalories: e.target.value ? Number(e.target.value) : null }))}
              />
              <input
                type="number"
                min={0}
                className={styles.input}
                placeholder={t.settings.proteinPlaceholder}
                value={profile.targetProtein ?? ''}
                onChange={(e) => setProfile(prev => ({ ...prev, targetProtein: e.target.value ? Number(e.target.value) : null }))}
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
              {DIETARY_OPTIONS.map(option => {
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
              onChange={(e) => setExcludedInput(e.target.value)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {forgottenItems.map((item) => {
                  const ageDays = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 111, 145, 0.06)', border: '1px solid rgba(255, 111, 145, 0.25)', padding: '8px 10px', borderRadius: 12 }}>
                      <IngredientIcon name={item.name} size={30} />
                      <div>
                        <div style={{ fontWeight: 800, color: '#111827', fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: '#e0466e', fontWeight: 700 }}>{t.settings.callingIngredientMessage(ageDays)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                {t.settings.noCallingIngredients}
              </p>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t.settings.recentHistoryLabel}</label>
            {(stats.cooked_records && stats.cooked_records.length > 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {stats.cooked_records.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: '8px 10px', borderRadius: 8, border: '1px solid #f3f4f6', fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{rec.recipeTitle}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(rec.date).toLocaleDateString('ja-JP')}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#4b5563', fontWeight: 700, textAlign: 'right' }}>
                      {rec.calories ? `${rec.calories}kcal` : ''}
                      {rec.protein_g ? ` (P:${rec.protein_g}g)` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{t.settings.noHistory}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tips' && (
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
        </div>
      )}

      {/* フッター (マイ設定時のみ保存ボタン表示) */}
      {activeTab === 'profile' && (
        <div className={styles.footer}>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            <Check size={18} />
            {savedFlash ? t.settings.savedButton : t.settings.saveButton}
          </button>
        </div>
      )}
    </>
  );
}
