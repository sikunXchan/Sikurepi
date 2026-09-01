import { NextResponse } from 'next/server';
import { transferCompletedShoppingToInventory } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    const count = await transferCompletedShoppingToInventory(userId);
    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
