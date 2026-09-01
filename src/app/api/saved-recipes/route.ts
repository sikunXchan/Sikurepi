import { NextResponse } from 'next/server';
import { getSavedRecipes, saveRecipe, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function GET(req: Request) {
  await ensureSchema();
  const userId = getUserIdFromRequest(req);
  const recipes = await getSavedRecipes(userId);
  return NextResponse.json(recipes);
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const userId = getUserIdFromRequest(req);
    const body = await req.json();
    const { title, time, ingredients, steps, tips, image_url, nutrition, genre } = body;

    if (!title || !ingredients || !steps) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const saved = await saveRecipe(
      { title, time, ingredients, steps, tips, image_url, nutrition, genre },
      userId
    );
    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
