// 食材名 → public/ingredients/ 配下のアイコン画像へのマッピング。
// レシピ・在庫・買い物リストに実際に出てくる表記ゆれ（「豚バラ肉」「豚こま切れ肉」等）を
// できるだけ吸収できるよう、キーワードは複数登録している。

const ICON_KEYWORDS: Record<string, string[]> = {
  // --- 野菜 ---
  onion: ["たまねぎ", "玉ねぎ", "玉葱"],
  carrot: ["にんじん", "人参"],
  potato2: ["じゃがいも", "ジャガイモ", "馬鈴薯"],
  tomato: ["トマト", "ミニトマト", "プチトマト"],
  cucumber: ["きゅうり", "キュウリ", "胡瓜"],
  cabbage2: ["キャベツ"],
  daikon: ["だいこん", "大根おろし"],
  daikon2: ["大根"],
  eggplant: ["なす", "ナス", "茄子"],
  greenpepper: ["ピーマン"],
  paprika: ["パプリカ"],
  broccoli: ["ブロッコリー"],
  spinach: ["ほうれんそう", "ほうれん草"],
  corn2: ["とうもろこし", "コーン", "トウモロコシ"],
  negi: ["ねぎ", "長ねぎ", "白ねぎ"],
  naganegi: ["長ねぎ", "白ねぎ", "長葱"],
  aonegi: ["青ねぎ", "小ねぎ", "万能ねぎ", "刻みねぎ"],
  garlic: ["にんにく", "ニンニク", "大蒜", "おろしにんにく"],
  ginger: ["しょうが", "ショウガ", "生姜", "おろし生姜"],
  shiitake: ["しいたけ", "椎茸", "生しいたけ"],
  driedshiitake: ["干ししいたけ", "干し椎茸"],
  enoki2: ["えのき", "えのきたけ", "エノキ"],
  shimeji: ["しめじ"],
  eringi: ["エリンギ"],
  maitake: ["舞茸", "まいたけ"],
  konnyaku: ["こんにゃく", "コンニャク", "蒟蒻"],
  takenoko: ["たけのこ", "筍", "タケノコ"],
  gobo: ["ごぼう", "ゴボウ", "牛蒡"],
  nagaimo: ["長いも", "長芋", "山芋"],
  yamaimo: ["ながいも", "山いも"],
  lotusroot2: ["れんこん", "レンコン", "蓮根"],
  avocado2: ["アボカド"],
  asparagus: ["アスパラガス", "アスパラ"],
  pumpkin: ["かぼちゃ", "カボチャ", "南瓜"],
  okra2: ["オクラ"],
  edamame2: ["えだまめ", "枝豆"],
  beansprout2: ["もやし"],
  shiso: ["しそ", "大葉", "シソ"],
  myoga: ["みょうが", "茗荷"],
  chili: ["とうがらし", "唐辛子", "赤唐辛子", "青唐辛子", "ししとう"],
  bokchoy: ["チンゲンサイ", "チンゲン菜"],
  komatsuna: ["小松菜", "こまつな"],
  mizuna: ["水菜", "みずな"],
  hakusai: ["白菜", "はくさい"],
  zucchini: ["ズッキーニ"],
  kabu: ["かぶ", "カブ", "蕪"],
  satsumaimo: ["さつまいも", "サツマイモ", "薩摩芋"],
  ingen: ["いんげん", "さやいんげん", "インゲン"],
  leafygreen: ["ケール", "春菊", "葉物野菜"],

  // --- きのこ・海藻 ---
  wakame: ["わかめ", "ワカメ"],
  hijiki2: ["ひじき", "ヒジキ"],
  kombu: ["こんぶ", "昆布"],
  nori: ["のり", "海苔", "焼きのり"],

  // --- 肉 ---
  pork: ["ぶたにく", "豚肉", "豚バラ", "豚バラ肉", "豚こま", "豚こま切れ肉", "豚ロース", "豚肩ロース", "豚ひき肉"],
  chicken: ["とりにく", "鶏肉", "鶏もも肉", "鶏むね肉", "鶏胸肉", "鶏ささみ", "鶏ひき肉", "手羽先", "手羽元"],
  beef: ["ぎゅうにく", "牛肉", "牛こま切れ肉", "牛薄切り肉", "牛バラ肉", "ひき肉", "合いびき肉", "牛ひき肉"],
  tsumire: ["つみれ", "肉団子", "つくね"],

  // --- 魚介 ---
  salmon: ["さけ", "鮭", "サーモン"],
  tuna: ["まぐろ", "マグロ", "ツナ"],
  shrimp2: ["えび", "海老", "エビ", "むきえび"],
  squid: ["いか", "イカ"],
  tako: ["タコ", "たこ", "蛸"],
  saba: ["サバ", "さば", "鯖"],
  aji: ["アジ", "あじ", "鯵"],
  iwashi: ["イワシ", "いわし", "鰯"],
  sanma: ["サンマ", "さんま", "秋刀魚"],
  tara: ["タラ", "たら", "鱈"],
  tai: ["鯛", "たい", "タイ"],
  asari: ["あさり", "アサリ"],
  shijimi: ["しじみ", "シジミ"],
  niboshi: ["にぼし", "煮干し"],
  katsuobushi: ["かつお節", "かつおぶし", "鰹節", "削り節"],
  kamaboko: ["かまぼこ", "蒲鉾"],
  chikuwa: ["ちくわ", "竹輪"],
  chikuwa_round: ["ちくわ（輪切り）"],

  // --- 卵・乳製品・大豆製品 ---
  egg: ["たまご", "卵", "玉子"],
  egghalf: ["ゆで卵", "半熟卵"],
  milk: ["牛乳", "ぎゅうにゅう"],
  cream: ["生クリーム"],
  cheese: ["チーズ", "とろけるチーズ", "ピザ用チーズ"],
  yogurt: ["ヨーグルト"],
  butter: ["バター"],
  tofu: ["とうふ", "豆腐"],
  momentofu: ["木綿豆腐"],
  natto: ["なっとう", "納豆"],
  natto2: ["納豆（パック）"],
  aburaage: ["油揚げ", "あぶらあげ"],
  atsuage: ["厚揚げ"],

  // --- 主食・粉物 ---
  rice: ["ごはん", "ご飯", "米", "白米"],
  bread: ["食パン", "パン"],
  udon: ["うどん"],
  soba: ["そば", "蕎麦"],
  pasta: ["パスタ", "スパゲティ"],
  harusame: ["春雨"],
  flour: ["小麦粉", "薄力粉", "強力粉", "片栗粉", "パン粉"],
  sesame: ["ごま", "胡麻", "白ごま", "すりごま"],

  // --- 調味料・油 ---
  salt: ["塩", "しお"],
  sugar: ["砂糖", "さとう"],
  vinegar: ["酢", "お酢"],
  soysauce: ["しょうゆ", "醤油"],
  soysauce2: ["濃口醤油", "薄口醤油"],
  miso: ["みそ", "味噌"],
  mirin: ["みりん", "本みりん"],
  sake: ["おさけ", "料理酒", "酒"],
  mentsuyu: ["めんつゆ"],
  dashinomoto: ["だしの素", "顆粒だし", "和風だし", "コンソメ", "鶏がらスープ"],
  saladaoil: ["サラダ油", "食用油"],
  sesameoil: ["ごま油"],
  oliveoil: ["オリーブオイル"],
  ketchup: ["ケチャップ"],
  mayonnaise: ["マヨネーズ"],
  worcestersauce: ["ウスターソース"],
  chunosauce: ["中濃ソース"],
  ponzu: ["ポン酢", "ぽん酢"],
  honey: ["はちみつ", "蜂蜜"],
};

// 見た目の面積が小さすぎる/表記ゆれで衝突しやすい短いキーワードより、
// 長く具体的なキーワードを優先してマッチさせるための一覧（長い順）。
const FLAT: { keyword: string; slug: string }[] = Object.entries(ICON_KEYWORDS)
  .flatMap(([slug, keywords]) => keywords.map((keyword) => ({ keyword, slug })))
  .sort((a, b) => b.keyword.length - a.keyword.length);

const ICON_BASE_PATH = "/ingredients/";

export function getIngredientIconSlug(ingredientName: string): string | null {
  const name = ingredientName.trim();
  if (!name) return null;
  for (const { keyword, slug } of FLAT) {
    if (name.includes(keyword)) return slug;
  }
  return null;
}

export function getIngredientIconUrl(ingredientName: string): string | null {
  const slug = getIngredientIconSlug(ingredientName);
  return slug ? `${ICON_BASE_PATH}${slug}.png` : null;
}
