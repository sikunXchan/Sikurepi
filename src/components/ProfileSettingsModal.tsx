"use client";

import { useState, useRef, useEffect } from "react";
import {
  getLocalUserProfile,
  setLocalUserProfile,
  UserProfile,
  DEFAULT_USER_PROFILE,
  getLocalUserStats,
  UserStats,
  getLocalSavedTips,
  deleteLocalSavedTip,
  SavedTip,
  exportBackupJSON,
  importBackupJSON
} from "@/lib/storage";
import { X, Download, Upload, Check, Settings, Activity, Lightbulb, Database, Trash2 } from "lucide-react";
import NutritionChart from "./NutritionChart";
import styles from "./ProfileSettingsModal.module.css";

const TASTE_OPTIONS = [
  "うす味・減塩",
  "しっかり濃いめ",
  "高タンパク",
  "低糖質・ヘルシー",
  "辛さ控えめ",
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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function ProfileSettingsModal({ isOpen, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'tips' | 'backup'>('profile');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [stats, setStats] = useState<UserStats>(getLocalUserStats());
  const [tips, setTips] = useState<SavedTip[]>([]);
  const [excludedInput, setExcludedInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const p = getLocalUserProfile();
      setProfile(p);
      setExcludedInput((p.excludedIngredients || []).join(", "));
      setAddressInput(p.address || "");
      setStats(getLocalUserStats());
      setTips(getLocalSavedTips());
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleServingsChange = (n: number) => {
    setProfile(prev => ({ ...prev, servings: prev.servings === n ? null : n }));
  };

  const toggleTaste = (taste: string) => {
    setProfile(prev => {
      const list = prev.tastePreferences.includes(taste)
        ? prev.tastePreferences.filter(t => t !== taste)
        : [...prev.tastePreferences, taste];
      return { ...prev, tastePreferences: list };
    });
  };

  const toggleStyle = (style: string) => {
    setProfile(prev => {
      const list = prev.cookingStyles.includes(style)
        ? prev.cookingStyles.filter(s => s !== style)
        : [...prev.cookingStyles, style];
      return { ...prev, cookingStyles: list };
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
      address: addressInput.trim(),
    };

    setLocalUserProfile(updated);
    if (onSaved) onSaved();
    onClose();
  };

  const handleDeleteTip = (id: string) => {
    deleteLocalSavedTip(id);
    setTips(getLocalSavedTips());
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importBackupJSON(content);
        if (res.success) {
          setImportStatus("🎉 データを完全復元しました！");
          const p = getLocalUserProfile();
          setProfile(p);
          setExcludedInput((p.excludedIngredients || []).join(", "));
          setAddressInput(p.address || "");
          setStats(getLocalUserStats());
          setTips(getLocalSavedTips());
          if (onSaved) onSaved();
        } else {
          setImportStatus(`❌ 復元エラー: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 全体平均PFCデータの算出
  const totalCal = stats.total_calories || 0;
  const avgNutrition = stats.total_cooked > 0 ? {
    calories: Math.round(totalCal / stats.total_cooked),
    protein_g: Math.round((stats.total_protein || 0) / stats.total_cooked),
    fat_g: Math.round((stats.total_fat || 0) / stats.total_cooked),
    carbs_g: Math.round((stats.total_carbs || 0) / stats.total_cooked),
  } : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h2>🐾 マイページ ＆ 設定</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 4つのピル型タブ */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <Settings size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            マイ設定
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'stats' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Activity size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            PFC統計
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'tips' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('tips')}
          >
            <Lightbulb size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            豆知識 ({tips.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'backup' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <Database size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            データ保存
          </button>
        </div>

        <div className={styles.body}>
          {/* タブ 1: マイ設定 */}
          {activeTab === 'profile' && (
            <>
              <p className={styles.description}>
                ここで設定した内容は、レシピ提案時に常に自動でAIへ反映されます。（初期値は未入力です）
              </p>

              {/* 住所設定 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>📍 お住まいの地域 (実天気自動取得用)</label>
                <input
                  type="text"
                  placeholder="例: 東京都、大阪府、北海道札幌市、福岡など"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
                <span className={styles.hint}>※ 大雑把な市区町村名でOKです。気候バーにリアルタイム天気が反映されます。</span>
              </div>

              {/* 分量 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>🍽️ デフォルト分量 (人数)</label>
                <div className={styles.servingsGrid}>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.servingsBtn} ${profile.servings === n ? styles.servingsBtnActive : ""}`}
                      onClick={() => handleServingsChange(n)}
                    >
                      {n}人分
                    </button>
                  ))}
                </div>
              </div>

              {/* 味の好み */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>🧂 味の好み・栄養方針</label>
                <div className={styles.tagGrid}>
                  {TASTE_OPTIONS.map(opt => {
                    const active = profile.tastePreferences.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                        onClick={() => toggleTaste(opt)}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 除外食材 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>🚫 除外する食材 (アレルギー・苦手)</label>
                <input
                  type="text"
                  placeholder="例: エビ, カニ, そば, パクチー, 辛い調味料"
                  value={excludedInput}
                  onChange={(e) => setExcludedInput(e.target.value)}
                />
                <span className={styles.hint}>※ カンマまたはスペース区切りで入力（AIが提案から完全除外します）</span>
              </div>

              {/* 調理スタイル */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>🍳 調理スタイル・設備</label>
                <div className={styles.tagGrid}>
                  {STYLE_OPTIONS.map(opt => {
                    const active = profile.cookingStyles.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                        onClick={() => toggleStyle(opt)}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* タブ 2: PFC統計 ＆ 自炊記録 */}
          {activeTab === 'stats' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff0f3', border: '1.5px solid #ffd1dc', borderRadius: 16, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a07888' }}>🍳 累計自炊回数</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#ff5c8a', marginTop: 2 }}>{stats.total_cooked} 回</div>
                </div>
                <div style={{ background: '#fff0f3', border: '1.5px solid #ffd1dc', borderRadius: 16, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a07888' }}>🔥 連続自炊ストリーク</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#ff5c8a', marginTop: 2 }}>{stats.streak_days} 日</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #ffd1dc', borderRadius: 20, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#4a2835', marginBottom: 8 }}>
                  📊 これまでの自炊 PFCバランス（1食あたり平均）
                </div>
                {avgNutrition ? (
                  <>
                    <NutritionChart nutrition={avgNutrition} />
                    <div style={{ fontSize: 11, color: '#a07888', marginTop: 8, textAlign: 'center' }}>
                      累計総カロリー: {stats.total_calories.toLocaleString()} kcal（計 {stats.total_cooked} 食）
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: '#a07888', textAlign: 'center', padding: '20px 0' }}>
                    まだ「この料理を作った！」記録がありません。<br />料理を作って記録するとPFCバランスが蓄積されます！
                  </p>
                )}
              </div>

              {stats.cooked_records && stats.cooked_records.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#4a2835' }}>📜 最近作った料理</div>
                  {stats.cooked_records.slice(0, 5).map((rec) => (
                    <div key={rec.id} style={{ background: '#fff8fa', border: '1px solid #ffd1dc', borderRadius: 12, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#4a2835' }}>{rec.recipe_title}</span>
                      <span style={{ color: '#a07888', fontSize: 11 }}>{rec.calories} kcal ({rec.cooked_at.split('T')[0]})</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* タブ 3: 料理のコツ＆豆知識ライブラリ */}
          {activeTab === 'tips' && (
            <>
              <p className={styles.description}>
                AIが提案した料理のコツ・保存テクニック・栄養豆知識が自動でここに蓄積されます。
              </p>

              {tips.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tips.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: '#fff8fa',
                        border: '1.5px solid #ffd1dc',
                        borderRadius: 16,
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: '#ffe5ec', color: '#ff5c8a', padding: '2px 8px', borderRadius: 9999 }}>
                          {t.category}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTip(t.id)}
                          style={{ background: 'none', border: 'none', color: '#c9a7b5', padding: 0, boxShadow: 'none', cursor: 'pointer' }}
                          title="削除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#4a2835', margin: 0, lineHeight: 1.4 }}>
                        {t.tip}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#a07888', textAlign: 'center', padding: '30px 0' }}>
                  まだ保存された豆知識はありません。<br />レシピを提案させると有益なコツが自動で集まります！
                </p>
              )}
            </>
          )}

          {/* タブ 4: バックアップ＆復元 */}
          {activeTab === 'backup' && (
            <div className={styles.backupSection}>
              <label className={styles.sectionLabel}>💾 データバックアップ ＆ 復元</label>
              <p className={styles.backupHint}>
                全データ（冷蔵庫在庫・買い物リスト・履歴・マイ設定・自炊統計PFC・豆知識ライブラリ）をJSONファイルで丸ごと手元に保存・別端末へ復元できます。
              </p>

              <div className={styles.backupActionRow}>
                <button
                  type="button"
                  className={styles.downloadBtn}
                  onClick={exportBackupJSON}
                >
                  <Download size={15} />
                  バックアップをダウンロード
                </button>

                <label className={styles.uploadBtn}>
                  <Upload size={15} />
                  データを復元 (JSON)
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {importStatus && (
                <div className={styles.importStatusAlert}>
                  {importStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'profile' && (
          <div className={styles.footer}>
            <button type="button" className={styles.saveBtn} onClick={handleSave}>
              <Check size={18} />
              設定を保存して適用
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
