/**
 * AI responses are requested as JSON, but models can still wrap the payload in
 * Markdown or leave a trailing comma. Normalise only unambiguous formatting
 * mistakes here; structurally broken output is retried by the API route.
 */
export function parseAiJson<T = Record<string, unknown>>(raw: string): T {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = withoutFence.indexOf("{");
  const arrayStart = withoutFence.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) throw new SyntaxError("AI response did not contain JSON");

  const start = Math.min(...starts);
  const opening = withoutFence[start];
  const closing = opening === "{" ? "}" : "]";
  const end = withoutFence.lastIndexOf(closing);
  if (end < start) throw new SyntaxError("AI response JSON was incomplete");

  const candidate = withoutFence
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(candidate) as T;
}
