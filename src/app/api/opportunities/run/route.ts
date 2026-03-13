import { NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

type Candidate = {
  name: string;
  website: string;
  source: string;
};

function scoreFromName(name: string) {
  const n = name.toLowerCase();
  let score = 7.2;
  if (n.includes('medical') || n.includes('health') || n.includes('respir')) score += 0.4;
  if (n.includes('care') || n.includes('digital') || n.includes('monitor')) score += 0.3;
  if (score > 9.2) score = 9.2;
  return Number(score.toFixed(1));
}

function normalizeCompany(raw: string) {
  return raw
    .replace(/\s*[-|–—].*$/, '')
    .replace(/\b(home|about|contact|news|careers)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ddgSearch(query: string): Promise<Candidate[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  const html = await res.text();

  const out: Candidate[] = [];
  const regex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const titleHtml = m[2];
    const title = titleHtml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

    let finalUrl = href;
    try {
      const parsed = new URL(href);
      if (parsed.hostname.includes('duckduckgo.com') && parsed.searchParams.get('uddg')) {
        finalUrl = decodeURIComponent(parsed.searchParams.get('uddg') || href);
      }
    } catch {}

    if (!/^https?:\/\//i.test(finalUrl)) continue;
    const host = (() => {
      try {
        return new URL(finalUrl).hostname;
      } catch {
        return '';
      }
    })();

    if (!host || host.includes('duckduckgo.com') || host.includes('wikipedia.org') || host.includes('linkedin.com')) continue;

    const company = normalizeCompany(title);
    if (!company || company.length < 3) continue;

    out.push({ name: company, website: `${new URL(finalUrl).protocol}//${new URL(finalUrl).hostname}`, source: finalUrl });
    if (out.length >= 12) break;
  }

  // dedupe by company
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function POST() {
  const current = listOpportunities();
  const existing = new Set(current.map((o) => o.title.toLowerCase()));

  const queries = [
    'respiratory therapy device manufacturer homecare remote monitoring API',
    'CPAP NIV telemonitoring platform medical device company Europe',
    'home respiratory care digital health company integration FHIR HL7',
  ];

  const batches = await Promise.all(queries.map((q) => ddgSearch(q).catch(() => [])));
  const merged = batches.flat();

  const unique: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of merged) {
    const k = c.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }

  const fresh = unique.filter((c) => !existing.has(c.name.toLowerCase())).slice(0, 5);

  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'No se detectaron nuevas empresas en scouting live.' });
  }

  const items = fresh.map((c) => ({
    title: c.name,
    description: `Empresa detectada en scouting live con potencial de integración B2B en terapias respiratorias. Web: ${c.website}. Fuente: ${c.source}`,
    marketProblem: 'Fragmentación de datos y procesos entre fabricantes/plataformas y proveedores de terapia domiciliaria.',
    proposedSolution: 'Iniciar contacto para partnership técnico-comercial y explorar integración de datos/operación.',
    technicalIntegration: 'Evaluación de APIs, exportaciones, HL7/FHIR, webhooks y SSO para integración.',
    potentialClients: ['Hospitales', 'Proveedores domiciliarios', 'Clínicas respiratorias', 'Aseguradoras'],
    technicalDifficulty: 'Media' as const,
    businessPotential: 'Medio' as const,
    barriers: 'Disponibilidad real de APIs, acuerdos de partnership, requisitos regulatorios y seguridad.',
    validationSteps: '1) Contacto inicial BD. 2) Descubrimiento técnico. 3) Caso piloto con KPIs de integración.',
    score: scoreFromName(c.name),
    tags: ['empresa', 'partnership', 'integración', 'live-scouting'],
    sourceLinks: [c.source, c.website],
  }));

  const inserted = insertOpportunities(items);
  return NextResponse.json({ ok: true, inserted, message: `Scouting live completado: ${inserted} nuevas empresas insertadas.` });
}
