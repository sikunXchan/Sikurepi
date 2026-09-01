import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const DEFAULT_AI_MODELS = ['models/gemini-2.5-flash', 'models/gemini-3.5-flash'];

export async function generateWithRetry(
  aiInstance: any,
  config: any,
  models: string[] = DEFAULT_AI_MODELS,
  maxRetries = 3
): Promise<any> {
  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await aiInstance.models.generateContent({ ...config, model });
        return response;
      } catch (err: any) {
        const status = err?.status ?? err?.httpStatusCode;
        const code = err?.code;
        const retryable = status === 503 || status === 429 || code === 'UNAVAILABLE' || code === 'RESOURCE_EXHAUSTED';
        if (retryable) {
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(Model  attempt  failed (), retrying in ms...);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.warn(All retries exhausted for model , trying next model...);
          }
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error('すべてのAIモデルが一時的に利用不可です。しばらく時間をおいてお試しください。');
}
