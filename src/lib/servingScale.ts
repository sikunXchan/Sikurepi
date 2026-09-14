const QUALITATIVE_AMOUNT = /(?:適量|少々|ひとつまみ|お好み|適宜|to taste|as needed|a pinch)/i;

function formatScaledNumber(value: number, japanese: boolean): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.01) return String(Math.round(rounded));
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const commonFractions: Array<[number, string]> = [
    [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4'],
  ];
  const match = commonFractions.find(([decimal]) => Math.abs(fraction - decimal) < 0.03);
  if (match) return whole === 0 ? match[1] : `${whole}${japanese ? 'と' : ' '}${match[1]}`;
  return String(rounded);
}

/** 数値部分だけを換算し、「少々」「適量」など味見で決める量は変更しない。 */
export function scaleIngredientAmount(amount: string, baseServings: number, targetServings: number): string {
  const source = String(amount || '');
  const base = recipeServings(baseServings);
  const target = recipeServings(targetServings, base);
  if (!source || base === target || QUALITATIVE_AMOUNT.test(source)) return source;
  const ratio = target / base;
  const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(source);
  return source.replace(
    /(\d+(?:\.\d+)?)\s*(?:と|\s)\s*(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)/g,
    (match, mixedWhole, mixedNumerator, mixedDenominator, numerator, denominator, decimal) => {
      let value: number;
      if (mixedWhole !== undefined) {
        const divisor = Number(mixedDenominator);
        if (!divisor) return match;
        value = Number(mixedWhole) + Number(mixedNumerator) / divisor;
      } else if (numerator !== undefined) {
        const divisor = Number(denominator);
        if (!divisor) return match;
        value = Number(numerator) / divisor;
      } else value = Number(decimal);
      return Number.isFinite(value) ? formatScaledNumber(value * ratio, japanese) : match;
    },
  );
}

export function recipeServings(value: unknown, fallback = 2): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(15, parsed)) : fallback;
}
