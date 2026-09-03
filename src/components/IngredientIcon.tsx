"use client";

import { useState } from "react";
import { getIngredientIconUrl } from "@/lib/ingredientIcons";

type Props = {
  name: string;
  size?: number;
  className?: string;
};

function PlaceholderIcon({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--card-bg-solid)",
        border: "1px solid var(--border)",
        borderRadius: "50%",
        fontSize: size * 0.5,
      }}
    >
      🍽️
    </div>
  );
}

export default function IngredientIcon({ name, size = 40, className }: Props) {
  const url = getIngredientIconUrl(name);
  // キーワード辞書にはあるがファイルが無い/読み込みに失敗した場合、
  // 壊れた画像アイコンのまま表示され続けないよう絵文字プレースホルダーに逃がす。
  const [loadFailed, setLoadFailed] = useState(false);

  if (!url || loadFailed) {
    return <PlaceholderIcon size={size} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={() => setLoadFailed(true)}
    />
  );
}
