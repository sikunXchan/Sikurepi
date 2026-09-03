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
  UserStats,
  SavedTip
} from "@/lib/storage";
import { Download, Upload, Check, Trash2, Activity, Lightbulb, User, Database } from "lucide-react";
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

type TabType = 'profile' | 'stats' | 'tips' | 'backup';

type Props = {
  /** 保存ボタン押下後にモーダルを閉じたい場合に渡す（マイページ単体表示では未指定でOK） */
  onCloseRequest?: () => void;
  onSaved?: () => void;
};

// マイ設定モーダルとマイページの両方から使われる共通の中身。
// モーダル側はこのコンポーネントをオーバーレイでラップし、マイページはPageHeaderの下にそのまま埋め込む。
export default function SettingsPanel({ onCloseRequest, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [stats, setStats] = useState<UserStats>(getLocalUserStats());
  const [tips, setTips] = useState<SavedTip[]>([]);
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
        setImportStatus("✅ データの復元に成功しました！");
        setProfile(getLocalUserProfile());
        setStats(getLocalUserStats());
        setTips(getLocalSavedTips());
        if (onSaved) onSaved();
      } else {
        setImportStatus(`❌ 復元失敗: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  const totalPFC = (stats.total_protein || 0) * 4 + (stats.total_fat || 0) * 9 + (stats.total_carbs || 0) * 4;
  const pPct = totalPFC > 0 ? Math.round(((stats.total_protein || 0) * 4 / totalPFC) * 100) : 0;
  const fPct = totalPFC > 0 ? Math.round(((stats.total_fat || 0) * 9 / totalPFC) * 100) : 0;
  const cPct = totalPFC > 0 ? Math.round(((stats.total_carbs || 0) * 4 / totalPFC) * 100) : 0;

  return (
    <>
      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
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
          保存
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className={styles.body}>
          <p className={styles.description}>
            あなたの好みや環境を登録すると、AIシェフが毎回最適なレシピを自動提案します。
          </p>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>📍 お住まいの地域（大雑把な住所）</label>
            <input
              type="text"
              className={styles.input}
              placeholder="例: 東京都、大阪市、福岡県など"
              value={profile.address || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
            />
            <span className={styles.hint}>※ 無料の気象APIでリアルタイムの天気・気温を自動反映するために使用します</span>
          </div>

          <div className={styles.section}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              <input
                type="checkbox"
                checked={profile.enableClimate !== false}
                onChange={(e) => setProfile(prev => ({ ...prev, enableClimate: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#ff6f91' }}
              />
              <span>🌤️ 気候・天気に連動したレシピ提案を有効にする</span>
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
              <span>🧂 塩・醤油などの基本調味料は常備している前提でレシピを提案する</span>
            </label>
            <span className={styles.hint}>※ OFFにすると、調味料も在庫にあるものだけを使ってレシピを提案し、不足分もきちんと表示します</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>👥 基本の人数</label>
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

          <div className={styles.section}>
            <label className={styles.sectionLabel}>🎯 1日のPFC目標（週間献立の栄養バランスに使用）</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={0}
                className={styles.input}
                placeholder="目標カロリー（例: 2000）"
                value={profile.targetCalories ?? ''}
                onChange={(e) => setProfile(prev => ({ ...prev, targetCalories: e.target.value ? Number(e.target.value) : null }))}
              />
              <input
                type="number"
                min={0}
                className={styles.input}
                placeholder="目標タンパク質g（例: 75）"
                value={profile.targetProtein ?? ''}
                onChange={(e) => setProfile(prev => ({ ...prev, targetProtein: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
            <span className={styles.hint}>※ 空欄の場合、厚生労働省「日本人の食事摂取基準」の目安（2000kcal、たんぱく質エネルギー比13〜20%）から自動算出します</span>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>👅 味・栄養のこだわり</label>
            <div className={styles.tagGrid}>
              {TASTE_OPTIONS.map(taste => {
                const active = (profile.tastePreferences || []).includes(taste);
                return (
                  <button
                    key={taste}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => toggleTaste(taste)}
                  >
                    {active ? `✓ ${taste}` : taste}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>⏱️ 調理スタイル</label>
            <div className={styles.tagGrid}>
              {STYLE_OPTIONS.map(style => {
                const active = (profile.cookingStyles || []).includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    className={`${styles.tagBtn} ${active ? styles.tagBtnActive : ""}`}
                    onClick={() => toggleStyle(style)}
                  >
                    {active ? `✓ ${style}` : style}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>🚫 苦手・アレルギー・除外食材</label>
            <input
              type="text"
              className={styles.input}
              placeholder="例: エビ, パクチー, 辛いもの (カンマ区切り)"
              value={excludedInput}
              onChange={(e) => setExcludedInput(e.target.value)}
            />
            <span className={styles.hint}>※ AIがこれらの食材を含まないレシピを考案します</span>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className={styles.body}>
          <p className={styles.description}>
            「この料理を作った！」ボタンを押すことで、全体のPFCバランスと調理実績がここに自動蓄積されます。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 700 }}>🍳 累計自炊回数</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6f91', marginTop: 2 }}>{stats.total_cooked} 回</div>
            </div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 700 }}>🔥 累積総カロリー</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{(stats.total_calories || 0).toLocaleString()} kcal</div>
            </div>
          </div>

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
              📊 全体のPFCバランス（エネルギー比率）
            </div>
            {totalPFC > 0 ? (
              <>
                <div style={{ display: 'flex', height: 14, borderRadius: 9999, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ width: `${pPct}%`, background: '#3b82f6' }} title={`Protein: ${pPct}%`} />
                  <div style={{ width: `${fPct}%`, background: '#f59e0b' }} title={`Fat: ${fPct}%`} />
                  <div style={{ width: `${cPct}%`, background: '#10b981' }} title={`Carbs: ${cPct}%`} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: '#3b82f6' }}>P: {pPct}% ({(stats.total_protein || 0).toFixed(1)}g)</span>
                  <span style={{ color: '#f59e0b' }}>F: {fPct}% ({(stats.total_fat || 0).toFixed(1)}g)</span>
                  <span style={{ color: '#10b981' }}>C: {cPct}% ({(stats.total_carbs || 0).toFixed(1)}g)</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                料理を作るとここにPFC比率が集計されます
              </p>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>🕒 最近の調理履歴</label>
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
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>自炊記録はまだありません</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tips' && (
        <div className={styles.body}>
          <p className={styles.description}>
            AIシェフが提案した「料理のコツ＆豆知識」が自動でここに保存されます。いつでも復習に役立てられます。
          </p>

          {tips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tips.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 12, padding: '10px 12px', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>
                      {t.category}
                    </span>
                    <span style={{ fontSize: 13, color: '#92400e', lineHeight: 1.4 }}>
                      {t.tip}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTip(t.id)}
                    style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', padding: 2 }}
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
              <Lightbulb size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>レシピを生成すると、シェフのコツや豆知識がここに自動蓄積されます</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'backup' && (
        <div className={styles.body}>
          <p className={styles.description}>
            冷蔵庫の在庫、買い物リスト、保存レシピ、PFC自炊統計、豆知識ライブラリをひとつのJSONファイルとして端末にダウンロード保存・復元できます。
          </p>

          <div className={styles.backupSection}>
            <div className={styles.backupActionRow}>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handleDownloadBackup}
              >
                <Download size={15} />
                <span>JSONバックアップ保存</span>
              </button>

              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} />
                <span>JSONファイルから復元</span>
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
            {savedFlash ? "保存しました！" : "設定を保存して適用"}
          </button>
        </div>
      )}
    </>
  );
}
