import type { CommunityRecipe, CommunityRecipeTranslation } from './communityRecipeSchema';

export type CommunityRecipeSeed = {
  id: string;
  createdAt: string;
  recipe: CommunityRecipe;
};

function bilingualRecipe(
  japanese: Omit<CommunityRecipe, 'translations'>,
  english: CommunityRecipeTranslation,
): CommunityRecipe {
  return { ...japanese, translations: { en: english } };
}

// 初回から「みんなのレシピ」が空にならないよう、分量・加熱目安・味の調整方法を
// 人手で確認した世界の家庭料理を収録する。creator_comment はレシピ紹介文ではなく、
// 実際に作って食べた人の任意の感想として書く。IDはDBへ何度投入しても重複しない固定UUID。
export const COMMUNITY_RECIPE_SEEDS: readonly CommunityRecipeSeed[] = [
  {
    id: '51000000-0000-4000-8000-000000000001',
    createdAt: '2026-09-13T01:08:00.000Z',
    recipe: bilingualRecipe({
      title: '鶏の照り焼きと彩り野菜', time: '25分', genre: '和食', dish_badge: 'フライパンひとつ',
      creator_comment: '実際に作ったら鶏肉がやわらかく、家族にも好評でした。野菜までたれがおいしく絡みました。',
      ingredients: [
        { name: '鶏もも肉', amount: '300g' }, { name: 'パプリカ', amount: '1個' },
        { name: 'ブロッコリー', amount: '120g' }, { name: '醤油', amount: '大さじ1と1/2' },
        { name: 'みりん', amount: '大さじ1と1/2' }, { name: '砂糖', amount: '小さじ1' },
        { name: 'サラダ油', amount: '小さじ1' },
      ],
      steps: [
        '鶏もも肉を一口大、パプリカを2cm角に切り、ブロッコリーは小房に分ける。醤油、みりん、砂糖を混ぜる。',
        'フライパンにサラダ油を中火で熱し、鶏もも肉を皮目から4分、返して3分焼く。',
        'パプリカとブロッコリーを加えて3分炒め、ふたをして弱火で3分蒸し焼きにする。鶏肉の中心温度が75℃に達した状態で1分以上加熱する。',
        '合わせたたれを加え、中火で1〜2分、全体につやが出るまで煮詰める。',
      ],
      tips: 'たれは焦げやすいため最後に加えます。濃く感じる場合は水小さじ2を加えて調整してください。',
      nutrition: { calories: 480, protein_g: 33, fat_g: 16, carbs_g: 50 },
    }, {
      title: 'Teriyaki Chicken with Colorful Vegetables', time: '25 min', genre: '和食', dish_badge: 'One pan',
      creator_comment: 'I made this for dinner and the chicken stayed tender. My family liked the vegetables once they were coated in the sauce, too.',
      ingredients: [
        { name: 'boneless chicken thigh', amount: '300 g' }, { name: 'bell pepper', amount: '1' },
        { name: 'broccoli', amount: '120 g' }, { name: 'soy sauce', amount: '1 1/2 tbsp' },
        { name: 'mirin', amount: '1 1/2 tbsp' }, { name: 'sugar', amount: '1 tsp' },
        { name: 'vegetable oil', amount: '1 tsp' },
      ],
      steps: [
        'Cut the chicken into bite-size pieces, dice the bell pepper, and divide the broccoli into florets. Mix the soy sauce, mirin, and sugar.',
        'Heat the vegetable oil over medium heat. Cook the chicken skin-side down for 4 minutes, turn, and cook for 3 minutes.',
        'Add the bell pepper and broccoli, stir-fry for 3 minutes, then cover and cook over low heat for 3 minutes. Confirm the chicken reaches 75°C at the center for at least 1 minute.',
        'Add the sauce mixture and reduce over medium heat for 1 to 2 minutes until glossy.',
      ],
      tips: 'Add the sauce only at the end to prevent burning. If it tastes too strong, loosen it with 2 teaspoons of water.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000002',
    createdAt: '2026-09-13T01:07:00.000Z',
    recipe: bilingualRecipe({
      title: '白いんげん豆のラタトゥイユ', time: '30分', genre: 'フレンチ', dish_badge: '野菜たっぷり',
      creator_comment: '翌日のランチにも食べました。豆入りでお腹にたまり、パンとよく合いました。',
      ingredients: [
        { name: 'なす', amount: '1本' }, { name: 'ズッキーニ', amount: '1本' },
        { name: 'パプリカ', amount: '1個' }, { name: '玉ねぎ', amount: '1/2個' },
        { name: 'カットトマト缶', amount: '300g' }, { name: '白いんげん豆水煮', amount: '200g' },
        { name: 'にんにく', amount: '1片' }, { name: 'オリーブオイル', amount: '大さじ1' },
        { name: '塩', amount: '小さじ1/3' }, { name: '黒こしょう', amount: '少々' },
      ],
      steps: [
        'なす、ズッキーニ、パプリカ、玉ねぎを2cm角に切り、にんにくはみじん切りにする。',
        '鍋にオリーブオイルとにんにくを入れて弱火で1分熱し、香りが出たら玉ねぎを中火で3分炒める。',
        'なす、ズッキーニ、パプリカを加えて中火で5分炒め、カットトマト缶と白いんげん豆を加える。',
        '弱めの中火で12分煮て、野菜が柔らかくなったら塩と黒こしょうで味を整える。',
      ],
      tips: '水分を飛ばしすぎないのがコツです。酸味が強い場合は砂糖ひとつまみで丸くなります。',
      nutrition: { calories: 410, protein_g: 15, fat_g: 12, carbs_g: 60 },
    }, {
      title: 'White Bean Ratatouille', time: '30 min', genre: 'フレンチ', dish_badge: 'Vegetable-rich',
      creator_comment: 'I had the leftovers for lunch the next day. The beans made it filling, and it was especially good with bread.',
      ingredients: [
        { name: 'eggplant', amount: '1' }, { name: 'zucchini', amount: '1' },
        { name: 'bell pepper', amount: '1' }, { name: 'onion', amount: '1/2' },
        { name: 'canned chopped tomatoes', amount: '300 g' }, { name: 'canned white beans', amount: '200 g' },
        { name: 'garlic', amount: '1 clove' }, { name: 'olive oil', amount: '1 tbsp' },
        { name: 'salt', amount: '1/3 tsp' }, { name: 'black pepper', amount: '1 pinch' },
      ],
      steps: [
        'Cut the eggplant, zucchini, bell pepper, and onion into 2 cm pieces, then mince the garlic.',
        'Warm the olive oil and garlic over low heat for 1 minute. Add the onion and cook over medium heat for 3 minutes.',
        'Add the eggplant, zucchini, and bell pepper and cook for 5 minutes. Stir in the tomatoes and white beans.',
        'Simmer over medium-low heat for 12 minutes until tender, then season with salt and black pepper.',
      ],
      tips: 'Keep a little moisture in the pan. If the tomatoes taste sharp, balance them with a small pinch of sugar.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000003',
    createdAt: '2026-09-13T01:06:00.000Z',
    recipe: bilingualRecipe({
      title: 'トマト香るチャナマサラ', time: '30分', genre: 'インド料理', dish_badge: '植物性たんぱく',
      creator_comment: '家にあるカレー粉で作れました。レモンを最後に入れると重くならず食べやすかったです。',
      ingredients: [
        { name: 'ひよこ豆水煮', amount: '300g' }, { name: '玉ねぎ', amount: '1個' },
        { name: 'カットトマト缶', amount: '300g' }, { name: 'にんにく', amount: '1片' },
        { name: 'しょうが', amount: '1片' }, { name: 'カレー粉', amount: '大さじ1' },
        { name: 'クミン', amount: '小さじ1/2' }, { name: 'サラダ油', amount: '大さじ1' },
        { name: '塩', amount: '小さじ1/3' }, { name: 'レモン汁', amount: '小さじ2' },
      ],
      steps: [
        '玉ねぎ、にんにく、しょうがをみじん切りにし、ひよこ豆は水気を切る。',
        '鍋にサラダ油とクミンを入れて弱火で1分熱し、にんにく、しょうが、玉ねぎを加えて中火で7分炒める。',
        'カレー粉を加えて30秒炒め、カットトマト缶とひよこ豆を加えて弱めの中火で12分煮る。',
        '塩で味を整えて火を止め、レモン汁を加えて混ぜる。',
      ],
      tips: '豆をお玉で少しつぶすと自然なとろみが出ます。辛さは一味唐辛子を少量ずつ加えて調整できます。',
      nutrition: { calories: 520, protein_g: 20, fat_g: 16, carbs_g: 74 },
    }, {
      title: 'Tomato Chana Masala', time: '30 min', genre: 'インド料理', dish_badge: 'Plant protein',
      creator_comment: 'I made it with the curry powder I already had. Adding lemon at the end kept it bright and easy to eat.',
      ingredients: [
        { name: 'canned chickpeas', amount: '300 g' }, { name: 'onion', amount: '1' },
        { name: 'canned chopped tomatoes', amount: '300 g' }, { name: 'garlic', amount: '1 clove' },
        { name: 'ginger', amount: '1 piece' }, { name: 'curry powder', amount: '1 tbsp' },
        { name: 'ground cumin', amount: '1/2 tsp' }, { name: 'vegetable oil', amount: '1 tbsp' },
        { name: 'salt', amount: '1/3 tsp' }, { name: 'lemon juice', amount: '2 tsp' },
      ],
      steps: [
        'Finely chop the onion, garlic, and ginger, then drain the chickpeas.',
        'Warm the vegetable oil and cumin over low heat for 1 minute. Add the garlic, ginger, and onion and cook over medium heat for 7 minutes.',
        'Stir in the curry powder for 30 seconds, add the tomatoes and chickpeas, and simmer over medium-low heat for 12 minutes.',
        'Season with salt, turn off the heat, and stir in the lemon juice.',
      ],
      tips: 'Mash a few chickpeas with a spoon for natural body. Add chili gradually if you want more heat.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000004',
    createdAt: '2026-09-13T01:05:00.000Z',
    recipe: bilingualRecipe({
      title: '彩り野菜と牛肉のビビンバ', time: '30分', genre: '韓国料理', dish_badge: '一皿で満足',
      creator_comment: '野菜が多いのに家族もよく食べてくれました。辛さはコチュジャン半量でちょうどよかったです。',
      ingredients: [
        { name: '温かいご飯', amount: '400g' }, { name: '牛こま切れ肉', amount: '180g' },
        { name: 'にんじん', amount: '1/2本' }, { name: 'ほうれん草', amount: '120g' },
        { name: 'もやし', amount: '150g' }, { name: '卵', amount: '2個' },
        { name: '醤油', amount: '大さじ1' }, { name: 'コチュジャン', amount: '大さじ1' },
        { name: 'ごま油', amount: '小さじ2' }, { name: '酢', amount: '小さじ1' },
      ],
      steps: [
        'にんじんを細切り、ほうれん草を4cm幅に切る。醤油、コチュジャン、酢を混ぜる。',
        'フライパンにごま油半量を中火で熱し、にんじん、もやし、ほうれん草の順に合計6分炒めて取り出す。',
        '残りのごま油で牛こま切れ肉を中火で5分炒め、赤みがなく完全に火が通ったら合わせ調味料を絡める。',
        '別の小鍋で卵を沸騰した湯に入れて9分ゆで、殻をむいて半分に切る。',
        '器に温かいご飯、炒めた野菜、牛肉、ゆで卵を盛る。',
      ],
      tips: '食べる直前に全体をよく混ぜます。辛さを控えたい場合はコチュジャンを半量にしてください。',
      nutrition: { calories: 560, protein_g: 25, fat_g: 18, carbs_g: 75 },
    }, {
      title: 'Colorful Beef Bibimbap', time: '30 min', genre: '韓国料理', dish_badge: 'Complete bowl',
      creator_comment: 'My family ate all the vegetables. Half the gochujang was just the right level of heat for us.',
      ingredients: [
        { name: 'cooked rice', amount: '400 g' }, { name: 'thinly sliced beef', amount: '180 g' },
        { name: 'carrot', amount: '1/2' }, { name: 'spinach', amount: '120 g' },
        { name: 'bean sprouts', amount: '150 g' }, { name: 'eggs', amount: '2' },
        { name: 'soy sauce', amount: '1 tbsp' }, { name: 'gochujang', amount: '1 tbsp' },
        { name: 'sesame oil', amount: '2 tsp' }, { name: 'vinegar', amount: '1 tsp' },
      ],
      steps: [
        'Julienne the carrot and cut the spinach into 4 cm pieces. Mix the soy sauce, gochujang, and vinegar.',
        'Heat half the sesame oil over medium heat. Cook the carrot, bean sprouts, and spinach in sequence for 6 minutes total, then remove.',
        'Cook the beef in the remaining sesame oil over medium heat for 5 minutes until no longer pink and fully cooked, then coat with the sauce.',
        'Boil the eggs in a separate small pan for 9 minutes, peel, and halve them.',
        'Divide the warm rice between bowls and arrange the vegetables, beef, and boiled eggs on top.',
      ],
      tips: 'Mix everything just before eating. Use half the gochujang for a milder bowl.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000005',
    createdAt: '2026-09-13T01:04:00.000Z',
    recipe: bilingualRecipe({
      title: 'ひよこ豆入りシャクシュカ', time: '25分', genre: '中東料理', dish_badge: '朝食にも夕食にも',
      creator_comment: '休日の朝に作りました。ひよこ豆入りで、パンなしでもしっかり満足できました。',
      ingredients: [
        { name: '卵', amount: '4個' }, { name: 'ひよこ豆水煮', amount: '150g' },
        { name: 'カットトマト缶', amount: '300g' }, { name: '玉ねぎ', amount: '1/2個' },
        { name: 'パプリカ', amount: '1個' }, { name: 'にんにく', amount: '1片' },
        { name: 'クミン', amount: '小さじ1/2' }, { name: 'オリーブオイル', amount: '大さじ1' },
        { name: '塩', amount: '小さじ1/3' }, { name: '黒こしょう', amount: '少々' },
      ],
      steps: [
        '玉ねぎ、パプリカを1cm角に切り、にんにくはみじん切りにする。ひよこ豆は水気を切る。',
        'フライパンにオリーブオイル、にんにく、クミンを入れて弱火で1分熱し、玉ねぎとパプリカを中火で5分炒める。',
        'カットトマト缶、ひよこ豆、塩を加え、弱めの中火で7分煮て軽くとろみをつける。',
        '4か所をくぼませて卵を割り入れ、ふたをして弱火で5〜7分、白身が完全に固まるまで加熱する。',
        '黒こしょうを振り、ソースの塩味を確認してから盛り付ける。',
      ],
      tips: '卵の火通りを均一にするため、冷蔵庫から出したてなら加熱時間を1分ほど延ばします。',
      nutrition: { calories: 430, protein_g: 20, fat_g: 18, carbs_g: 47 },
    }, {
      title: 'Chickpea Shakshuka', time: '25 min', genre: '中東料理', dish_badge: 'Breakfast or dinner',
      creator_comment: 'I cooked this for a weekend breakfast. The chickpeas made it satisfying even without bread.',
      ingredients: [
        { name: 'eggs', amount: '4' }, { name: 'canned chickpeas', amount: '150 g' },
        { name: 'canned chopped tomatoes', amount: '300 g' }, { name: 'onion', amount: '1/2' },
        { name: 'bell pepper', amount: '1' }, { name: 'garlic', amount: '1 clove' },
        { name: 'ground cumin', amount: '1/2 tsp' }, { name: 'olive oil', amount: '1 tbsp' },
        { name: 'salt', amount: '1/3 tsp' }, { name: 'black pepper', amount: '1 pinch' },
      ],
      steps: [
        'Dice the onion and bell pepper, mince the garlic, and drain the chickpeas.',
        'Warm the olive oil, garlic, and cumin over low heat for 1 minute. Add the onion and pepper and cook over medium heat for 5 minutes.',
        'Add the tomatoes, chickpeas, and salt. Simmer over medium-low heat for 7 minutes until slightly thickened.',
        'Make four wells, crack in the eggs, cover, and cook over low heat for 5 to 7 minutes until the whites are completely set.',
        'Finish with black pepper and taste the sauce before serving.',
      ],
      tips: 'If the eggs are refrigerator-cold, allow about 1 extra minute so they cook evenly.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000006',
    createdAt: '2026-09-13T01:03:00.000Z',
    recipe: bilingualRecipe({
      title: '香ばし豆腐のパッタイ', time: '25分', genre: 'タイ料理', dish_badge: '肉なしでも満足',
      creator_comment: null,
      ingredients: [
        { name: '米麺', amount: '180g' }, { name: '木綿豆腐', amount: '200g' },
        { name: 'もやし', amount: '150g' }, { name: 'にら', amount: '50g' },
        { name: '卵', amount: '2個' }, { name: 'ピーナッツ', amount: '20g' },
        { name: '醤油', amount: '大さじ1' }, { name: '酢', amount: '大さじ1' },
        { name: '砂糖', amount: '小さじ2' }, { name: 'サラダ油', amount: '大さじ1' },
      ],
      steps: [
        '米麺を表示どおり戻して水気を切る。木綿豆腐は2cm角、にらは4cm幅に切り、ピーナッツは粗く砕く。醤油、酢、砂糖を混ぜる。',
        'フライパンにサラダ油半量を中火で熱し、木綿豆腐を各面2分ずつ焼いて取り出す。',
        '残りのサラダ油を加え、卵を割り入れて中火で2分、完全に固まるまで炒める。',
        '米麺、もやし、にら、豆腐、合わせ調味料を加え、強めの中火で3分炒める。',
        '器に盛り、砕いたピーナッツをかける。',
      ],
      tips: '麺がくっつく場合は水大さじ1を鍋肌から加えます。酢を少量追加すると味が締まります。',
      nutrition: { calories: 560, protein_g: 24, fat_g: 18, carbs_g: 75 },
    }, {
      title: 'Toasted Tofu Pad Thai', time: '25 min', genre: 'タイ料理', dish_badge: 'Satisfying meat-free meal',
      creator_comment: null,
      ingredients: [
        { name: 'rice noodles', amount: '180 g' }, { name: 'firm tofu', amount: '200 g' },
        { name: 'bean sprouts', amount: '150 g' }, { name: 'garlic chives', amount: '50 g' },
        { name: 'eggs', amount: '2' }, { name: 'peanuts', amount: '20 g' },
        { name: 'soy sauce', amount: '1 tbsp' }, { name: 'vinegar', amount: '1 tbsp' },
        { name: 'sugar', amount: '2 tsp' }, { name: 'vegetable oil', amount: '1 tbsp' },
      ],
      steps: [
        'Soak the rice noodles according to the package and drain. Cube the tofu, cut the chives into 4 cm pieces, crush the peanuts, and mix the soy sauce, vinegar, and sugar.',
        'Heat half the vegetable oil over medium heat. Brown the tofu for 2 minutes per side, then remove it.',
        'Add the remaining oil and eggs. Stir over medium heat for 2 minutes until the eggs are completely set.',
        'Add the noodles, bean sprouts, chives, tofu, and sauce, then stir-fry over medium-high heat for 3 minutes.',
        'Divide between plates and finish with the crushed peanuts.',
      ],
      tips: 'If the noodles stick, add 1 tablespoon of water around the edge of the pan. A little extra vinegar brightens the flavor.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000007',
    createdAt: '2026-09-13T01:02:00.000Z',
    recipe: bilingualRecipe({
      title: '鶏肉とトマトのジョロフライス', time: '45分', genre: 'その他', dish_badge: '鍋ひとつ',
      creator_comment: '初めてジョロフライスを作りました。トマト味のご飯と鶏肉がよく合い、また作りたいです。',
      ingredients: [
        { name: '米', amount: '300g' }, { name: '鶏もも肉', amount: '250g' },
        { name: 'カットトマト缶', amount: '250g' }, { name: '玉ねぎ', amount: '1個' },
        { name: 'パプリカ', amount: '1個' }, { name: 'にんにく', amount: '1片' },
        { name: 'カレー粉', amount: '小さじ1' }, { name: 'コンソメ', amount: '小さじ1' },
        { name: '水', amount: '250ml' }, { name: 'サラダ油', amount: '大さじ1' },
        { name: '塩', amount: '小さじ1/3' },
      ],
      steps: [
        '米を洗って水気を切る。鶏もも肉は一口大、玉ねぎ、パプリカ、にんにくはみじん切りにする。',
        '厚手の鍋にサラダ油を中火で熱し、鶏もも肉を5分焼く。表面の色が変わったら一度取り出す。',
        '同じ鍋で玉ねぎ、パプリカ、にんにくを中火で5分炒め、カレー粉を加えて30秒炒める。',
        'カットトマト缶、水、コンソメ、塩、米、鶏肉を加える。沸騰したらふたをして弱火で18分炊く。',
        '火を止めて10分蒸らす。鶏肉の中心温度が75℃に達し、肉汁が透明なことを確認して全体をほぐす。',
      ],
      tips: '炊いている間はふたを開けません。底が焦げやすい鍋では最弱火にしてください。',
      nutrition: { calories: 610, protein_g: 35, fat_g: 18, carbs_g: 77 },
    }, {
      title: 'Chicken and Tomato Jollof Rice', time: '45 min', genre: 'その他', dish_badge: 'One pot',
      creator_comment: 'This was my first time making jollof rice. The tomato rice went so well with the chicken that I want to make it again.',
      ingredients: [
        { name: 'rice', amount: '300 g' }, { name: 'boneless chicken thigh', amount: '250 g' },
        { name: 'canned chopped tomatoes', amount: '250 g' }, { name: 'onion', amount: '1' },
        { name: 'bell pepper', amount: '1' }, { name: 'garlic', amount: '1 clove' },
        { name: 'curry powder', amount: '1 tsp' }, { name: 'stock powder', amount: '1 tsp' },
        { name: 'water', amount: '250 ml' }, { name: 'vegetable oil', amount: '1 tbsp' },
        { name: 'salt', amount: '1/3 tsp' },
      ],
      steps: [
        'Rinse and drain the rice. Cut the chicken into bite-size pieces and finely chop the onion, bell pepper, and garlic.',
        'Heat the vegetable oil in a heavy pot over medium heat and brown the chicken for 5 minutes, then remove it.',
        'Cook the onion, bell pepper, and garlic in the same pot over medium heat for 5 minutes. Add the curry powder and cook for 30 seconds.',
        'Add the tomatoes, water, stock powder, salt, rice, and chicken. Bring to a boil, cover, and cook over low heat for 18 minutes.',
        'Turn off the heat and rest for 10 minutes. Confirm the chicken reaches 75°C at the center and the juices run clear, then fluff the rice.',
      ],
      tips: 'Do not lift the lid while the rice cooks. Use the lowest heat if your pot tends to scorch.',
    }),
  },
  {
    id: '51000000-0000-4000-8000-000000000008',
    createdAt: '2026-09-13T01:01:00.000Z',
    recipe: bilingualRecipe({
      title: '鮭のレモン味噌焼き', time: '25分', genre: '和食', dish_badge: '洗い物少なめ',
      creator_comment: null,
      ingredients: [
        { name: '生鮭', amount: '2切れ（240g）' }, { name: 'キャベツ', amount: '200g' },
        { name: 'しめじ', amount: '100g' }, { name: '味噌', amount: '大さじ1' },
        { name: 'みりん', amount: '大さじ1' }, { name: 'レモン汁', amount: '小さじ2' },
        { name: 'バター', amount: '10g' }, { name: '黒こしょう', amount: '少々' },
      ],
      steps: [
        'キャベツを3cm角に切り、しめじは石づきを落としてほぐす。味噌、みりん、レモン汁を混ぜる。',
        'フライパンにキャベツとしめじを広げ、その上に生鮭を置いて合わせ調味料を塗る。',
        'バターをのせてふたをし、中火で3分、弱火で10分蒸し焼きにする。鮭の中心まで火が通り、身がほぐれることを確認する。',
        'ふたを外して中火で1分水分を飛ばし、黒こしょうを振る。',
      ],
      tips: '味噌の塩分によって濃さが変わります。濃い味噌なら水小さじ2をたれに混ぜてください。',
      nutrition: { calories: 500, protein_g: 34, fat_g: 20, carbs_g: 46 },
    }, {
      title: 'Miso Lemon Salmon', time: '25 min', genre: '和食', dish_badge: 'Easy cleanup',
      creator_comment: null,
      ingredients: [
        { name: 'salmon fillets', amount: '2 (240 g)' }, { name: 'cabbage', amount: '200 g' },
        { name: 'shimeji mushrooms', amount: '100 g' }, { name: 'miso', amount: '1 tbsp' },
        { name: 'mirin', amount: '1 tbsp' }, { name: 'lemon juice', amount: '2 tsp' },
        { name: 'butter', amount: '10 g' }, { name: 'black pepper', amount: '1 pinch' },
      ],
      steps: [
        'Cut the cabbage into 3 cm pieces and separate the mushrooms. Mix the miso, mirin, and lemon juice.',
        'Spread the cabbage and mushrooms in a frying pan, place the salmon on top, and coat it with the miso mixture.',
        'Top with butter, cover, and cook for 3 minutes over medium heat and 10 minutes over low heat. Confirm the salmon is cooked through and flakes easily at the center.',
        'Remove the lid, cook over medium heat for 1 minute to reduce excess liquid, and finish with black pepper.',
      ],
      tips: 'Miso brands vary in saltiness. Mix 2 teaspoons of water into a strong miso sauce.',
    }),
  },
] as const;

export function getCommunityRecipeSeed(id: string): CommunityRecipeSeed | null {
  return COMMUNITY_RECIPE_SEEDS.find((seed) => seed.id === id) || null;
}
