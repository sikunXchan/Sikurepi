import { NextResponse } from 'next/server';
import { getUserStats, ensureSchema } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const userId = getUserIdFromRequest(req);
    const stats = await getUserStats(userId);
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
