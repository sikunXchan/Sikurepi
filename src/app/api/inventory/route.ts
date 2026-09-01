import { NextResponse } from 'next/server';
import { getIngredients, addIngredient, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function GET(req: Request) {
  await ensureSchema();
  const userId = getUserIdFromRequest(req);
  const ingredients = await getIngredients(userId);
  return NextResponse.json(ingredients);
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const userId = getUserIdFromRequest(req);
    const body = await req.json();
    const { name, category } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const ingredient = await addIngredient(name, category || 'その他', userId);
    if (!ingredient) {
      return NextResponse.json({ error: 'Failed to add ingredient' }, { status: 500 });
    }
    return NextResponse.json(ingredient);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
