import { NextResponse } from 'next/server';
import { removeDuplicateIngredients } from '@/lib/db';

export async function POST() {
  try {
    const removed = await removeDuplicateIngredients();
    return NextResponse.json({ removed });
  } catch (error) {
    console.error('Deduplicate error:', error);
    return NextResponse.json({ error: 'Failed to deduplicate' }, { status: 500 });
  }
}
