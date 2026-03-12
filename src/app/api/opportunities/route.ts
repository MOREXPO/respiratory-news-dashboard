import { NextRequest, NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minScore = Number(searchParams.get('minScore') || 0);
  const q = (searchParams.get('q') || '').toLowerCase();

  let items = listOpportunities();
  if (!Number.isNaN(minScore)) items = items.filter((i) => i.score >= minScore);
  if (q) items = items.filter((i) => `${i.title} ${i.description} ${i.tags.join(' ')}`.toLowerCase().includes(q));

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Formato inválido. Usa { items: [...] }' }, { status: 400 });
  }

  const inserted = insertOpportunities(body.items);
  return NextResponse.json({ ok: true, inserted });
}
