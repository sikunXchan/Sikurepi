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

// WMO 天気コードを分かりやすい日本語と状態に変換
function parseWmoWeather(code: number, temp: number): { condition: string; advice: string } {
  let condition = '晴れ';
  let advice = '季節の旬食材を活かしたヘルシーレシピを優先中';

  if (code === 0) {
    if (temp >= 30) {
      condition = '猛暑・快晴';
      advice = '熱中症予防・水分ミネラル＆さっぱり酸味（クエン酸）メニュー';
    } else if (temp <= 8) {
      condition = '快晴・寒気';
      advice = '身体を芯から温める生姜や根菜のポカポカスープ';
    } else {
      condition = '快晴・過ごしやすい';
      advice = '食欲をそそる彩り豊かなバランス栄養メニュー';
    }
  } else if (code >= 1 && code <= 3) {
    if (temp >= 28) {
      condition = '蒸し暑い曇り';
      advice = '食欲不振予防・香味野菜（大葉・ミョウガ）や冷製さっぱり料理';
    } else if (temp <= 10) {
      condition = '曇り・冷え込み';
      advice = '代謝アップ・煮込み料理やあったかスープ';
    } else {
      condition = 'うす曇り・快適';
      advice = '食物繊維＆タンパク質たっぷりのスタミナメニュー';
    }
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    condition = temp <= 18 ? '雨・肌寒い' : '雨・しっとり';
    advice = 'おうち時間をほっこり温める煮込み料理・スープパスタ・鍋物';
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    condition = '雪・厳しい寒波';
    advice = '極上あったか鍋・身体を温める生姜・にんにく・根菜のポトフ';
  } else if (code >= 95) {
    condition = '雷雨・荒天';
    advice = '時短ワンパン・包丁最小限のお手軽元気メニュー';
  }

  return { condition, advice };
}

// Open-Meteo API による無料リアルタイム天気取得
export async function fetchRealWeather(address: string): Promise<ClimateState | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    // 1. Geocoding API で緯度経度を取得
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=ja&format=json`
    );
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;

    const loc = geoData.results[0];
    const lat = loc.latitude;
    const lon = loc.longitude;
    const cityName = loc.name || query;

    // 2. Forecast API で現在の気温と天気コードを取得
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!weatherRes.ok) return null;
    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    if (!current) return null;

    const temp = Math.round(current.temperature_2m);
    const code = current.weather_code;
    const { condition, advice } = parseWmoWeather(code, temp);
    const timeOfDay = getAutoTimeOfDay();

    return {
      condition,
      temperature: temp,
      timeOfDay,
      advice,
      cityName,
      isRealData: true,
    };
  } catch (e) {
    console.error('Failed to fetch real weather from Open-Meteo:', e);
    return null;
  }
}
