/**
 * 食事制限の決定論的な安全層。
 *
 * AIへの指示だけではなく、生成された料理名・材料・分量・工程・コツを
 * コードで検査する。ここをプロンプトと検証の唯一の定義元にすることで、
 * 「AIには禁止したが検証側では許可した」というずれを防ぐ。
 */

export const DIETARY_RESTRICTION_OPTIONS = [
  "ベジタリアン",
  "ヴィーガン",
  "ハラール（イスラム教）",
  "コーシャ（ユダヤ教）",
  "豚肉不可",
  "牛肉不可",
  "アルコール不可",
  "グルテンフリー",
  "乳製品不使用",
  "卵不使用",
  "魚介類不使用",
  "ナッツ不使用",
  "大豆不使用",
] as const;

export type DietaryRestriction = (typeof DIETARY_RESTRICTION_OPTIONS)[number];

export const DIETARY_RESTRICTION_INSTRUCTIONS: Record<string, string> = {
  "ベジタリアン": "肉・魚・魚介類と、それらのだし・エキス・ゼラチンを使用しない。卵・乳製品は使用可",
  "ヴィーガン": "肉・魚・魚介類・卵・乳製品・はちみつ・動物性だし・ゼラチンなど、動物由来の食材を使用しない",
  "ハラール（イスラム教）": "豚由来成分とアルコールを使用しない。肉・鶏肉・動物性ゼラチンは、材料名にハラール認証済みと明記できるものだけを使用する",
  "コーシャ（ユダヤ教）": "豚・甲殻類・貝・軟体動物を使用しない。肉はコーシャ認証済みと明記し、肉と乳製品を同じ料理に組み合わせない",
  "豚肉不可": "豚肉・ラード・豚由来ゼラチン・豚肉加工品を使用しない",
  "牛肉不可": "牛肉・牛肉加工品・牛由来エキスを使用しない（牛乳など乳製品は使用可）",
  "アルコール不可": "みりん・料理酒・日本酒・ワイン・ビールなど、調理用を含むアルコールを使用しない",
  "グルテンフリー": "小麦・大麦・ライ麦と通常のパン・麺・パン粉を使用しない。醤油などはグルテンフリーと明記された製品だけを使用する",
  "乳製品不使用": "牛乳・チーズ・ヨーグルト・バター・生クリームなど乳由来の食材を使用しない",
  "卵不使用": "鶏卵・うずら卵・卵加工品を使用しない。マヨネーズは卵不使用と明記された製品だけを使用する",
  "魚介類不使用": "魚・甲殻類・貝・軟体動物と、それらのだし・エキス・魚醤を使用しない",
  "ナッツ不使用": "落花生・ピーナッツ・木の実類と、それらのペースト・粉・油を使用しない",
  "大豆不使用": "大豆・豆腐・納豆・味噌・醤油・豆乳など、大豆由来の食材を使用しない",
};

export type RecipeSafetyContent = {
  title?: string | null;
  genre?: string | null;
  dish_badge?: string | null;
  ingredients?: Array<{ name?: string | null; amount?: string | null }>;
  steps?: string[];
  tips?: string | null;
};

export type DietaryViolation = {
  restriction: string;
  category: string;
  field: string;
  matchedTerm: string;
};

type TextFragment = { field: string; text: string };
type Category = keyof typeof CATEGORY_TERMS;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_TERMS = {
  pork: ["豚肉", "ぶた肉", "ポーク", "pork", "ベーコン", "bacon", "ハム", "ham", "ラード", "lard", "パンチェッタ", "pancetta", "プロシュート", "prosciutto", "チャーシュー", "叉焼", "サラミ", "salami", "豚骨", "とんこつ", "豚ひき肉", "ポークエキス", "pork extract", "pork gelatin"],
  beef: ["牛肉", "ぎゅう肉", "ビーフ", "beef", "veal", "仔牛", "牛ひき肉", "ビーフエキス", "beef extract", "牛脂", "ヘット"],
  poultry: ["鶏肉", "とり肉", "チキン", "chicken", "鶏ひき肉", "鴨肉", "duck", "七面鳥", "turkey", "鶏がら", "チキンブイヨン", "chicken stock", "chicken broth"],
  otherLandMeat: ["羊肉", "ラム肉", "マトン", "lamb", "mutton", "鹿肉", "venison", "馬肉", "rabbit", "兎肉", "肉エキス", "meat extract"],
  fish: ["魚", "鮭", "さけ", "サーモン", "salmon", "まぐろ", "マグロ", "ツナ", "tuna", "かつお", "鰹", "bonito", "さば", "鯖", "mackerel", "いわし", "sardine", "たら", "cod", "鯛", "たい", "ぶり", "うなぎ", "しらす", "煮干し", "いりこ", "かつお節", "鰹節", "アンチョビ", "anchovy", "魚醤", "ナンプラー", "fish sauce", "オイスターソース", "oyster sauce", "魚介だし", "fish stock", "dashi fish"],
  shellfish: ["えび", "海老", "エビ", "shrimp", "prawn", "かに", "蟹", "カニ", "crab", "lobster", "ロブスター", "貝", "あさり", "clam", "牡蠣", "かき", "oyster", "ほたて", "帆立", "scallop", "ムール貝", "mussel", "いか", "烏賊", "イカ", "squid", "たこ", "蛸", "タコ", "octopus"],
  egg: ["卵", "たまご", "玉子", "egg", "うずら卵", "マヨネーズ", "mayonnaise", "mayo"],
  dairy: ["牛乳", "乳製品", "ミルク", "milk", "チーズ", "cheese", "ヨーグルト", "yogurt", "yoghurt", "バター", "butter", "生クリーム", "cream", "ホイップ", "whey", "ホエイ", "カゼイン", "casein", "練乳", "condensed milk"],
  honey: ["はちみつ", "蜂蜜", "honey", "ローヤルゼリー", "royal jelly"],
  animalDerivative: ["ゼラチン", "gelatin", "動物性だし", "動物性スープ", "動物性ブイヨン", "animal stock", "animal broth"],
  alcohol: ["みりん", "料理酒", "日本酒", "清酒", "酒", "ワイン", "wine", "ビール", "beer", "紹興酒", "梅酒", "ラム酒", "rum", "ブランデー", "brandy", "リキュール", "liqueur", "アルコール", "alcohol"],
  gluten: ["小麦", "薄力粉", "中力粉", "強力粉", "全粒粉", "大麦", "押し麦", "もち麦", "ライ麦", "rye", "barley", "wheat", "flour", "パン粉", "食パン", "ロールパン", "パン生地", "うどん", "そうめん", "素麺", "ラーメン", "中華麺", "パスタ", "スパゲッティ", "マカロニ", "クスクス", "couscous", "seitan", "麩", "グルテン", "gluten"],
  glutenConditional: ["醤油", "しょうゆ", "soy sauce", "オートミール", "oatmeal", "オーツ", "oats"],
  nuts: ["落花生", "ピーナッツ", "peanut", "アーモンド", "almond", "くるみ", "胡桃", "walnut", "カシューナッツ", "cashew", "ピスタチオ", "pistachio", "ヘーゼルナッツ", "hazelnut", "マカダミア", "macadamia", "ペカン", "pecan", "松の実", "pine nut", "栗", "chestnut", "ナッツ", "nuts"],
  soy: ["大豆", "soybean", "soy bean", "豆腐", "tofu", "納豆", "natto", "味噌", "みそ", "miso", "醤油", "しょうゆ", "soy sauce", "豆乳", "soy milk", "おから", "きなこ", "きな粉", "油揚げ", "厚揚げ", "枝豆", "edamame", "テンペ", "tempeh"],
} as const;

const RULE_CATEGORIES: Record<string, Category[]> = {
  "ベジタリアン": ["pork", "beef", "poultry", "otherLandMeat", "fish", "shellfish", "animalDerivative"],
  "ヴィーガン": ["pork", "beef", "poultry", "otherLandMeat", "fish", "shellfish", "egg", "dairy", "honey", "animalDerivative"],
  "豚肉不可": ["pork"],
  "牛肉不可": ["beef"],
  "アルコール不可": ["alcohol"],
  "グルテンフリー": ["gluten", "glutenConditional"],
  "乳製品不使用": ["dairy"],
  "卵不使用": ["egg"],
  "魚介類不使用": ["fish", "shellfish"],
  "ナッツ不使用": ["nuts"],
  "大豆不使用": ["soy"],
};

const ENGLISH_WORD = /^[a-z][a-z\s-]*$/;

function containsTerm(text: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (ENGLISH_WORD.test(normalizedTerm)) {
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text);
  }
  return text.includes(normalizedTerm);
}

function removeSafePhrases(text: string, category: Category): string {
  const phrases: Partial<Record<Category, string[]>> = {
    dairy: ["豆乳", "soy milk", "オーツミルク", "oat milk", "アーモンドミルク", "almond milk", "ココナッツミルク", "coconut milk", "植物性ミルク", "plant-based milk", "non-dairy milk", "植物性クリーム", "plant-based cream", "non-dairy cream", "ヴィーガンチーズ", "vegan cheese", "dairy-free cheese", "植物性バター", "vegan butter", "dairy-free butter"],
    egg: ["卵不使用マヨネーズ", "卵なしマヨネーズ", "ヴィーガンマヨネーズ", "egg-free mayonnaise", "egg-free mayo", "vegan mayonnaise", "vegan mayo", "卵不使用", "卵なし", "egg-free"],
    alcohol: ["ノンアルコールビール", "ノンアルコールワイン", "アルコール不使用みりん", "alcohol-free wine", "alcohol-free mirin", "non-alcoholic beer", "non-alcoholic wine"],
    gluten: ["グルテンフリー", "gluten-free", "米粉", "rice flour", "コーンフラワー", "corn flour", "ひよこ豆粉", "chickpea flour", "アーモンド粉", "almond flour", "ココナッツ粉", "coconut flour"],
    glutenConditional: ["グルテンフリー醤油", "グルテンフリーしょうゆ", "gluten-free soy sauce", "小麦不使用醤油", "小麦不使用しょうゆ", "たまり醤油（小麦不使用）", "gluten-free oats", "認証済みグルテンフリーオーツ"],
    nuts: ["ココナッツ", "coconut", "ナツメグ", "nutmeg"],
  };
  let result = text;
  for (const phrase of phrases[category] || []) {
    result = result.split(normalize(phrase)).join(" ");
  }
  return result;
}

function findMatch(text: string, category: Category): string | null {
  const searchable = removeSafePhrases(normalize(text), category);
  for (const term of CATEGORY_TERMS[category]) {
    if (containsTerm(searchable, term)) return term;
  }
  return null;
}

function collectFragments(recipe: RecipeSafetyContent): TextFragment[] {
  const fragments: TextFragment[] = [];
  const add = (field: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) fragments.push({ field, text: value });
  };
  add("title", recipe.title);
  add("genre", recipe.genre);
  add("dish_badge", recipe.dish_badge);
  recipe.ingredients?.forEach((ingredient, index) => {
    add(`ingredients[${index}].name`, ingredient.name);
    add(`ingredients[${index}].amount`, ingredient.amount);
  });
  recipe.steps?.forEach((step, index) => add(`steps[${index}]`, step));
  add("tips", recipe.tips);
  return fragments;
}

function fragmentHasCertification(fragment: TextFragment, kind: "halal" | "kosher"): boolean {
  const text = normalize(fragment.text);
  return kind === "halal"
    ? /はらーる(認証|対応|肉)|halal[- ]?(certified|meat)/i.test(text)
    : /こーしゃ(認証|対応|肉)|kosher[- ]?(certified|meat)/i.test(text);
}

const HALAL_CERTIFICATION_CATEGORIES = ["beef", "poultry", "otherLandMeat", "animalDerivative"] as const;
const KOSHER_CERTIFICATION_CATEGORIES = ["beef", "poultry", "otherLandMeat", "animalDerivative"] as const;

function certifiedCategories(
  fragments: TextFragment[],
  kind: "halal" | "kosher",
  categories: readonly Category[],
): Set<Category> {
  const certified = new Set<Category>();
  for (const fragment of fragments) {
    if (!fragmentHasCertification(fragment, kind)) continue;
    for (const category of categories) {
      if (findMatch(fragment.text, category)) certified.add(category);
    }
  }
  return certified;
}

export function validateDietaryRestrictions(
  recipe: RecipeSafetyContent,
  restrictions: string[],
): DietaryViolation[] {
  const fragments = collectFragments(recipe);
  const violations: DietaryViolation[] = [];
  const pushCategoryMatches = (restriction: string, categories: Category[]) => {
    for (const fragment of fragments) {
      for (const category of categories) {
        const matchedTerm = findMatch(fragment.text, category);
        if (matchedTerm) {
          violations.push({ restriction, category, field: fragment.field, matchedTerm });
          break;
        }
      }
    }
  };

  for (const restriction of restrictions) {
    const categories = RULE_CATEGORIES[restriction];
    if (categories) pushCategoryMatches(restriction, categories);

    if (restriction === "ハラール（イスラム教）") {
      pushCategoryMatches(restriction, ["pork", "alcohol"]);
      const halalCertified = certifiedCategories(fragments, "halal", HALAL_CERTIFICATION_CATEGORIES);
      for (const fragment of fragments) {
        const meatMatch = HALAL_CERTIFICATION_CATEGORIES
          .map((category) => ({ category, term: findMatch(fragment.text, category) }))
          .find((candidate) => candidate.term);
        if (meatMatch?.term && !halalCertified.has(meatMatch.category)) {
          violations.push({ restriction, category: "uncertifiedHalalMeat", field: fragment.field, matchedTerm: meatMatch.term });
        }
      }
    }

    if (restriction === "コーシャ（ユダヤ教）") {
      pushCategoryMatches(restriction, ["pork", "shellfish"]);
      let meatFound = false;
      let dairyFound = false;
      const kosherCertified = certifiedCategories(fragments, "kosher", KOSHER_CERTIFICATION_CATEGORIES);
      for (const fragment of fragments) {
        const meatMatch = KOSHER_CERTIFICATION_CATEGORIES
          .map((category) => ({ category, term: findMatch(fragment.text, category) }))
          .find((candidate) => candidate.term);
        if (meatMatch?.term) {
          meatFound = true;
          if (!kosherCertified.has(meatMatch.category)) {
            violations.push({ restriction, category: "uncertifiedKosherMeat", field: fragment.field, matchedTerm: meatMatch.term });
          }
        }
        if (findMatch(fragment.text, "dairy")) dairyFound = true;
      }
      if (meatFound && dairyFound) {
        violations.push({ restriction, category: "meatAndDairy", field: "recipe", matchedTerm: "meat + dairy" });
      }
    }
  }

  return violations.filter((violation, index, all) =>
    all.findIndex((candidate) =>
      candidate.restriction === violation.restriction &&
      candidate.category === violation.category &&
      candidate.field === violation.field &&
      candidate.matchedTerm === violation.matchedTerm
    ) === index
  );
}

const EXCLUSION_GROUPS: string[][] = [
  ["えび", "海老", "エビ", "shrimp", "prawn"],
  ["かに", "蟹", "カニ", "crab"],
  ["貝", "shellfish", "あさり", "clam", "牡蠣", "oyster", "ほたて", "scallop", "ムール貝", "mussel"],
  ["いか", "烏賊", "イカ", "squid"],
  ["たこ", "蛸", "タコ", "octopus"],
  ["卵", "たまご", "玉子", "egg", "マヨネーズ", "mayonnaise", "mayo"],
  ["牛乳", "乳製品", "milk", "dairy", "チーズ", "cheese", "ヨーグルト", "yogurt", "バター", "butter", "生クリーム", "cream"],
  ["小麦", "wheat", "グルテン", "gluten", "薄力粉", "強力粉", "flour", "パン粉"],
  ["落花生", "ピーナッツ", "peanut"],
  ["ナッツ", "nuts", "アーモンド", "almond", "くるみ", "walnut", "カシューナッツ", "cashew"],
  ["大豆", "soy", "soybean", "豆腐", "tofu", "味噌", "miso", "醤油", "soy sauce", "豆乳", "soy milk"],
  ["ごま", "胡麻", "ゴマ", "sesame", "tahini", "タヒニ"],
  ["魚", "fish", "鮭", "salmon", "まぐろ", "tuna", "さば", "mackerel"],
  ["パクチー", "香菜", "コリアンダー", "cilantro", "coriander"],
];

export type ExcludedIngredientViolation = {
  excluded: string;
  field: string;
  matchedTerm: string;
};

export function validateExcludedIngredients(
  recipe: RecipeSafetyContent,
  excludedIngredients: string[],
): ExcludedIngredientViolation[] {
  const fragments = collectFragments(recipe);
  const violations: ExcludedIngredientViolation[] = [];

  for (const rawExcluded of excludedIngredients) {
    const excluded = rawExcluded.trim();
    if (!excluded) continue;
    const normalizedExcluded = normalize(excluded);
    const group = EXCLUSION_GROUPS.find((aliases) =>
      aliases.some((alias) => {
        const normalizedAlias = normalize(alias);
        return normalizedAlias === normalizedExcluded || normalizedExcluded.includes(normalizedAlias) || normalizedAlias.includes(normalizedExcluded);
      })
    );
    const candidates = group || [excluded];
    for (const fragment of fragments) {
      const normalizedText = normalize(fragment.text);
      const matchedTerm = candidates.find((term) => containsTerm(normalizedText, term));
      if (matchedTerm) {
        violations.push({ excluded, field: fragment.field, matchedTerm });
      }
    }
  }

  return violations.filter((violation, index, all) =>
    all.findIndex((candidate) =>
      candidate.excluded === violation.excluded &&
      candidate.field === violation.field &&
      candidate.matchedTerm === violation.matchedTerm
    ) === index
  );
}

export function buildDietaryConstraintKey(
  dietaryRestrictions: string[] = [],
  excludedIngredients: string[] = [],
  allergies: string[] = [],
): string {
  const canonical = (values: string[]) => [...new Set(values.map(normalize).filter(Boolean))].sort();
  return JSON.stringify({
    dietary: canonical(dietaryRestrictions),
    excluded: canonical(excludedIngredients),
    allergies: canonical(allergies),
  });
}
