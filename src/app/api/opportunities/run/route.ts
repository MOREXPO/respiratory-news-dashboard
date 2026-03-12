import { NextResponse } from 'next/server';
import { listOpportunities, insertOpportunities } from '@/lib/opportunity-store';
import { opportunityCandidates } from '@/lib/opportunity-candidates';

export async function POST() {
  const current = listOpportunities();
  const existing = new Set(current.map((o) => o.title.toLowerCase()));

  const toInsert = opportunityCandidates
    .filter((c) => !existing.has(c.title.toLowerCase()))
    .slice(0, 3);

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'No hay nuevas empresas candidatas por insertar.' });
  }

  const inserted = insertOpportunities(toInsert as any);
  return NextResponse.json({ ok: true, inserted, message: `Se insertaron ${inserted} oportunidades nuevas.` });
}
