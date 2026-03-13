import { NextRequest, NextResponse } from 'next/server';
import { addNews, listNews } from '@/lib/news-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get('company') || 'ALL';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const relevance = searchParams.get('relevance') || 'ALL';

  let items = listNews();

  if (company !== 'ALL') items = items.filter((n) => n.company === company);
  if (from) items = items.filter((n) => n.date >= from);
  if (to) items = items.filter((n) => n.date <= to);
  if (relevance !== 'ALL') items = items.filter((n) => n.relevance === relevance);

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Formato inválido. Usa { items: [...] }' }, { status: 400 });
  }

  const created = addNews(body.items);
  return NextResponse.json({ ok: true, inserted: created.length });
}
