import { ClimateState } from './storage';

export const CLIMATE_PRESETS: ClimateState[] = [
  {
    condition: '猛暑・晴れ',
    temperature: 33,
    timeOfDay: '夕食',
    advice: '熱中症予防・塩分＆さっぱり酸味（クエン酸）レシピを優先中',
  },
  {
    condition: '雨・肌寒い',
    temperature: 18,
    timeOfDay: '夕食',
    advice: '身体を芯から温める生姜・あったかスープや煮込みを提案中',
  },
  {
    condition: '冬の寒波',
    temperature: 4,
    timeOfDay: '夕食',
    advice: '代謝UP＆免疫力強化・ポカポカ鍋仕立て・根菜活用',
  },
  {
    condition: '春・うららか',
    temperature: 21,
    timeOfDay: '夕食',
    advice: '新陳代謝＆ビタミン補給・彩り豊かな旬野菜メニュー',
  },
  {
    condition: '秋・快晴',
    temperature: 20,
    timeOfDay: '夕食',
    advice: '滋養強壮＆食欲の秋・キノコや旨みたっぷりレシピ',
  },
];

export function getAutoTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return '朝食';
  if (hour >= 11 && hour < 16) return '昼食';
  if (hour >= 16 && hour < 22) return '夕食';
  return '夜食（胃にやさしい軽食）';
}
