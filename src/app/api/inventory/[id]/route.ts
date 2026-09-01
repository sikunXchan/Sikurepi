import { NextResponse } from 'next/server';
import { deleteIngredient, togglePinIngredient, updateIngredientCategory } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(req);
    const success = await deleteIngredient(parseInt(id, 10), userId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
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
    const body = await req.json().catch(() => ({}));
    const numId = parseInt(id, 10);

    if (body.category !== undefined) {
      const updated = await updateIngredientCategory(numId, body.category, userId);
      return NextResponse.json(updated);
    }

    const updated = await togglePinIngredient(numId, userId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
