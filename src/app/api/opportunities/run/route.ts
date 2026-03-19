import { NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

type Hit = { name: string; website: string; source: string; snippet: string };

function normalizeCompany(raw: string) {
  return raw
    .replace(/\s*[-|–—].*$/, '')
    .replace(/\b(home|about|contact|news|careers)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(name: string, snippet: string) {
  const t = `${name} ${snippet}`.toLowerCase();
  let s = 7.0;
  if (/(respir|cpap|sleep|ventil|homecare|medical)/.test(t)) s += 0.8;
  if (/(api|integration|platform|monitor|remote|fhir|hl7)/.test(t)) s += 0.7;
  return Math.min(9.4, Number(s.toFixed(1)));
}

async function ddg(query: string): Promise<Hit[]> {
  const res = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await res.text();

  const out: Hit[] = [];
  const reg = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:result__snippet[^>]*>([\s\S]*?)<\/a>|result__snippet[^>]*>([\s\S]*?)<\/div>)?/g;
  let m: RegExpExecArray | null;

  while ((m = reg.exec(html)) !== null) {
    const href = m[1];
    const title = (m[2] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const snippet = (m[3] || m[4] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

    let finalUrl = href;
    try {
      const u = new URL(href);
      if (u.hostname.includes('duckduckgo.com') && u.searchParams.get('uddg')) {
        finalUrl = decodeURIComponent(u.searchParams.get('uddg') || href);
      }
    } catch {}

    let host = '';
    try {
      host = new URL(finalUrl).hostname;
    } catch {
      continue;
    }

    if (!/^https?:\/\//i.test(finalUrl)) continue;
    if (!host || /(duckduckgo|wikipedia|linkedin|facebook|instagram|x\.com|twitter)/i.test(host)) continue;

    const name = normalizeCompany(title);
    if (!name || name.length < 3) continue;

    const website = `${new URL(finalUrl).protocol}//${new URL(finalUrl).hostname}`;
    out.push({ name, website, source: finalUrl, snippet });
    if (out.length >= 12) break;
  }

  const seen = new Set<string>();
  return out.filter((h) => {
    const k = h.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function POST() {
  const existing = new Set(listOpportunities().map((o) => o.title.toLowerCase()));

  const queries = [
    'respiratory homecare company remote monitoring platform',
    'CPAP NIV manufacturer API integration',
    'sleep apnea digital health company medical device',
  ];

  const hits = (await Promise.all(queries.map((q) => ddg(q).catch(() => [])))).flat();
  const uniq: Hit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const k = h.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(h);
  }

  const fresh = uniq.filter((h) => !existing.has(h.name.toLowerCase())).slice(0, 5);
  if (!fresh.length) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Scouting live (sin Brave) completado: no hay nuevas empresas.' });
  }

  const items = fresh.map((h) => ({
    title: h.name,
    description: `Empresa detectada en scouting live sin Brave. Web: ${h.website}. ${h.snippet ? `Contexto: ${h.snippet}` : ''}`,
    marketProblem: 'Fragmentación de datos y procesos entre plataformas/fabricantes y proveedores de terapia domiciliaria.',
    proposedSolution: 'Explorar partnership técnico-comercial para interoperabilidad y operación clínica.',
    technicalIntegration: 'Validar API/exportes, HL7/FHIR, webhooks y capacidades de integración B2B.',
    potentialClients: ['Hospitales', 'Proveedores domiciliarios', 'Clínicas respiratorias', 'Aseguradoras'],
    technicalDifficulty: 'Media' as const,
    businessPotential: 'Medio' as const,
    barriers: 'Acceso a APIs, acuerdos comerciales y validación regulatoria.',
    validationSteps: 'Contacto inicial BD, discovery técnico y propuesta de piloto.',
    score: score(h.name, h.snippet),
    tags: ['empresa', 'partnership', 'integración', 'live-scouting', 'no-brave'],
    sourceLinks: [h.source, h.website],
  }));

  const inserted = insertOpportunities(items as any);
  return NextResponse.json({ ok: true, inserted, message: `Scouting live (sin Brave) completado: ${inserted} nuevas empresas.` });
}
