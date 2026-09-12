"use client";

import { useEffect } from "react";

function eventTargetsImage(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("img"));
}

/**
 * iOS/Androidの長押し画像プレビューと、デスクトップの画像ドラッグを止める。
 * pointerイベント自体は妨げないため、在庫アイコンのタップ・長押し操作は維持する。
 */
export default function ImageInteractionGuard() {
  useEffect(() => {
    const preventImageDefault = (event: Event) => {
      if (eventTargetsImage(event)) event.preventDefault();
    };

    document.addEventListener("contextmenu", preventImageDefault, true);
    document.addEventListener("dragstart", preventImageDefault, true);
    return () => {
      document.removeEventListener("contextmenu", preventImageDefault, true);
      document.removeEventListener("dragstart", preventImageDefault, true);
    };
  }, []);

  return null;
}
