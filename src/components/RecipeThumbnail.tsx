"use client";

import { useState } from "react";
import IngredientIcon from "./IngredientIcon";

// ジャンルの料理イラスト。public/genres/{slug}.png を参照する。
// 「その他」用のイラストは無いため、画像が無い場合(404)はonErrorで
// 食材アイコンのサムネイルに自動フォールバックする。
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
  "スペイン料理": "spanish",
  "ギリシャ料理": "greek",
  "ドイツ・中欧料理": "german",
  "北欧料理": "nordic",
  "ロシア・東欧料理": "russian",
  "ベトナム料理": "vietnamese",
  "台湾料理": "taiwanese",
  "インドネシア・マレーシア料理": "indomalay",
  "アメリカ南部料理": "americansouth",
  "モロッコ・北アフリカ料理": "moroccan",
  "エチオピア料理": "ethiopian",
  "ジャマイカ・カリブ料理": "caribbean",
  "ペルー料理": "peruvian",
  "ブラジル料理": "brazilian",
  "シンガポール料理": "singaporean",
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
