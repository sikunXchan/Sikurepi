"use client";

import { useState, useRef, useEffect } from "react";
import {
  getLocalUserProfile,
  setLocalUserProfile,
  UserProfile,
  DEFAULT_USER_PROFILE,
  exportBackupJSON,
  importBackupJSON
} from "@/lib/storage";
import { X, Download, Upload, Check } from "lucide-react";
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
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [excludedInput, setExcludedInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const p = getLocalUserProfile();
      setProfile(p);
      setExcludedInput(p.excludedIngredients.join(", "));
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleServingsChange = (n: number) => {
    setProfile(prev => ({ ...prev, servings: n }));
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
    };

    setLocalUserProfile(updated);
    if (onSaved) onSaved();
    onClose();
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
      if (content) {
        const res = importBackupJSON(content);
        if (res.success) {
          setImportStatus("🎉 データを完全復元しました！");
          const p = getLocalUserProfile();
          setProfile(p);
          setExcludedInput(p.excludedIngredients.join(", "));
          if (onSaved) onSaved();
        } else {
          setImportStatus(`❌ 復元エラー: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span>⚙️</span>
            <h2>AIレシピ一括設定 (マイ設定)</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            ここで設定した内容は、レシピ提案時に常に自動でAIへ反映されます。毎回指示を入力する必要はありません。
          </p>

          {/* 1. 分量 (人数) */}
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

          {/* 2. 味の好み・栄養方針 */}
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

          {/* 3. 除外食材 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>🚫 除外する食材 (アレルギー・苦手)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="例: エビ, カニ, そば, パクチー, 辛い調味料"
              value={excludedInput}
              onChange={(e) => setExcludedInput(e.target.value)}
            />
            <span className={styles.hint}>※ カンマまたはスペース区切りで入力（AIが提案から完全除外します）</span>
          </div>

          {/* 4. 調理スタイル・設備 */}
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

          {/* 5. データバックアップ & 復元 */}
          <div className={styles.backupSection}>
            <label className={styles.sectionLabel}>💾 データバックアップ ＆ 移行</label>
            <p className={styles.backupHint}>
              全データ（在庫・買い物リスト・履歴・マイ設定・自炊レベル）をJSONファイルで手元に保存・復元できます。
            </p>

            <div className={styles.backupActionRow}>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handleDownloadBackup}
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
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            <Check size={18} />
            設定を保存して適用
          </button>
        </div>
      </div>
    </div>
  );
}
