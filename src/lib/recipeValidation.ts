// AIが生成したレシピJSONを「レシピ生成前の成立可否判定」(在庫・カテゴリ・食事制限等の
// 事前チェック)と「生成後の検証」(構造検証+料理としての論理検証)の両方に使う
// 共通ロジック。プロンプトへの指示だけに頼らず、コード側でも機械的に検証することで、
// AIの出力ミス(在庫にない食材を勝手に使う、ヴィーガン指定なのに肉が入っている等)を
// 検出し、採用前に再生成・修正させる。

import { isPantryStaple } from "@/lib/storage";
import { toHiragana } from "@/lib/kana";

export type ValidatedIngredient = { name: string; amount: string };

export type ValidatedRecipe = {
  title: string;
  time: string;
  genre?: string | null;
  climate_badge?: string | null;
  dish_badge?: string | null;
  course?: string | null;
  ingredients: ValidatedIngredient[];
  steps: string[];
  tips: string;
  nutrition?: { calories: number; protein_g: number; fat_g: number; carbs_g: number } | null;
};

// --- 1. JSON Schema相当の構造検証 -------------------------------------------
// 外部ライブラリ(ajv等)を追加せず、既存コードの手書きバリデーションのスタイルに
// 合わせて必要なフィールド・型を検証する。「JSONとしてパースできる」だけでは
// 不十分で、アプリが期待する構造(必須フィールド・型)を満たすかをここで保証する。

export function validateRecipeShape(value: unknown, pathPrefix = "recipe"): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [`${pathPrefix} is not an object`];
  }
  const r = value as Record<string, unknown>;

  if (typeof r.title !== "string" || !r.title.trim()) {
    errors.push(`${pathPrefix}.title must be a non-empty string`);
  }
  if (typeof r.time !== "string" || !r.time.trim()) {
    errors.push(`${pathPrefix}.time must be a non-empty string`);
  }
  if (typeof r.tips !== "string") {
    errors.push(`${pathPrefix}.tips must be a string`);
  }

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    errors.push(`${pathPrefix}.ingredients must be a non-empty array`);
  } else {
    r.ingredients.forEach((ing, i) => {
      if (typeof ing !== "object" || ing === null) {
        errors.push(`${pathPrefix}.ingredients[${i}] is not an object`);
        return;
      }
      const ii = ing as Record<string, unknown>;
      if (typeof ii.name !== "string" || !ii.name.trim()) {
        errors.push(`${pathPrefix}.ingredients[${i}].name must be a non-empty string`);
      }
      if (typeof ii.amount !== "string" || !ii.amount.trim()) {
        errors.push(`${pathPrefix}.ingredients[${i}].amount must be a non-empty string`);
      }
    });
  }

  if (
    !Array.isArray(r.steps) ||
    r.steps.length === 0 ||
    r.steps.some((s) => typeof s !== "string" || !s.trim())
  ) {
    errors.push(`${pathPrefix}.steps must be a non-empty array of non-empty strings`);
  }

  if (r.nutrition !== undefined && r.nutrition !== null) {
    if (typeof r.nutrition !== "object" || Array.isArray(r.nutrition)) {
      errors.push(`${pathPrefix}.nutrition must be an object or null`);
    } else {
      const n = r.nutrition as Record<string, unknown>;
      (["calories", "protein_g", "fat_g", "carbs_g"] as const).forEach((key) => {
        if (typeof n[key] !== "number" || !Number.isFinite(n[key])) {
          errors.push(`${pathPrefix}.nutrition.${key} must be a finite number`);
        }
      });
    }
  }

  return errors;
}

// --- 2. 料理としての論理検証 --------------------------------------------------

// カタカナをひらがなに正規化してから比較する(「エビ」除外指定 vs 「えび」と
// AIが表記したケースのような、かな表記ゆれでアレルギー等の除外チェックが
// すり抜けないようにするため)
const normalize = (s: string) => toHiragana(s.trim().toLowerCase());

// storage.tsのisIngredientMissingと同じ「部分一致で表記ゆれを許容する」判定を、
// ここでも(在庫食材との照合に)使う
function fuzzyIncludes(haystack: string[], needle: string): boolean {
  const target = normalize(needle);
  if (!target) return true;
  return haystack.some((h) => {
    const hn = normalize(h);
    return hn.includes(target) || target.includes(hn);
  });
}

// AIプロンプト側のDIETARY_RESTRICTION_INSTRUCTIONS(ai.ts)と対応する、
// 各食事制限で使ってはならない食材の検出用パターン。プロンプトの指示文と
// 意味がずれないよう、両方を変更する際は必ず一緒に見直すこと。
export const DIETARY_FORBIDDEN_PATTERNS: Record<string, RegExp> = {
  "ベジタリアン":
    /肉|豚|牛(?!乳)|鶏|ラム|羊肉|マトン|ベーコン|ハム|ソーセージ|ウインナー|ひき肉|挽肉|鴨|ダック|七面鳥|ターキー|魚|鮭|サーモン|マグロ|ツナ|エビ|海老|イカ|タコ|貝|あさり|かに|カニ|ほたて|かつお|鰹|しらす|たらこ|明太子|いくら|うなぎ|かまぼこ|ちくわ|さつま揚げ|はんぺん/,
  "ヴィーガン":
    /肉|豚|牛(?!乳)|鶏|ラム|羊肉|マトン|ベーコン|ハム|ソーセージ|ウインナー|ひき肉|挽肉|鴨|ダック|七面鳥|ターキー|魚|鮭|サーモン|マグロ|ツナ|エビ|海老|イカ|タコ|貝|あさり|かに|カニ|ほたて|かつお|鰹|しらす|たらこ|明太子|いくら|うなぎ|かまぼこ|ちくわ|さつま揚げ|はんぺん|卵|たまご|玉子|牛乳|チーズ|ヨーグルト|バター|生クリーム|はちみつ|蜂蜜/,
  "ハラール（イスラム教）": /豚|ベーコン|ハム|ソーセージ(?!パン)|ラード|みりん|料理酒|日本酒|清酒|ワイン|ビール/,
  "コーシャ（ユダヤ教）": /豚|えび|海老|かに|カニ|貝|あさり|いか|タコ|たこ/,
  "豚肉不可": /豚/,
  "牛肉不可": /牛(?!乳)/,
  "アルコール不可": /みりん|料理酒|日本酒|清酒|ワイン|ビール|紹興酒|梅酒/,
};

// 「スイーツ」「鍋・スープ」のように、料理カテゴリそのものを絶対条件として
// 指定するテンプレート専用のチェック。他のテンプレート(お弁当・ガッツリ肉・
// ヘルシー・洗い物ラク)は「属性」であって「カテゴリ」ではないため対象外にする。
export const TEMPLATE_CATEGORY_CHECKS: Record<
  string,
  { mustMatch: RegExp; label: string }
> = {
  sweets: {
    label: "スイーツ",
    mustMatch:
      /スイーツ|デザート|ケーキ|プリン|ゼリー|クッキー|タルト|パイ|アイス|パフェ|ようかん|羊羹|団子|だんご|わらび餅|大福|どら焼き|マフィン|ドーナツ|ワッフル|ババロア|ムース|チョコ|クレープ|パンケーキ|ホットケーキ|フルーツポンチ|あんみつ|白玉|ぜんざい|甘/,
  },
  soup: {
    label: "鍋・スープ",
    mustMatch: /鍋|スープ|汁|ポトフ|シチュー|おでん|だし|出汁|ブロス|チャウダー|味噌汁/,
  },
};

export type FeasibilityContext = {
  mode: "inventory" | "free";
  inventoryNames: string[];
  assumeSeasoningsAvailable: boolean;
  dietaryRestrictions: string[];
  excludedIngredients: string[];
  templateKey?: string | null;
};

// レシピ本文(タイトル・材料名・作り方・コツ)を1本の文字列にまとめ、
// テンプレートのカテゴリ適合チェックなど「本文全体から該当語を探したい」
// 検証で使う
function recipeText(recipe: ValidatedRecipe): string {
  return [
    recipe.title,
    recipe.genre || "",
    recipe.dish_badge || "",
    ...recipe.ingredients.map((i) => i.name),
    ...recipe.steps,
    recipe.tips,
  ].join(" ");
}

export function validateRecipeLogic(
  recipe: ValidatedRecipe,
  context: FeasibilityContext
): string[] {
  const errors: string[] = [];
  const ingredientNames = recipe.ingredients.map((i) => i.name);

  // (a) 食事制限・宗教上の配慮への違反チェック
  for (const restriction of context.dietaryRestrictions) {
    const pattern = DIETARY_FORBIDDEN_PATTERNS[restriction];
    if (!pattern) continue;
    const violating = ingredientNames.filter((name) => pattern.test(name));
    if (violating.length > 0) {
      errors.push(
        `dietary restriction "${restriction}" violated by ingredient(s): ${violating.join(", ")}`
      );
    }
  }

  // (b) 除外食材・アレルギーへの違反チェック
  for (const excluded of context.excludedIngredients) {
    const trimmed = excluded.trim();
    if (!trimmed) continue;
    const violating = ingredientNames.filter((name) => fuzzyIncludes([name], trimmed));
    if (violating.length > 0) {
      errors.push(`excluded ingredient "${trimmed}" found in: ${violating.join(", ")}`);
    }
  }

  // (c) 在庫モードでは「在庫食材＋常備調味料」以外を使っていないかチェック。
  //     プロンプト自体が「ごく少量の例外的な追加も許容(tipsに理由を明記)」を
  //     許しているため、それと同じ基準で判定する:
  //     例外0件=OK / 例外1件かつtipsに言及あり=OK(警告のみ) / それ以外=NG
  if (context.mode === "inventory" && context.inventoryNames.length > 0) {
    const extras = ingredientNames.filter((name) => {
      if (fuzzyIncludes(context.inventoryNames, name)) return false;
      if (context.assumeSeasoningsAvailable && isPantryStaple(name)) return false;
      if (!context.assumeSeasoningsAvailable) {
        // 調味料を常備前提にしない設定でも、ごく基本的な塩・こしょうだけは
        // プロンプト側が例外的に許可しているのでそれに合わせる
        if (/^(塩|しお|こしょう|コショウ|胡椒)$/.test(name.trim())) return false;
      }
      return true;
    });

    if (extras.length >= 2) {
      errors.push(`too many non-inventory ingredients used: ${extras.join(", ")}`);
    } else if (extras.length === 1) {
      const explained = recipe.tips && extras.some((e) => recipe.tips.includes(e));
      if (!explained) {
        errors.push(
          `non-inventory ingredient "${extras[0]}" used without an explanation in tips`
        );
      }
      // 説明ありの場合は許容範囲(プロンプトの例外規定どおり)。ハードエラーにはしない。
    }
  }

  // (d) テンプレートのカテゴリ絶対条件(スイーツ/鍋・スープ)への適合チェック
  if (context.templateKey) {
    const check = TEMPLATE_CATEGORY_CHECKS[context.templateKey];
    if (check && !check.mustMatch.test(recipeText(recipe))) {
      errors.push(
        `template category "${check.label}" was requested, but the recipe does not appear to match it`
      );
    }
  }

  return errors;
}

export function buildValidationRetryNote(errors: string[]): string {
  return `\n【重要：前回の生成結果は以下の理由で不採用になりました。今回は必ず修正してください】\n${errors
    .map((e) => `・${e}`)
    .join("\n")}\n`;
}

// --- 3. 生成前の成立可否判定(フィード情報の整形) ------------------------------
// 実際の判定(AIへの問い合わせ)は呼び出し側のAPI Routeで行うが、判定AIに渡す
// 「在庫の要約」「常備調味料込みの実質的な食材数」等、判定材料の下ごしらえを
// ここに集約しておく。

export function summarizeInventoryForFeasibility(
  inventoryNames: string[],
  assumeSeasoningsAvailable: boolean
): { nonStapleCount: number; stapleCount: number } {
  let nonStapleCount = 0;
  let stapleCount = 0;
  for (const name of inventoryNames) {
    if (assumeSeasoningsAvailable && isPantryStaple(name)) {
      stapleCount++;
    } else {
      nonStapleCount++;
    }
  }
  return { nonStapleCount, stapleCount };
}
