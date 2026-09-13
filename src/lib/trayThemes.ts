export type TrayThemeId = 'wood' | 'bear' | 'mint' | 'sakura' | 'midnight';

export type TrayTheme = {
  id: TrayThemeId;
  asset: string;
  name: { ja: string; en: string };
  unlocked: boolean;
  premiumOnly: boolean;
  unlockRule: null | { type: string; value: number };
};

// ナチュラルは無料、その他はPlus向け。unlockedは将来ランク条件も併用できるよう残す。
export const TRAY_THEMES: readonly TrayTheme[] = [
  {
    id: 'wood',
    asset: '/serving/recipe-tray-wood-3q.png',
    name: { ja: 'ナチュラル', en: 'Natural' },
    unlocked: true,
    premiumOnly: false,
    unlockRule: null,
  },
  {
    id: 'bear',
    asset: '/serving/recipe-tray-bear-v1.png',
    name: { ja: 'クマ', en: 'Bear' },
    unlocked: true,
    premiumOnly: true,
    unlockRule: null,
  },
  {
    id: 'mint',
    asset: '/serving/recipe-tray-mint-3q.png',
    name: { ja: 'ミント', en: 'Mint' },
    unlocked: true,
    premiumOnly: true,
    unlockRule: null,
  },
  {
    id: 'sakura',
    asset: '/serving/recipe-tray-sakura-3q.png',
    name: { ja: 'サクラ', en: 'Sakura' },
    unlocked: true,
    premiumOnly: true,
    unlockRule: null,
  },
  {
    id: 'midnight',
    asset: '/serving/recipe-tray-midnight-3q.png',
    name: { ja: 'ナイト', en: 'Midnight' },
    unlocked: true,
    premiumOnly: true,
    unlockRule: null,
  },
] as const;

export function getTrayTheme(id?: TrayThemeId): TrayTheme {
  return TRAY_THEMES.find(theme => theme.id === id && theme.unlocked) ?? TRAY_THEMES[0];
}
