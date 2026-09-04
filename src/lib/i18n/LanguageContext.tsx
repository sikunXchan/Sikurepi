"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import ja from "./locales/ja";
import en from "./locales/en";

export type Language = "ja" | "en";

const DICTIONARIES = { ja, en } as const;
const STORAGE_KEY = "lily_app_language";

type Dictionary = typeof ja;

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Dictionary;
};

// SSR時とクライアント初回レンダーの不一致を避けるため、既定値は常に日本語固定。
// 実際の保存済み言語設定は useEffect 内でのみ読み込む(ChefProfileBadge等と同じパターン)。
const LanguageContext = createContext<LanguageContextValue>({
  language: "ja",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: ja,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ja");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ja" || saved === "en") setLanguageState(saved);
    } catch {
      // localStorage不可の環境ではデフォルト(ja)のまま
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 保存できなくても表示切り替え自体は継続
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === "ja" ? "en" : "ja";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    toggleLanguage,
    t: DICTIONARIES[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
