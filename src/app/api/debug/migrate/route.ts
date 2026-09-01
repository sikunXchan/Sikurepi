import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'その他'`;

    await sql`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition JSONB`;
    await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS genre VARCHAR(100)`;

    return NextResponse.json({ success: true, message: 'Migration completed successfully' });
  } catch (error: any) {
    console.error('Migration Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
