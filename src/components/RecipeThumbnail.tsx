"use client";

import { useState } from "react";
import IngredientIcon from "./IngredientIcon";

// ジャンルの料理イラスト(未作成)を置くための差し替え先。用意でき次第
// public/genres/{slug}.png を置けば、コード変更なしで自動的に使われる。
// 画像が無い間は404になり、onErrorで食材アイコンのサムネイルに自動フォールバックする。
export const GENRE_ICON_SLUGS: Record<string, string> = {
  "和食": "washoku",
  "洋食": "yoshoku",
  "中華": "chuka",
  "アジア料理": "asian",
  "韓国料理": "korean",
  "タイ料理": "thai",
  "インド料理": "indian",
  "メキシコ料理": "mexican",
  "中東料理": "middleeastern",
  "イタリアン": "italian",
  "フレンチ": "french",
  "その他": "other",
};

type Props = {
  genre?: string | null;
  fallbackIngredientName: string;
  size?: number;
  className?: string;
};

export default function RecipeThumbnail({ genre, fallbackIngredientName, size = 50, className }: Props) {
  const slug = genre ? GENRE_ICON_SLUGS[genre] : undefined;
  const [genreImageFailed, setGenreImageFailed] = useState(false);

  if (slug && !genreImageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/genres/${slug}.png`}
        alt={genre || ""}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain", flexShrink: 0 }}
        onError={() => setGenreImageFailed(true)}
      />
    );
  }

  return <IngredientIcon name={fallbackIngredientName} size={size} className={className} />;
}
