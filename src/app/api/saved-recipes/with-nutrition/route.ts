import { NextResponse } from 'next/server';
import { getRecentRecipesWithNutrition } from '@/lib/db';

export async function GET() {
  try {
    const recipes = await getRecentRecipesWithNutrition(15);
    return NextResponse.json(recipes);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
