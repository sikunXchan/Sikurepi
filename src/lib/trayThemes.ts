export type TrayThemeId = 'wood' | 'mint' | 'sakura' | 'midnight';

export type TrayTheme = {
  id: TrayThemeId;
  asset: string;
  name: { ja: string; en: string };
  unlocked: boolean;
  unlockRule: null | { type: string; value: number };
};

// 現段階では全種類を最初から利用可能にする。
// 将来は unlocked を固定値ではなく、unlockRule と自炊記録から算出する。
export const TRAY_THEMES: readonly TrayTheme[] = [
  {
    id: 'wood',
    asset: '/serving/recipe-tray-wood-3q.png',
    name: { ja: 'ナチュラル', en: 'Natural' },
    unlocked: true,
    unlockRule: null,
  },
  {
    id: 'mint',
    asset: '/serving/recipe-tray-mint-3q.png',
    name: { ja: 'ミント', en: 'Mint' },
    unlocked: true,
    unlockRule: null,
  },
  {
    id: 'sakura',
    asset: '/serving/recipe-tray-sakura-3q.png',
    name: { ja: 'サクラ', en: 'Sakura' },
    unlocked: true,
    unlockRule: null,
  },
  {
    id: 'midnight',
    asset: '/serving/recipe-tray-midnight-3q.png',
    name: { ja: 'ナイト', en: 'Midnight' },
    unlocked: true,
    unlockRule: null,
  },
] as const;

export function getTrayTheme(id?: TrayThemeId): TrayTheme {
  return TRAY_THEMES.find(theme => theme.id === id && theme.unlocked) ?? TRAY_THEMES[0];
}
