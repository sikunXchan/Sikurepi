import { NextResponse } from 'next/server';
import { getShoppingItems, addShoppingItem, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function GET(req: Request) {
  await ensureSchema();
  const userId = getUserIdFromRequest(req);
  const items = await getShoppingItems(userId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const userId = getUserIdFromRequest(req);
    const body = await req.json();

    // 一括追加（配列）または単一追加に対応
    if (Array.isArray(body.items)) {
      const added = [];
      for (const item of body.items) {
        const name = typeof item === 'string' ? item : item.name;
        const category = typeof item === 'object' && item.category ? item.category : 'その他';
        if (name && name.trim()) {
          const res = await addShoppingItem(name.trim(), category, userId);
          if (res) added.push(res);
        }
      }
      return NextResponse.json({ success: true, added });
    }

    const { name, category } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const item = await addShoppingItem(name, category || 'その他', userId);
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
