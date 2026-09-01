import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const IMAGE_MODELS = ['models/gemini-2.5-flash-image', 'models/gemini-3.1-flash-image-preview'];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, step, ingredients } = body as {
      title?: string;
      step?: string;
      ingredients?: string[];
    };

    if (!step || typeof step !== 'string') {
      return NextResponse.json({ error: 'step is required' }, { status: 400 });
    }

    const ingredientsNote = ingredients && ingredients.length > 0
      ? `\n主な材料: ${ingredients.join('、')}`
      : '';

    const prompt = `プロの料理写真として、以下の調理工程を1枚の画像で表現してください。
料理名: ${title || '家庭料理'}${ingredientsNote}
この工程の内容: ${step}

要件:
- 実際のキッチンで撮影したような、自然光の写実的な料理写真
- 文字・テキスト・ロゴ・透かしは一切含めない
- 手や調理器具越しの、調理途中の様子が伝わる構図
- 清潔感があり、おいしそうに見える色合い`;

    let lastError: unknown = null;
    for (const model of IMAGE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseModalities: ['IMAGE'] },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData?.data);

        if (imagePart?.inlineData?.data) {
          const mimeType = imagePart.inlineData.mimeType || 'image/png';
          return NextResponse.json({ image: `data:${mimeType};base64,${imagePart.inlineData.data}` });
        }
        lastError = new Error(`No image returned by ${model}`);
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { status?: number; httpStatusCode?: number })?.status
          ?? (err as { httpStatusCode?: number })?.httpStatusCode;
        if (status !== 503 && status !== 429) throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('画像生成に失敗しました');
  } catch (error: unknown) {
    console.error('Step Image Gen Error:', error);
    const status = (error as { status?: number })?.status;
    if (status === 429 || status === 503) {
      return NextResponse.json({ error: 'AIモデルが混雑しています。しばらくしてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: '画像の生成に失敗しました' }, { status: 500 });
  }
}
