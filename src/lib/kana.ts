// カタカナ→ひらがな正規化ユーティリティ。
// 食材名の判定(カテゴリ推定・アイコン解決・レシピ検証の除外チェック等)で
// カタカナ/ひらがなの表記ゆれ(「トマト」⇔「とまと」等)を吸収するために
// 複数箇所から共通で使う。
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
