import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';
import { CATEGORY_ORDER } from '@/lib/storage';

export async function POST(req: Request) {
  let language: 'ja' | 'en' = 'ja';
  try {
    const formData = await req.formData();
    language = formData.get('language') === 'en' ? 'en' : 'ja';
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;

    const allFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];
    if (allFiles.length === 0) {
      return NextResponse.json({
        error: language === 'en' ? 'Please select an image.' : '画像を選択してください。',
      }, { status: 400 });
    }

    const parts: Array<
      { text: string }
      | { inlineData: { data: string; mimeType: string } }
    > = [];
    for (const file of allFiles) {
      const buffer = await file.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');
      parts.push({
        inlineData: { data: base64Image, mimeType: file.type || 'image/jpeg' },
      });
    }

    const prompt = `あなたはプロの食材認識・レシート解析AIです。
提供された画像（レシートの写真、または冷蔵庫・食材の写真）を解析し、含まれている「食材名」と、その食材の「カテゴリ」を抽出してください。
調味料や香辛料、食品以外の品目は除外してください。

【重要：食材名の正規化】レシートの商品名にはメーカー名・ブランド名・商品シリーズ名（例：「〇〇乳業」「××農園」）、「国産」「産直」「有機栽培」などの産地・栽培方法の表示、内容量・個数などの規格表記（例：「1kg」「6個入」）が含まれることがあります。これらはすべて取り除き、食材そのものを指す一般的な名称だけを"name"に出力してください（例：「〇〇乳業 特濃牛乳1000ml」→「牛乳」、「××農園 国産たまねぎ」→「たまねぎ」、「△△ハム 国産豚バラ肉」→「豚バラ肉」）。
食材名は${language === 'en' ? '英語' : '日本語'}で出力してください。カテゴリ名は内部処理に使うため、下記の日本語表記を維持してください。

カテゴリは必ず以下のいずれかから選択してください：
${CATEGORY_ORDER.map((c) => `「${c}」`).join('')}

必ず以下のJSON形式で結果を返してください。それ以外のテキストは一切含めないでください。
{
  "ingredients": [
    { "name": "キャベツ", "category": "野菜・果物" },
    { "name": "豚バラ肉", "category": "肉・魚介" }
  ]
}`;

    parts.unshift({ text: prompt });

    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');

    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (error: unknown) {
    console.error('OCR Error:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: number | string }).status
      : undefined;
    if (status === 429) {
      return NextResponse.json({
        error: language === 'en'
          ? 'The AI is temporarily busy. Please try again in a moment.'
          : 'AIが一時的に混雑しています。しばらく時間をおいてから再度お試しください。',
      }, { status: 429 });
    }
    return NextResponse.json({
      error: language === 'en'
        ? 'Could not analyze the image. Try another photo or enter the items manually.'
        : '画像の解析に失敗しました。もう一度撮影するか、手入力で追加してください。',
    }, { status: 500 });
  }
}
