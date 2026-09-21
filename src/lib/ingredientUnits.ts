type UnitRule = {
  label: string;
  ingredient: RegExp;
  allowed: RegExp;
};

const VAGUE_AMOUNT = /^(?:適量|少々|ひとつまみ|一つまみ|お好みで?|必要量|to taste|as needed|a pinch)$/i;
// Short units must be complete tokens: the "l" in "whole" or "large"
// is not a litre, and "lb" must not be read as "l".
const UNIT_TOKEN = /大さじ|小さじ|カップ|キューブ|合|丁|片|かけ|切れ|切|尾|匹|枚|本|個|コ|玉|束|株|房|袋|パック|缶|杯|膳|食分|人分|人前|(?<![a-z])(?:ml|cc|kg|mg|g|oz|lb|l|cups?|tablespoons?|tbsp|teaspoons?|tsp|cloves?|fillets?|slices?|pieces?|wedges?|heads?|bunch(?:es)?|packs?|cans?|servings?|cubes?)(?![a-z])/gi;

// 上にある規則ほど優先する。「鶏がらスープ」を肉、「オリーブ油」を実として
// 誤判定しないため、加工品・液体を生鮮食材より先に置く。
const UNIT_RULES: UnitRule[] = [
  {
    // Pepper as a spice is not a bell pepper counted as a vegetable.
    label: 'こしょう',
    ingredient: /こしょう|コショウ|胡椒|\b(?:(?:ground\s+)?(?:black|white)\s+pepper|peppercorns?)\b|^pepper$/i,
    allowed: /^(?:g|kg|mg|大さじ|小さじ|tablespoons?|tbsp|teaspoons?|tsp|oz|lb)$/i,
  },
  {
    label: '缶詰',
    ingredient: /缶詰|水煮缶|トマト缶|ツナ缶|さば缶|鯖缶|canned/i,
    allowed: /^(?:缶|g|kg|ml|cc|cans?)$/i,
  },
  {
    label: '固形・顆粒のだし',
    ingredient: /顆粒.*(?:だし|出汁)|(?:だし|出汁).*顆粒|スープの素|固形コンソメ|コンソメキューブ|固形ブイヨン|ブイヨンキューブ|stock cubes?|bouillon cubes?/i,
    allowed: /^(?:g|mg|個|コ|キューブ|大さじ|小さじ|tablespoons?|tbsp|teaspoons?|tsp|cubes?)$/i,
  },
  {
    label: '液体',
    ingredient: /水|湯|だし|出汁|スープ|ブイヨン|コンソメ|牛乳|豆乳|生クリーム|ジュース|果汁|レモン汁|ライム汁|酢|醤油|しょうゆ|みりん|料理酒|酒|ワイン|(?:サラダ|ごま|オリーブ|米|菜種|調理)?油(?!揚げ)|オイル|液体|water|stock|broth|milk|cream|juice|vinegar|soy sauce|mirin|sake|wine|oil/i,
    allowed: /^(?:ml|cc|l|g|mg|大さじ|小さじ|カップ|cups?|tablespoons?|tbsp|teaspoons?|tsp)$/i,
  },
  {
    label: '卵',
    ingredient: /卵|たまご|玉子|うずら卵|\beggs?\b/i,
    allowed: /^(?:個|コ|玉|g|mg|pieces?)$/i,
  },
  {
    label: '豆腐',
    ingredient: /豆腐|厚揚げ|油揚げ|納豆|tofu|natto/i,
    allowed: /^(?:丁|枚|個|コ|袋|パック|g|kg|pieces?|packs?)$/i,
  },
  {
    label: '炊いたご飯',
    ingredient: /温かいご飯|炊いたご飯|ごはん|ご飯|玄米ご飯|雑穀ご飯|cooked rice/i,
    allowed: /^(?:g|kg|杯|膳|個|コ|パック|食分|人分|cups?|servings?|packs?)$/i,
  },
  {
    label: '米',
    ingredient: /^(?:米|白米|玄米|もち米|雑穀米|rice)$/i,
    allowed: /^(?:g|kg|ml|cc|合|カップ|cups?)$/i,
  },
  {
    label: '麺',
    ingredient: /麺|うどん|そば|蕎麦|そうめん|素麺|パスタ|スパゲッティ|マカロニ|中華麺|焼きそば|noodles?|udon|soba|pasta|spaghetti|macaroni/i,
    allowed: /^(?:g|kg|束|玉|袋|パック|食分|人分|人前|packs?|servings?)$/i,
  },
  {
    label: '肉・魚',
    ingredient: /鶏|豚|牛|ひき肉|挽肉|ミンチ|肉|鮭|さけ|サーモン|鯖|さば|たら|鯛|まぐろ|魚|えび|海老|いか|たこ|貝|chicken|pork|beef|meat|salmon|mackerel|cod|tuna|fish|shrimp|prawn|squid|octopus|shellfish/i,
    allowed: /^(?:g|kg|mg|切れ|切|尾|匹|枚|本|個|コ|杯|パック|fillets?|pieces?|slices?|packs?|oz|lb)$/i,
  },
  {
    label: 'にんにく',
    ingredient: /にんにく|ニンニク|garlic/i,
    allowed: /^(?:片|かけ|個|コ|g|mg|大さじ|小さじ|cloves?|pieces?|tablespoons?|tbsp|teaspoons?|tsp)$/i,
  },
  {
    label: '粉・おろしたチーズ',
    ingredient: /粉チーズ|パルメザン|(?:grated|shredded|powdered) cheese|parmesan/i,
    allowed: /^(?:g|kg|mg|大さじ|小さじ|カップ|cups?|tablespoons?|tbsp|teaspoons?|tsp|oz|lb)$/i,
  },
  {
    label: '香草',
    ingredient: /パセリ|バジル|パクチー|コリアンダー|オレガノ|タイム|ローズマリー|ディル|\b(?:parsley|basil|cilantro|coriander|oregano|thyme|rosemary|dill)\b/i,
    allowed: /^(?:束|袋|パック|株|本|枚|g|kg|大さじ|小さじ|カップ|cups?|tablespoons?|tbsp|teaspoons?|tsp|bunch(?:es)?|packs?|heads?)$/i,
  },
  {
    label: '葉物野菜',
    ingredient: /ほうれん草|小松菜|水菜|春菊|にら|ニラ|青ねぎ|万能ねぎ|パセリ|バジル|leafy|spinach|kale|chives?|parsley|basil/i,
    allowed: /^(?:束|袋|パック|株|本|枚|g|kg|bunch(?:es)?|packs?|heads?)$/i,
  },
  {
    label: '長い野菜',
    ingredient: /にんじん|人参|大根|きゅうり|ごぼう|れんこん|なす|茄子|ズッキーニ|長ねぎ|小ねぎ|(?<!玉)ねぎ|葱|アスパラ|carrots?|daikon|cucumbers?|eggplants?|zucchini|leeks?|asparagus/i,
    allowed: /^(?:本|個|コ|節|束|袋|パック|g|kg|pieces?|bunch(?:es)?|packs?)$/i,
  },
  {
    label: '玉・房で数える野菜',
    ingredient: /玉ねぎ|たまねぎ|キャベツ|レタス|白菜|ブロッコリー|カリフラワー|かぼちゃ|南瓜|onions?|cabbage|lettuce|broccoli|cauliflower|pumpkin/i,
    allowed: /^(?:個|コ|玉|株|房|枚|袋|パック|g|kg|pieces?|heads?|packs?)$/i,
  },
  {
    label: '個で数える野菜・果物',
    ingredient: /じゃがいも|さつまいも|里芋|トマト|ピーマン|パプリカ|りんご|林檎|レモン|ライム|オレンジ|キウイ|potato|tomato|pepper|apple|lemon|lime|orange|kiwi/i,
    allowed: /^(?:個|コ|本|枚|切れ|切|袋|パック|g|kg|pieces?|slices?|wedges?|packs?)$/i,
  },
  {
    label: 'きのこ',
    ingredient: /きのこ|しめじ|えのき|舞茸|まいたけ|椎茸|しいたけ|マッシュルーム|mushroom/i,
    allowed: /^(?:袋|パック|株|枚|個|コ|g|kg|packs?|pieces?)$/i,
  },
  {
    label: 'パン',
    ingredient: /パン|食パン|バゲット|ロール|bread|baguette|rolls?/i,
    allowed: /^(?:枚|個|コ|本|袋|パック|g|kg|slices?|pieces?|packs?)$/i,
  },
  {
    label: 'チーズ',
    ingredient: /チーズ|cheese/i,
    allowed: /^(?:g|kg|mg|枚|個|コ|袋|パック|slices?|pieces?|packs?|oz|lb)$/i,
  },
  {
    label: '粉・乾物・調味料',
    ingredient: /塩|しお|胡椒|こしょう|砂糖|味噌|みそ|小麦粉|薄力粉|強力粉|片栗粉|パン粉|粉|ごま|胡麻|バター|はちみつ|蜂蜜|ケチャップ|マヨネーズ|ソース|salt|pepper|sugar|miso|flour|starch|crumbs|sesame|butter|honey|ketchup|mayonnaise|sauce/i,
    allowed: /^(?:g|kg|mg|大さじ|小さじ|カップ|袋|パック|個|コ|cups?|tablespoons?|tbsp|teaspoons?|tsp|packs?|oz|lb)$/i,
  },
];

function normalizedUnits(amount: string): string[] {
  return [...amount.normalize('NFKC').matchAll(UNIT_TOKEN)].map((match) => match[0].toLowerCase());
}

/** 明確に食材と食い違う単位だけを拒否する。未知の食材はAIの表現を妨げない。 */
export function validateIngredientUnit(name: string, amount: string): string | null {
  const normalizedName = name.normalize('NFKC').trim();
  const normalizedAmount = amount.normalize('NFKC').trim();
  if (!normalizedName || !normalizedAmount || VAGUE_AMOUNT.test(normalizedAmount)) return null;
  const rule = UNIT_RULES.find((candidate) => candidate.ingredient.test(normalizedName));
  if (!rule) return null;
  const units = normalizedUnits(normalizedAmount);
  if (units.length === 0 || units.every((unit) => rule.allowed.test(unit))) return null;
  return `${name} is categorized as ${rule.label}, but its unit is unsuitable: ${amount}`;
}

export function validateIngredientUnits(ingredients: { name: string; amount: string }[]): string[] {
  return ingredients.flatMap((ingredient) => {
    const error = validateIngredientUnit(ingredient.name, ingredient.amount);
    return error ? [error] : [];
  });
}

export function buildIngredientUnitInstruction(language: 'ja' | 'en'): string {
  if (language === 'en') {
    return `\n[Ingredient-specific measurement units — mandatory]\nUse a natural unit for each ingredient: liquids in ml/L, cups, tbsp or tsp; meat and fish in g/kg (or oz/lb), fillets/pieces where natural; eggs by count; tofu by block/pack or g; uncooked rice in g or Japanese go/cups and cooked rice in g/bowls/servings; noodles in g, bundles or portions; vegetables in their natural count (onions/potatoes/tomatoes by piece, carrots/cucumbers by length, leafy vegetables by bunch, mushrooms by pack) or g; seasonings in g, tbsp/tsp, a pinch or to taste. Never measure solid meat, vegetables or eggs in ml, and never measure liquids by piece. Use one primary unit consistently and add a gram equivalent in parentheses only when useful.\n`;
  }
  return `\n【食材別の単位（必須）】\n食材ごとに自然な単位を使ってください。液体はml・L・カップ・大さじ・小さじ、肉魚はg・kg（切り身は切れ、えび等は尾も可）、卵は個、豆腐は丁・パック・g、生米は合・g、炊いたご飯はg・杯・膳、麺はg・玉・束、玉ねぎ・じゃがいも・トマト等は個、にんじん・大根・きゅうり等は本、葉物は束・袋、きのこはパック・袋、調味料はg・大さじ・小さじ・少々・適量を基本にしてください。固形の肉・野菜・卵をmlで表したり、液体を個で表したりしないでください。主単位は一つに統一し、必要なら「1/2個（約100g）」のように換算値を補足してください。\n`;
}
