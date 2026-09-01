import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;

    const allFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];
    if (allFiles.length === 0) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    const parts: any[] = [];
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

カテゴリは必ず以下のいずれかから選択してください：
「野菜」「肉」「魚介類」「乳製品・卵」「穀物・パン」「豆類」「果物」「調味料」「その他」

必ず以下のJSON形式で結果を返してください。それ以外のテキストは一切含めないでください。
{
  "ingredients": [
    { "name": "キャベツ", "category": "野菜" },
    { "name": "豚バラ肉", "category": "肉" }
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
  } catch (error: any) {
    console.error('OCR Error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'しばらく時間をおいてから再度お試しください' }, { status: 429 });
    }
    return NextResponse.json({ error: '画像の解析に失敗しました。もう一度撮影するか、手動で追加してください' }, { status: 500 });
  }
}
