import { NextResponse } from 'next/server';
import { deleteShoppingItem, toggleShoppingItem } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(req);
    const success = await deleteShoppingItem(parseInt(id, 10), userId);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(req);
    const updated = await toggleShoppingItem(parseInt(id, 10), userId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
