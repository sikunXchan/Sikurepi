import { toHiragana } from './kana.ts';

// Food identity is deliberately separate from icon selection. Several different
// foods share an icon, which is not evidence that a pantry ingredient is present.
const EQUIVALENT_NAMES = [
  ['鶏肉', 'chicken', 'chicken meat'],
  ['鶏むね肉', '鶏胸肉', '鶏むね', 'chicken breast', 'chicken breasts'],
  ['鶏もも肉', '鶏もも', 'chicken thigh', 'chicken thighs'],
  ['鶏ささみ', 'ささみ', 'chicken tenderloin', 'chicken tenderloins'],
  ['鶏ひき肉', '鶏挽き肉', 'ground chicken', 'minced chicken'],
  ['豚肉', 'pork'], ['豚バラ肉', '豚ばら肉', '豚バラ', 'pork belly'],
  ['豚ロース肉', '豚ロース', 'pork loin'],
  ['豚ひき肉', '豚挽き肉', 'ground pork', 'minced pork'],
  ['牛肉', 'beef'], ['牛ひき肉', '牛挽き肉', 'ground beef', 'minced beef'],
  ['鮭', 'さけ', 'サーモン', 'salmon', 'salmon fillet', 'salmon fillets'],
  ['鯖', 'さば', 'mackerel'], ['鱈', 'たら', 'cod', 'cod fillet', 'cod fillets'],
  ['まぐろ', 'マグロ', 'tuna'], ['ツナ缶', 'canned tuna'],
  ['えび', '海老', 'エビ', 'shrimp', 'shrimps', 'prawn', 'prawns'],
  ['いか', '烏賊', 'squid'], ['たこ', '蛸', 'octopus'], ['あさり', 'clams', 'clam'],
  ['キャベツ', 'cabbage'], ['玉ねぎ', '玉葱', 'たまねぎ', 'onion', 'onions'],
  ['赤玉ねぎ', '紫玉ねぎ', 'red onion', 'red onions'],
  ['にんじん', '人参', 'carrot', 'carrots'],
  ['じゃがいも', '馬鈴薯', 'potato', 'potatoes'],
  ['さつまいも', 'サツマイモ', 'sweet potato', 'sweet potatoes'],
  ['トマト', 'tomato', 'tomatoes'], ['ミニトマト', 'cherry tomato', 'cherry tomatoes'],
  ['トマト缶', 'カットトマト缶', 'canned tomatoes', 'canned tomato'],
  ['きゅうり', '胡瓜', 'cucumber', 'cucumbers'], ['なす', '茄子', 'eggplant', 'aubergine'],
  ['ブロッコリー', 'broccoli'], ['カリフラワー', 'cauliflower'],
  ['ほうれん草', 'ほうれんそう', 'spinach'], ['小松菜', 'komatsuna'],
  ['白菜', 'napa cabbage', 'chinese cabbage'], ['レタス', 'lettuce'],
  ['ピーマン', 'green bell pepper', 'green pepper'], ['パプリカ', 'bell pepper', 'bell peppers'],
  ['アスパラガス', 'アスパラ', 'asparagus'], ['ズッキーニ', 'zucchini', 'courgette'],
  ['かぼちゃ', '南瓜', 'pumpkin', 'kabocha'], ['大根', 'だいこん', 'daikon', 'daikon radish'],
  ['もやし', 'bean sprouts'], ['長ねぎ', '長葱', 'naganegi', 'japanese leek'],
  ['青ねぎ', '小ねぎ', '万能ねぎ', 'scallions', 'scallion', 'green onion', 'green onions'],
  ['しめじ', 'ぶなしめじ', 'shimeji', 'shimeji mushrooms'],
  ['しいたけ', '椎茸', 'shiitake', 'shiitake mushrooms'],
  ['えのき', 'えのきたけ', 'enoki', 'enoki mushrooms'],
  ['舞茸', 'まいたけ', 'maitake', 'maitake mushrooms'],
  ['マッシュルーム', 'button mushrooms', 'button mushroom'],
  ['にんにく', '大蒜', 'garlic'], ['しょうが', '生姜', 'ginger'],
  ['レモン', 'lemon', 'lemons'], ['レモン汁', 'lemon juice'],
  ['卵', '鶏卵', 'たまご', '玉子', 'egg', 'eggs'],
  ['牛乳', 'milk', 'whole milk'], ['豆乳', 'soy milk', 'soymilk'],
  ['豆腐', 'tofu'], ['木綿豆腐', 'firm tofu'], ['絹ごし豆腐', '絹豆腐', 'silken tofu'],
  ['ヨーグルト', 'yogurt', 'yoghurt'], ['チーズ', 'cheese'],
  ['米', '白米', 'rice', 'uncooked rice', 'uncooked white rice'],
  ['ご飯', 'ごはん', 'cooked rice', 'steamed rice', 'cooked white rice', 'steamed white rice'],
  ['玄米', 'brown rice'], ['パスタ', 'pasta'], ['スパゲッティ', 'spaghetti'],
  ['うどん', 'udon', 'udon noodles'], ['そば', '蕎麦', 'soba', 'soba noodles'],
  ['食パン', 'sliced bread', 'sandwich bread'], ['小麦粉', 'flour', 'wheat flour'],
  ['薄力粉', 'cake flour'], ['片栗粉', 'potato starch'], ['コーンスターチ', 'cornstarch', 'corn starch'],
  ['ひよこ豆', 'chickpeas', 'chickpea'], ['レンズ豆', 'lentils', 'lentil'],
  ['バナナ', 'banana', 'bananas'], ['りんご', '林檎', 'apple', 'apples'],
  ['いちご', '苺', 'strawberry', 'strawberries'],
  ['塩', 'しお', 'salt'], ['こしょう', '胡椒', 'pepper', 'black pepper'],
  ['砂糖', 'sugar'], ['醤油', 'しょうゆ', 'soy sauce'], ['味噌', 'みそ', 'miso'],
  ['酢', 'vinegar'], ['米酢', 'rice vinegar'], ['みりん', 'mirin'],
  ['料理酒', 'cooking sake'], ['ごま油', 'sesame oil'], ['サラダ油', 'salad oil', 'vegetable oil'],
  ['オリーブ油', 'オリーブオイル', 'olive oil'], ['バター', 'butter'],
  ['マヨネーズ', 'mayonnaise'], ['ケチャップ', 'ketchup'],
] as const;

function normalizeName(name: string): string {
  return toHiragana(name.normalize('NFKC').trim().toLowerCase())
    // Preparation descriptors can vary between the pantry and recipe. Keep
    // identity-changing words such as ground, canned, cooked and certified.
    .replace(/\b(?:fresh|boneless|skinless|finely|roughly|thinly|thickly|chopped|diced|sliced|shredded|peeled)\b/g, '')
    .replace(/皮なし|骨なし|みじん切り|薄切り|角切り|一口大/g, '')
    .replace(/[()（）,、]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const identities = new Map<string, number>();
EQUIVALENT_NAMES.forEach((names, identity) => {
  for (const name of names) identities.set(normalizeName(name), identity);
});

// A generic pantry entry can be named more specifically in the recipe, as
// before. This does not make two distinct cuts or tofu textures equivalent.
const genericPairs = [
  ['鶏肉', '鶏むね肉'], ['鶏肉', '鶏もも肉'], ['鶏肉', '鶏ささみ'],
  ['豚肉', '豚バラ肉'], ['豚肉', '豚ロース肉'],
  ['豆腐', '木綿豆腐'], ['豆腐', '絹ごし豆腐'],
].map(([generic, specific]) => [identities.get(normalizeName(generic)), identities.get(normalizeName(specific))]);

export function ingredientNamesMatch(actual: string, expected: string): boolean {
  const a = normalizeName(actual);
  const e = normalizeName(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  const actualId = identities.get(a);
  const expectedId = identities.get(e);
  if (actualId !== undefined && expectedId !== undefined) {
    return actualId === expectedId || genericPairs.some(([generic, specific]) =>
      (actualId === generic && expectedId === specific) || (expectedId === generic && actualId === specific)
    );
  }

  // Retain existing same-language descriptive matches for uncatalogued foods;
  // never use broad icon/category equivalence to infer a cross-language match.
  const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
  if (japanese.test(a) && japanese.test(e)) return a.includes(e) || e.includes(a);
  if (japanese.test(a) || japanese.test(e)) return false;
  return ` ${a} `.includes(` ${e} `) || ` ${e} `.includes(` ${a} `);
}
