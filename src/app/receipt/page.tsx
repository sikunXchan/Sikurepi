"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Upload, Loader2, CheckCircle, Trash2, Plus, Sparkles, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { addLocalIngredient, CATEGORY_ORDER } from "@/lib/storage";
import { setNavLocked } from "@/lib/navLock";
import PageHeader from "@/components/PageHeader";
import KitchenLoader from "@/components/KitchenLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import styles from "./Receipt.module.css";

type ExtractedItem = {
  id: string;
  name: string;
  category: string;
};

export default function ReceiptPage() {
  const { t, language } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [extractedList, setExtractedList] = useState<ExtractedItem[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  // このページを離れる際は、ロックと画像プレビュー用URLを必ず片付ける。
  useEffect(() => () => {
    setNavLocked(false);
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const clearSelectedFiles = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setFiles([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      const fileArr = Array.from(selected);
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      const nextPreviews = fileArr.map((file) => URL.createObjectURL(file));
      previewUrlsRef.current = nextPreviews;
      setFiles(fileArr);
      setPreviews(nextPreviews);
      setErrorMsg("");
      setExtractedList([]);
      setSuccess(false);
    }
  };

  const processImages = async () => {
    if (files.length === 0) return;

    setLoading(true);
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
      formData.append("language", language);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data: { error?: string; ingredients?: unknown } = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.receipt.errorReadFailed);
      }

      const rawItems = Array.isArray(data.ingredients) ? data.ingredients : [];
      const parsed: ExtractedItem[] = rawItems.map((item: unknown, idx: number) => {
        const values = typeof item === "object" && item !== null
          ? item as Record<string, unknown>
          : null;
        return {
          id: `ext_${idx}_${Date.now()}`,
          name: typeof item === "string" ? item : typeof values?.name === "string" ? values.name : "",
          category: typeof values?.category === "string" ? values.category : "その他",
        };
      }).filter((item) => item.name.trim() !== "");

      if (parsed.length === 0) {
        throw new Error(t.receipt.errorNoIngredientsDetected);
      }

      setExtractedList(parsed);
    } catch (e: unknown) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : t.receipt.errorReadFailed);
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
      clearSelectedFiles();
      setExtractedList([]);

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6f91', '#20b2aa', '#fbbf24']
      });
    } catch (e: unknown) {
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

      <section className={styles.introCard}>
        <div className={styles.flowRow} aria-label={t.receipt.description}>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><Camera size={19} /></span>
            <span>{t.receipt.flowSelect}</span>
          </div>
          <span className={styles.flowLine} aria-hidden="true" />
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><Sparkles size={19} /></span>
            <span>{t.receipt.flowReview}</span>
          </div>
          <span className={styles.flowLine} aria-hidden="true" />
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}><CheckCircle size={19} /></span>
            <span>{t.receipt.flowStore}</span>
          </div>
        </div>
        <p className={styles.description}>{t.receipt.description}</p>
      </section>

      {errorMsg && (
        <div className={styles.errorAlert}>
          <span>{errorMsg}</span>
          <button
            type="button"
            className={styles.manualEntryBtn}
            onClick={() => {
              setErrorMsg("");
              clearSelectedFiles();
              handleAddItem();
            }}
          >
            <Plus size={16} />
            {t.receipt.manualEntryButton}
          </button>
        </div>
      )}

      {success && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>
            <CheckCircle size={40} />
          </div>
          <div className={styles.successCopy}>
            <p className={styles.successTitle}>{t.receipt.successTitle}</p>
            <p className={styles.successText}>
              {t.receipt.successText(registeredCount)}
            </p>
            <button
              className={styles.submitBtn}
              onClick={() => router.push("/inventory")}
            >
              {t.receipt.checkInventoryButton}
            </button>
          </div>
        </div>
      )}

      {/* 抽出結果プレビュー＆編集UI */}
      {!loading && !success && extractedList.length > 0 && (
        <section className={styles.reviewCard}>
          <div className={styles.reviewHeader}>
            <h3 className={styles.reviewTitle}>
              <Sparkles size={18} color="#ff6f91" />
              {t.receipt.reviewTitle}
            </h3>
            <span className={styles.reviewCount}>{t.receipt.reviewCount(extractedList.length)}</span>
          </div>

          <p className={styles.reviewHint}>
            {t.receipt.reviewHint}
          </p>

          <div className={styles.reviewList}>
            {extractedList.map((item) => (
              <div key={item.id} className={styles.reviewItem}>
                <input
                  type="text"
                  value={item.name}
                  placeholder={t.receipt.namePlaceholder}
                  onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                  className={styles.reviewInput}
                />
                <select
                  value={item.category}
                  onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                  className={styles.reviewSelect}
                >
                  {CATEGORY_ORDER.map(cat => (
                    <option key={cat} value={cat}>{t.category[cat] || cat}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleItemDelete(item.id)}
                  className={styles.reviewDelete}
                  title={t.receipt.deleteTitle}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className={styles.reviewActions}>
            <button
              onClick={handleAddItem}
              className={styles.addItemBtn}
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
        </section>
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
              <div className={styles.previewGrid}>
                {previews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className={styles.previewThumb}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.uploadIcons}>
                  <Camera size={36} className="text-muted" />
                  <ImageIcon size={36} className="text-muted" />
                </div>
                <span className={styles.uploadTitle}>{t.receipt.selectPhotoLabel}</span>
                <span className={styles.uploadHint}>{t.receipt.selectPhotoHint}</span>
              </div>
            )}
          </label>

          {files.length > 0 && (
            <button
              className={styles.submitBtn}
              onClick={processImages}
            >
              <Upload size={20} />
              {t.receipt.analyzeButton(files.length)}
            </button>
          )}
        </>
      )}

      {loading && (
        <KitchenLoader variant="delivering" text={t.receipt.analyzingText} />
      )}
    </div>
  );
}
