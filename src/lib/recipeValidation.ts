// AIが生成したレシピJSONを検証する共通ロジック。プロンプトへの指示だけに
// 頼らず、コード側でも機械的に検証することで、
// AIの出力ミス(在庫にない食材を勝手に使う、ヴィーガン指定なのに肉が入っている等)を
// 検出し、採用前に再生成・修正させる。

import { isPantryStaple } from "@/lib/storage";
import { toHiragana } from "@/lib/kana";
import { validateDietaryRestrictions, validateExcludedIngredients } from "@/lib/dietaryRules";

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
  const dietaryViolations = validateDietaryRestrictions(recipe, context.dietaryRestrictions);
  errors.push(...dietaryViolations.map((violation) =>
    `dietary restriction "${violation.restriction}" violated at ${violation.field}: ${violation.matchedTerm}`
  ));

  // (b) 除外食材・アレルギーへの違反チェック
  const excludedViolations = validateExcludedIngredients(recipe, context.excludedIngredients);
  errors.push(...excludedViolations.map((violation) =>
    `excluded ingredient "${violation.excluded}" found at ${violation.field}: ${violation.matchedTerm}`
  ));

  // (c) 在庫モードでは「在庫食材＋許可された常備調味料」以外を1件も許可しない。
  //     在庫外食材をtipsで説明すれば通る旧例外は、ユーザーの明示したモードと
  //     矛盾するため廃止する。
  if (context.mode === "inventory") {
    if (context.inventoryNames.length === 0) {
      errors.push("inventory mode requested without any inventory ingredients");
      return errors;
    }

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

    if (extras.length > 0) {
      errors.push(`non-inventory ingredient(s) used: ${extras.join(", ")}`);
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

// --- 3. 生成前の成立可否判定 -------------------------------------------------
// AIを呼ぶ前に即座に止められる「在庫が空」「調味料しかない」ケースのため、
// 在庫内の実質的な食材数を数える。

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
