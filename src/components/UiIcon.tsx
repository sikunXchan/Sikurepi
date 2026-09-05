"use client";

// 在庫カテゴリー・買い物リスト・レシピのコース・気候・おすすめテンプレート等、
// これまで絵文字1文字で表示していたUIアイコンを、専用イラスト(public/icons/ui/)に
// 差し替えるための共通コンポーネント。食材アイコン(IngredientIcon)とは別系統。
type Props = {
  slug: string;
  size?: number;
  alt?: string;
  className?: string;
};

export default function UiIcon({ slug, size = 20, alt = "", className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/ui/${slug}.png`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    />
  );
}
