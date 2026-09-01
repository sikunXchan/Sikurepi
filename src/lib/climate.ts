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

export async function fetchRealWeather(address: string): Promise<ClimateState | null> {
  if (!address || !address.trim()) return null;

  try {
    const geoQuery = encodeURIComponent(address.trim());
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${geoQuery}&count=1&language=ja&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return null;
    }

    const { latitude, longitude, name } = geoData.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
    );
    const weatherData = await weatherRes.json();

    if (!weatherData.current) return null;

    const temp = Math.round(weatherData.current.temperature_2m);
    const code = weatherData.current.weather_code;

    let condition = '晴れ・快適';
    let advice = '季節の旬食材を活かしたバランスの良い献立を提案中';

    if (code >= 51 && code <= 67) {
      condition = '雨・しっとり';
      advice = '身体を温めるスープやほっと落ち着く煮込み料理がおすすめ';
    } else if (code >= 71 && code <= 86) {
      condition = '雪・寒い日';
      advice = '身体の芯から温まるポカポカ鍋や生姜を使ったあったか料理';
    } else if (code >= 95) {
      condition = '雷雨・荒天';
      advice = 'おうちで手早く作れる安心感のあるホッとする時短メニュー';
    } else if (temp >= 30) {
      condition = '猛暑・暑い日';
      advice = '熱中症予防・さっぱり酸味やスタミナ満点メニュー';
    } else if (temp <= 10) {
      condition = '寒い日・冷え込み';
      advice = '代謝UP・温かいスープや根菜たっぷりのポカポカ料理';
    } else if (code >= 1 && code <= 3) {
      condition = 'くもり・過ごしやすい';
      advice = '栄養バランス抜群の彩り豊かなごちそうレシピ';
    }

    return {
      condition: `${name} (${condition})`,
      temperature: temp,
      timeOfDay: getAutoTimeOfDay(),
      advice,
    };
  } catch (e) {
    console.error('Weather fetch error:', e);
    return null;
  }
}
