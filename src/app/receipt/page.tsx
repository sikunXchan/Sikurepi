"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Upload, Loader2, CheckCircle, Trash2, Plus, ArrowRight, Sparkles, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { addLocalIngredient } from "@/lib/storage";
import { setNavLocked } from "@/lib/navLock";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./Receipt.module.css";

type ExtractedItem = {
  id: string;
  name: string;
  category: string;
};

const CATEGORIES = ['野菜', '肉', '魚介類', '乳製品・卵', '穀物・パン', '豆類', '果物', '調味料', 'その他'];

// 解析中に毎回違う体勢を見せて飽きさせないためのポーズ一覧
const LOADING_POSES = [
  "bear_reading.png",
  "bear_excited.png",
  "bear_love.png",
  "bear_itadakimasu.png",
  "bear_basket.png",
  "bear_running.png",
];

export default function ReceiptPage() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [extractedList, setExtractedList] = useState<ExtractedItem[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const [loadingPose, setLoadingPose] = useState(LOADING_POSES[0]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // このページを離れる際は、ロックしたままにならないよう必ず解除する
  useEffect(() => () => setNavLocked(false), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      const fileArr = Array.from(selected);
      setFiles(fileArr);
      setPreviews(fileArr.map(f => URL.createObjectURL(f)));
      setErrorMsg("");
      setExtractedList([]);
      setSuccess(false);
    }
  };

  const processImages = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setLoadingPose(LOADING_POSES[Math.floor(Math.random() * LOADING_POSES.length)]);
    setErrorMsg("");
    setExtractedList([]);
    setSuccess(false);
    // 解析中にタブ移動されると通信中のリクエストごと処理が失われてしまうため、
    // 完了/失敗するまでボトムナビの遷移をロックする
    setNavLocked(true);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.receipt.errorReadFailed);
      }

      const rawItems = data.ingredients || [];
      const parsed: ExtractedItem[] = rawItems.map((item: any, idx: number) => ({
        id: `ext_${idx}_${Date.now()}`,
        name: typeof item === 'string' ? item : item.name || '',
        category: typeof item === 'object' && item.category ? item.category : 'その他',
      })).filter((i: ExtractedItem) => i.name.trim() !== '');

      if (parsed.length === 0) {
        throw new Error(t.receipt.errorNoIngredientsDetected);
      }

      setExtractedList(parsed);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
      setNavLocked(false);
    }
  };

  const handleItemChange = (id: string, field: 'name' | 'category', value: string) => {
    setExtractedList(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleItemDelete = (id: string) => {
    setExtractedList(prev => prev.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    setExtractedList(prev => [
      ...prev,
      { id: `manual_${Date.now()}`, name: '', category: 'その他' }
    ]);
  };

  const handleSaveToInventory = () => {
    const validItems = extractedList.filter(i => i.name.trim() !== '');
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      let count = 0;
      for (const item of validItems) {
        addLocalIngredient(item.name.trim(), item.category);
        count++;
      }

      setRegisteredCount(count);
      setSuccess(true);
      setFiles([]);
      setPreviews([]);
      setExtractedList([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6f91', '#20b2aa', '#fbbf24']
      });
    } catch (e: any) {
      console.error(e);
      alert(t.receipt.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title={t.receipt.title}
        subtitle={t.receipt.subtitle}
        mascot="bear_wave"
      />

      <p className="text-muted mb-4" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>
        {t.receipt.description}
      </p>

      {errorMsg && (
        <div className={styles.errorAlert}>
          {errorMsg}
        </div>
      )}

      {success && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>
            <CheckCircle size={40} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)', marginBottom: '8px' }}>{t.receipt.successTitle}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
              {t.receipt.successText(registeredCount)}
            </p>
            <button
              className={styles.submitBtn}
              onClick={() => router.push("/")}
              style={{ marginTop: "12px" }}
            >
              {t.receipt.checkInventoryButton}
            </button>
          </div>
        </div>
      )}

      {/* 抽出結果プレビュー＆編集UI */}
      {!loading && !success && extractedList.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: 20, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={18} color="#ff6f91" />
              {t.receipt.reviewTitle}
            </h3>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{t.receipt.reviewCount(extractedList.length)}</span>
          </div>

          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
            {t.receipt.reviewHint}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4, marginBottom: 16 }}>
            {extractedList.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', padding: '8px 10px', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <input
                  type="text"
                  value={item.name}
                  placeholder={t.receipt.namePlaceholder}
                  onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white' }}
                />
                <select
                  value={item.category}
                  onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: 'white', color: '#4b5563' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{t.category[cat] || cat}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleItemDelete(item.id)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
                  title={t.receipt.deleteTitle}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={handleAddItem}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px',
                background: '#f3f4f6',
                border: '1px dashed #d1d5db',
                borderRadius: 10,
                fontSize: 13,
                color: '#4b5563',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              <Plus size={15} /> {t.receipt.addItemButton}
            </button>
          </div>

          <button
            className={styles.submitBtn}
            onClick={handleSaveToInventory}
            disabled={saving || extractedList.filter(i => i.name.trim() !== '').length === 0}
          >
            {saving ? <Loader2 className="spinner" size={20} /> : <CheckCircle size={20} />}
            {t.receipt.saveButton(extractedList.filter(i => i.name.trim() !== '').length)}
          </button>
        </div>
      )}

      {/* 画像選択UI */}
      {!loading && !success && extractedList.length === 0 && (
        <>
          <label className={styles.uploadBox}>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className={styles.hiddenInput}
            />
            {previews.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: 12 }}>
                {previews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Preview ${i + 1}`}
                    style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 12, border: '2px solid #ff6f91' }}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                  <Camera size={36} className="text-muted" />
                  <ImageIcon size={36} className="text-muted" />
                </div>
                <span style={{ fontWeight: 700, color: '#374151' }}>{t.receipt.selectPhotoLabel}</span>
                <span style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.receipt.selectPhotoHint}</span>
              </div>
            )}
          </label>

          {files.length > 0 && (
            <button
              className={styles.submitBtn}
              onClick={processImages}
              style={{ marginTop: "20px" }}
            >
              <Upload size={20} />
              {t.receipt.analyzeButton(files.length)}
            </button>
          )}
        </>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <motion.img
            key={loadingPose}
            src={`/mascot/${loadingPose}`}
            alt=""
            width={96}
            height={96}
            animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p>{t.receipt.analyzingText}</p>
        </div>
      )}
    </div>
  );
}
