// レシート解析中など、画面遷移すると処理が失われてしまう最中に
// ボトムナビの誤タップで離脱してしまわないようロックするための仕組み。
// BottomNavはグローバルにマウントされているため、各ページからは
// このイベント経由でロック状態を伝える。
export const NAV_LOCK_EVENT = "nav-lock-changed";

export function setNavLocked(locked: boolean) {
  window.dispatchEvent(new CustomEvent(NAV_LOCK_EVENT, { detail: { locked } }));
}
