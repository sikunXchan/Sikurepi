import { NextResponse } from 'next/server';
import { deleteSavedRecipe, touchSavedRecipe } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(req);
    const success = await deleteSavedRecipe(parseInt(id, 10), userId);
    return NextResponse.json({ success });
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(req);
    const updated = await touchSavedRecipe(parseInt(id, 10), userId);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
