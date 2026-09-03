"use client";

import { getIngredientIconUrl } from "@/lib/ingredientIcons";

type Props = {
  name: string;
  size?: number;
  className?: string;
};

export default function IngredientIcon({ name, size = 40, className }: Props) {
  const url = getIngredientIconUrl(name);

  if (!url) {
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
