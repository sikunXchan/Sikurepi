import { NextResponse } from 'next/server';
import { consumeIngredients, recordCookingDone, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const userId = getUserIdFromRequest(req);
    const body = await req.json();
    const { consumedIngredients = [] } = body;

    let consumedCount = 0;
    if (Array.isArray(consumedIngredients) && consumedIngredients.length > 0) {
      consumedCount = await consumeIngredients(consumedIngredients, userId);
    }

    const updatedStats = await recordCookingDone(userId, consumedCount);

    return NextResponse.json({
      success: true,
      consumedCount,
      stats: updatedStats,
    });
  } catch (error: any) {
    console.error('Consume error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
