"use client";

import { useState, useRef } from "react";
import { Camera, Upload, Loader2, CheckCircle, Trash2, Plus, ArrowRight, Sparkles, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { addLocalIngredient } from "@/lib/storage";
import styles from "./Receipt.module.css";

type ExtractedItem = {
  id: string;
  name: string;
  category: string;
};

const CATEGORIES = ['野菜', '肉', '魚介類', '乳製品・卵', '穀物・パン', '豆類', '果物', '調味料', 'その他'];

export default function ReceiptPage() {
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
    setErrorMsg("");
    setExtractedList([]);
    setSuccess(false);

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
        throw new Error(data.error || "読み取りに失敗しました");
      }

      const rawItems = data.ingredients || [];
      const parsed: ExtractedItem[] = rawItems.map((item: any, idx: number) => ({
        id: `ext_${idx}_${Date.now()}`,
        name: typeof item === 'string' ? item : item.name || '',
        category: typeof item === 'object' && item.category ? item.category : 'その他',
      })).filter((i: ExtractedItem) => i.name.trim() !== '');

      if (parsed.length === 0) {
        throw new Error("画像から食材が検出されませんでした。別の写真でお試しください。");
      }

      setExtractedList(parsed);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
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
        colors: ['#ff7849', '#20b2aa', '#fbbf24']
      });
    } catch (e: any) {
      console.error(e);
      alert("在庫への追加中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>📷 食材スキャン・画像解析</h1>

      <p className="text-center text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
        レシートや冷蔵庫・食材の写真をアップロードすると、AIが食材を自動検出します（複数枚同時OK）。
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
            <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)', marginBottom: '8px' }}>登録完了！</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
              {registeredCount}件の食材を冷蔵庫の在庫に追加しました。
            </p>
            <button
              className={styles.submitBtn}
              onClick={() => router.push("/")}
              style={{ marginTop: "12px" }}
            >
              冷蔵庫の在庫を確認する
            </button>
          </div>
        </div>
      )}

      {/* 抽出結果プレビュー＆編集UI */}
      {!loading && !success && extractedList.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: 20, padding: 20, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={18} color="#ff7849" />
              検出結果の確認・編集
            </h3>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{extractedList.length}件</span>
          </div>

          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
            誤認識した食材の修正・削除や、カテゴリの変更ができます。確認後に在庫へ追加してください。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4, marginBottom: 16 }}>
            {extractedList.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', padding: '8px 10px', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <input
                  type="text"
                  value={item.name}
                  placeholder="食材名"
                  onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: 'white' }}
                />
                <select
                  value={item.category}
                  onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, background: 'white', color: '#4b5563' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleItemDelete(item.id)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
                  title="削除"
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
                fontWeight: 600,
              }}
            >
              <Plus size={15} /> 食材を追加
            </button>
          </div>

          <button
            className={styles.submitBtn}
            onClick={handleSaveToInventory}
            disabled={saving || extractedList.filter(i => i.name.trim() !== '').length === 0}
          >
            {saving ? <Loader2 className="spinner" size={20} /> : <CheckCircle size={20} />}
            {extractedList.filter(i => i.name.trim() !== '').length}件を冷蔵庫に追加する
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
                    style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 12, border: '2px solid #ff7849' }}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                  <Camera size={36} className="text-muted" />
                  <ImageIcon size={36} className="text-muted" />
                </div>
                <span style={{ fontWeight: 600, color: '#374151' }}>写真を選択 / 撮影（複数可）</span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>レシート・冷蔵庫の中・食材</span>
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
              {files.length}枚の画像を解析する
            </button>
          )}
        </>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <div className="spinner-container">
            <Loader2 className="spinner" size={48} />
          </div>
          <p>AIが画像を解析して食材を抽出中...</p>
        </div>
      )}
    </div>
  );
}
