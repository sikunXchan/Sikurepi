"use client";

import { useEffect, useState } from "react";
import { getIngredientIconUrl, ICON_BASE_PATH } from "@/lib/ingredientIcons";
import { getResolvedIconSlug, requestIconMatch, subscribeIconResolved } from "@/lib/embeddingMatch";

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
  const staticUrl = getIngredientIconUrl(name);
  // キーワード辞書にはあるがファイルが無い/読み込みに失敗した場合、
  // 壊れた画像アイコンのまま表示され続けないよう絵文字プレースホルダーに逃がす。
  const [loadFailed, setLoadFailed] = useState(false);
  // 静的キーワードで判定できなかった食材名(例: 英語表記)は、オフラインの
  // 意味マッチング(embeddingMatch.ts)による後追い解決を試みる。結果が出るまでは
  // プレースホルダーを表示し、解決済みキャッシュが更新されたら再レンダリングする。
  const [resolvedSlug, setResolvedSlug] = useState<string | null | undefined>(
    staticUrl ? undefined : getResolvedIconSlug(name)
  );

  useEffect(() => {
    if (staticUrl) return;
    const cached = getResolvedIconSlug(name);
    if (cached !== undefined) {
      setResolvedSlug(cached);
      return;
    }
    requestIconMatch(name);
    const unsubscribe = subscribeIconResolved(() => {
      const result = getResolvedIconSlug(name);
      if (result !== undefined) setResolvedSlug(result);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, staticUrl]);

  const url = staticUrl || (resolvedSlug ? `${ICON_BASE_PATH}${resolvedSlug}.png` : null);

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
