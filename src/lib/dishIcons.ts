export const DISH_ICON_BASE_PATH = "/dishes/icons/";

type DishIconRule = {
  slug: string;
  keywords: readonly string[];
};

// 料理名から具体的な見た目を優先して解決する。一般語ほど後ろに置き、
// 「カレーパン→カレー」「魚介パスタ→魚介」のような誤分類を避ける。
const DISH_ICON_RULES: readonly DishIconRule[] = [
  // 文化圏ごとの代表料理は、見た目の近い汎用カテゴリへ落とす前に固有画像を優先する。
  { slug: "ramen", keywords: ["ラーメン", "ramen"] },
  { slug: "pho", keywords: ["フォー", "phở", "pho"] },
  { slug: "udon", keywords: ["うどん", "饂飩", "udon"] },
  { slug: "soba", keywords: ["そば", "蕎麦", "soba"] },
  { slug: "bibimbap", keywords: ["ビビンバ", "ピビンパ", "bibimbap"] },
  { slug: "poke_bowl", keywords: ["ポケボウル", "ポキボウル", "ポキ丼", "poke bowl", "poke"] },
  { slug: "pad_thai", keywords: ["パッタイ", "パッ・タイ", "pad thai"] },
  { slug: "tom_yum", keywords: ["トムヤム", "tom yum"] },
  { slug: "butter_chicken", keywords: ["バターチキン", "ムルグマカニ", "butter chicken", "murgh makhani"] },
  { slug: "masala_dosa", keywords: ["マサラドーサ", "ドーサ", "masala dosa", "dosa"] },
  { slug: "falafel_plate", keywords: ["ファラフェル", "falafel"] },
  { slug: "shawarma", keywords: ["シャワルマ", "シャウルマ", "shawarma"] },
  { slug: "moussaka", keywords: ["ムサカ", "moussaka"] },
  { slug: "shakshuka", keywords: ["シャクシュカ", "shakshuka"] },
  { slug: "ratatouille", keywords: ["ラタトゥイユ", "ratatouille"] },
  { slug: "fish_and_chips", keywords: ["フィッシュアンドチップス", "フィッシュ＆チップス", "fish and chips"] },
  { slug: "ceviche", keywords: ["セビーチェ", "セビチェ", "ceviche"] },
  { slug: "feijoada", keywords: ["フェイジョアーダ", "feijoada"] },
  { slug: "jollof_rice", keywords: ["ジョロフライス", "jollof rice", "jollof"] },
  { slug: "arepa", keywords: ["アレパ", "arepa"] },
  { slug: "pierogi", keywords: ["ピエロギ", "pierogi"] },
  { slug: "borscht", keywords: ["ボルシチ", "borscht", "borsch"] },
  { slug: "injera_platter", keywords: ["インジェラ", "injera"] },
  { slug: "gazpacho", keywords: ["ガスパチョ", "gazpacho"] },
  { slug: "mapo_tofu", keywords: ["麻婆豆腐", "マーボー豆腐", "mapo tofu", "mapo doufu"] },

  { slug: "pilaf_biryani", keywords: ["ビリヤニ", "biryani", "ピラフ", "pilaf"] },
  { slug: "fried_rice", keywords: ["炒飯", "チャーハン", "fried rice", "nasi goreng"] },
  { slug: "rice_porridge", keywords: ["おかゆ", "お粥", "雑炊", "リゾット風おかゆ", "congee", "rice porridge", "juk"] },
  { slug: "risotto", keywords: ["リゾット", "risotto"] },
  { slug: "paella", keywords: ["パエリア", "paella"] },
  { slug: "sushi", keywords: ["寿司", "鮨", "sushi", "nigiri", "maki sushi"] },
  { slug: "rice_ball", keywords: ["おにぎり", "おむすび", "rice ball", "onigiri"] },
  { slug: "stuffed_rice_roll", keywords: ["キンパ", "巻き寿司", "太巻", "rice roll", "gimbap", "kimbap"] },
  { slug: "curry_rice", keywords: ["カレーライス", "カレー", "curry", "カリー"] },
  { slug: "rice_bowl", keywords: ["丼", "どんぶり", "rice bowl", "donburi", "bibimbap", "ビビンバ"] },
  { slug: "mixed_rice", keywords: ["炊き込みご飯", "混ぜご飯", "takikomi", "mixed rice", "jollof"] },
  { slug: "couscous", keywords: ["クスクス", "couscous"] },
  { slug: "plain_rice", keywords: ["白ご飯", "白米", "ごはん", "ご飯", "steamed rice", "plain rice"] },

  { slug: "baked_pasta", keywords: ["ラザニア", "グラタン", "baked pasta", "lasagna", "pasta bake"] },
  { slug: "stuffed_pasta", keywords: ["ラビオリ", "トルテリーニ", "ravioli", "tortellini", "stuffed pasta"] },
  { slug: "gnocchi", keywords: ["ニョッキ", "gnocchi"] },
  { slug: "creamy_pasta", keywords: ["カルボナーラ", "クリームパスタ", "alfredo", "carbonara", "creamy pasta"] },
  { slug: "noodle_stir_fry", keywords: ["焼きそば", "焼うどん", "炒麺", "チャウミン", "pad thai", "chow mein", "stir-fried noodle", "fried noodle"] },
  { slug: "cold_noodles", keywords: ["冷やし中華", "冷麺", "ざるそば", "そうめん", "cold noodle", "naengmyeon"] },
  { slug: "flat_noodles", keywords: ["きしめん", "ほうとう", "フェットチーネ", "タリアテッレ", "flat noodle", "fettuccine", "tagliatelle"] },
  { slug: "noodle_soup", keywords: ["ラーメン", "うどん", "そば", "フォー", "麺スープ", "noodle soup", "ramen", "udon", "pho"] },
  { slug: "pasta", keywords: ["パスタ", "スパゲティ", "スパゲッティ", "pasta", "spaghetti"] },

  { slug: "fried_fish", keywords: ["フィッシュフライ", "魚フライ", "白身魚フライ", "fish and chips", "fried fish"] },
  { slug: "fish_stew", keywords: ["魚の煮付", "煮付け", "魚煮込み", "さば味噌煮", "鯖味噌煮", "あら煮", "ブイヤベース", "fish stew", "fish curry", "cioppino"] },
  { slug: "seafood_platter", keywords: ["シーフード盛", "海鮮盛", "seafood platter", "mixed seafood"] },
  { slug: "shellfish", keywords: ["貝料理", "ムール貝", "あさり", "牡蠣", "shellfish", "mussels", "clams", "oyster"] },
  { slug: "grilled_fish", keywords: ["焼き魚", "魚の塩焼", "塩焼き", "西京焼き", "幽庵焼き", "魚のグリル", "魚のムニエル", "鮭のムニエル", "味噌マヨホイル", "鮭のホイル", "grilled fish", "焼鮭", "焼き鮭", "salmon meuniere"] },
  { slug: "seafood_soup", keywords: ["海鮮スープ", "魚介スープ", "クラムチャウダー", "seafood soup", "clam chowder"] },

  { slug: "fried_chicken", keywords: ["唐揚げ", "から揚げ", "フライドチキン", "チキン南蛮", "fried chicken", "karaage"] },
  { slug: "chicken_skewer", keywords: ["焼き鳥", "チキン串", "鶏串", "chicken skewer", "chicken kebab", "yakitori"] },
  { slug: "roast_chicken", keywords: ["ローストチキン", "丸鶏", "roast chicken", "roasted chicken"] },
  { slug: "grilled_chicken", keywords: ["グリルチキン", "鶏のグリル", "照り焼きチキン", "鶏の照り焼き", "チキンソテー", "grilled chicken", "chicken steak", "teriyaki chicken"] },
  { slug: "meat_cutlet", keywords: ["とんかつ", "トンカツ", "カツレツ", "シュニッツェル", "cutlet", "tonkatsu", "schnitzel"] },
  { slug: "meat_skewer", keywords: ["肉串", "ケバブ", "サテ", "meat skewer", "kebab", "satay"] },
  { slug: "meatballs", keywords: ["ミートボール", "肉団子", "つくね", "meatball", "kofta"] },
  { slug: "sausage_plate", keywords: ["ソーセージ", "ウインナー", "sausage", "bratwurst"] },
  { slug: "roast_meat", keywords: ["ローストビーフ", "ローストポーク", "焼豚", "チャーシュー", "roast beef", "roast pork"] },
  { slug: "steak", keywords: ["ステーキ", "steak"] },
  { slug: "grilled_meat", keywords: ["焼肉", "肉のグリル", "バーベキュー", "grilled meat", "barbecue", "bbq"] },

  { slug: "omelet", keywords: ["オムレツ", "オムライス", "omelet", "omelette"] },
  { slug: "egg_dish", keywords: ["目玉焼き", "卵焼き", "だし巻", "スクランブルエッグ", "fried egg", "scrambled egg", "egg dish"] },
  { slug: "tofu_dish", keywords: ["豆腐料理", "麻婆豆腐", "冷奴", "揚げ出し豆腐", "tofu", "mapo tofu"] },
  { slug: "lentil_dish", keywords: ["レンズ豆", "ダール", "lentil", "dal", "dhal"] },
  { slug: "bean_dish", keywords: ["豆料理", "チリコンカン", "beans", "bean stew", "chili con carne"] },
  { slug: "stuffed_vegetable", keywords: ["肉詰め", "stuffed pepper", "stuffed vegetable", "dolma"] },

  { slug: "tomato_soup", keywords: ["トマトスープ", "ミネストローネ", "tomato soup", "minestrone"] },
  { slug: "cream_soup", keywords: ["クリームスープ", "ポタージュ", "cream soup", "potage", "bisque"] },
  { slug: "spicy_soup", keywords: ["辛いスープ", "酸辣湯", "ユッケジャン", "トムヤム", "spicy soup", "hot and sour soup", "tom yum"] },
  { slug: "bean_soup", keywords: ["豆スープ", "bean soup", "lentil soup"] },
  { slug: "hotpot", keywords: ["鍋料理", "寄せ鍋", "しゃぶしゃぶ", "すき焼き", "火鍋", "hotpot", "hot pot", "shabu-shabu", "sukiyaki"] },
  { slug: "clear_soup", keywords: ["お吸い物", "澄まし汁", "コンソメスープ", "clear soup", "consommé", "consomme"] },
  { slug: "stew", keywords: ["シチュー", "煮込み", "煮物", "肉じゃが", "筑前煮", "stew", "goulash"] },
  { slug: "cheese_fondue", keywords: ["チーズフォンデュ", "cheese fondue", "fondue"] },
  { slug: "casserole", keywords: ["キャセロール", "casserole"] },
  { slug: "baked_dish", keywords: ["オーブン焼き", "ベイク", "baked dish", "oven-baked"] },

  { slug: "pickled_vegetables", keywords: ["漬物", "ピクルス", "キムチ", "pickled vegetable", "pickles", "kimchi"] },
  { slug: "vegetable_skewer", keywords: ["野菜串", "vegetable skewer", "vegetable kebab"] },
  { slug: "roasted_vegetables", keywords: ["ロースト野菜", "焼き野菜", "roasted vegetable", "grilled vegetable"] },
  { slug: "steamed_vegetables", keywords: ["蒸し野菜", "温野菜", "steamed vegetable"] },
  { slug: "vegetable_stir_fry", keywords: ["野菜炒め", "炒め野菜", "キャベツ炒め", "もやし炒め", "きのこ炒め", "vegetable stir-fry", "stir-fried vegetable"] },
  { slug: "salad", keywords: ["サラダ", "salad"] },
  { slug: "dip_spread", keywords: ["フムス", "ディップ", "パテ", "hummus", "dip", "spread"] },

  { slug: "savory_pancake", keywords: ["お好み焼き", "チヂミ", "savory pancake", "okonomiyaki", "jeon"] },
  { slug: "dumplings", keywords: ["餃子", "水餃子", "小籠包", "ワンタン", "dumpling", "gyoza", "wonton"] },
  { slug: "steamed_bun", keywords: ["肉まん", "中華まん", "包子", "steamed bun", "bao"] },
  { slug: "stuffed_pastry", keywords: ["エンパナーダ", "サモサ", "empanada", "samosa", "stuffed pastry"] },
  { slug: "savory_pie", keywords: ["キッシュ", "ミートパイ", "savory pie", "quiche", "pot pie"] },
  { slug: "flatbread", keywords: ["ナン", "ピタ", "フォカッチャ", "flatbread", "naan", "pita", "focaccia"] },
  { slug: "bread_loaf", keywords: ["食パン", "パン一斤", "バゲット", "bread loaf", "loaf", "baguette"] },
  { slug: "pizza", keywords: ["ピザ", "pizza"] },
  { slug: "burger", keywords: ["ハンバーガー", "バーガー", "hamburger", "burger"] },
  { slug: "wrap", keywords: ["ラップサンド", "ブリトー", "トルティーヤラップ", "wrap", "burrito"] },
  { slug: "taco", keywords: ["タコス", "taco"] },
  { slug: "toast", keywords: ["トースト", "ブルスケッタ", "toast", "bruschetta"] },
  { slug: "sandwich", keywords: ["サンドイッチ", "サンド", "sandwich", "panini"] },

  { slug: "whole_cake", keywords: ["ホールケーキ", "バースデーケーキ", "whole cake", "birthday cake"] },
  { slug: "strawberry_cake", keywords: ["いちごケーキ", "苺ケーキ", "ショートケーキ", "strawberry cake"] },
  { slug: "fruit_tart", keywords: ["フルーツタルト", "fruit tart"] },
  { slug: "pie_slice", keywords: ["アップルパイ", "チェリーパイ", "パイ", "pie slice", "apple pie", "cherry pie"] },
  { slug: "pancake", keywords: ["パンケーキ", "ホットケーキ", "pancake", "hotcake"] },
  { slug: "waffle", keywords: ["ワッフル", "waffle"] },
  { slug: "crepe", keywords: ["クレープ", "crepe", "crêpe"] },
  { slug: "donut", keywords: ["ドーナツ", "donut", "doughnut"] },
  { slug: "cupcake", keywords: ["カップケーキ", "マフィン", "cupcake", "muffin"] },
  { slug: "cookie", keywords: ["クッキー", "ビスケット", "cookie", "biscuit"] },
  { slug: "brownie", keywords: ["ブラウニー", "brownie"] },
  { slug: "pudding", keywords: ["プリン", "pudding", "flan"] },
  { slug: "custard", keywords: ["カスタード", "custard"] },
  { slug: "ice_cream", keywords: ["アイスクリーム", "ジェラート", "ice cream", "gelato"] },
  { slug: "popsicle", keywords: ["アイスキャンディ", "棒アイス", "popsicle", "ice pop"] },
  { slug: "shaved_ice", keywords: ["かき氷", "shaved ice", "bingsu"] },
  { slug: "fruit_bowl", keywords: ["フルーツ盛", "フルーツボウル", "fruit bowl", "fruit salad"] },
  { slug: "mochi", keywords: ["餅", "もち", "大福", "mochi", "daifuku"] },
  { slug: "sweet_bun", keywords: ["あんパン", "あんぱん", "菓子パン", "sweet bun", "red bean bun"] },
  { slug: "chocolate_sweets", keywords: ["チョコレート", "ボンボン", "chocolate", "truffle chocolate"] },
  { slug: "parfait", keywords: ["パフェ", "parfait", "sundae"] },
  { slug: "smoothie", keywords: ["スムージー", "シェイク", "smoothie", "milkshake"] },
  { slug: "hot_drink", keywords: ["コーヒー", "紅茶", "ココア", "ホットドリンク", "coffee", "tea", "hot chocolate"] },

  { slug: "fried_food", keywords: ["揚げ物", "フライ", "天ぷら", "コロッケ", "fried", "tempura", "croquette"] },
  { slug: "meat_stir_fry", keywords: ["肉炒め", "豚バラ炒め", "豚肉炒め", "牛肉炒め", "回鍋肉", "青椒肉絲", "生姜焼き", "しょうが焼き", "stir-fried meat", "meat stir-fry"] },
];

function normalizeDishName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase().replace(/[‐‑‒–—―]/g, "-");
}

export function getDishIconSlug(name: string): string | null {
  const normalized = normalizeDishName(name);
  if (!normalized) return null;

  for (const rule of DISH_ICON_RULES) {
    if (rule.keywords.some(keyword => normalized.includes(keyword.toLocaleLowerCase()))) {
      return rule.slug;
    }
  }

  // AIが「豚バラとキャベツの旨辛炒め」のように食材を料理法の間へ挟むと、
  // 完全な語句ルールだけでは既存アイコンを使えない。料理法＋主役カテゴリの
  // 組み合わせで最後の補完を行い、ジャンルの汎用画像へ落ちる件数を減らす。
  if (/(豚|牛|鶏|チキン|ポーク|ビーフ|肉|pork|beef|chicken)/.test(normalized) && /(炒|ソテー|stir.?fry|saute)/.test(normalized)) return "meat_stir_fry";
  if (/(魚|鮭|さけ|サーモン|鯖|さば|鰤|ぶり|鱈|たら|fish|salmon|mackerel|cod)/.test(normalized) && /(焼|グリル|ホイル|ムニエル|grill|bake|meuniere)/.test(normalized)) return "grilled_fish";
  if (/(炒|ソテー|stir.?fry|saute)/.test(normalized)) return "vegetable_stir_fry";
  if (/(汁|スープ|味噌汁|soup|broth)/.test(normalized)) return "clear_soup";
  if (/(煮|煮込|stew|braise)/.test(normalized)) return "stew";
  if (/(焼|オーブン|bake|roast)/.test(normalized)) return "baked_dish";
  return null;
}

export function getDishIconUrl(name: string): string | null {
  const slug = getDishIconSlug(name);
  return slug ? `${DISH_ICON_BASE_PATH}${slug}.png` : null;
}
