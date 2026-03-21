import { NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

type Hit = { name: string; website: string; source: string; snippet: string };

type ReserveCandidate = { name: string; website: string; source: string; snippet: string };

const RESERVE_CANDIDATES: ReserveCandidate[] = [
  { name: 'MIR Spiro', website: 'https://www.spirometry.com', source: 'https://www.spirometry.com', snippet: 'Spirometry and respiratory diagnostics solutions.' },
  { name: 'PulmOne', website: 'https://www.pulmone.com', source: 'https://www.pulmone.com', snippet: 'Lung function testing and respiratory diagnostics.' },
  { name: 'MonitAir', website: 'https://www.monitair.com', source: 'https://www.monitair.com', snippet: 'Respiratory remote monitoring and telehealth.' },
  { name: 'LungPass', website: 'https://www.lungpass.com', source: 'https://www.lungpass.com', snippet: 'Respiratory diagnostics and digital spirometry.' },
  { name: 'Aevice Health', website: 'https://www.aevice.com', source: 'https://www.aevice.com', snippet: 'Wearable respiratory monitoring platform.' },
  { name: 'Adherium', website: 'https://www.adherium.com', source: 'https://www.adherium.com', snippet: 'Connected inhaler adherence technology.' },
  { name: 'Medify Air', website: 'https://medifyair.com', source: 'https://medifyair.com', snippet: 'Respiratory air quality and patient environment tech.' },
  { name: 'TidalSense', website: 'https://www.tidalsense.com', source: 'https://www.tidalsense.com', snippet: 'Respiratory diagnostics and AI-driven monitoring.' },
];

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

function normTitle(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(inc|ltd|llc|corp|corporation|sa|ag|gmbh|medical|healthcare|technologies|technology|systems)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rootDomain(url?: string) {
  if (!url) return '';
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const p = h.split('.');
    return p.slice(-2).join('.');
  } catch {
    return '';
  }
}

async function ddg(query: string, excludeNames: string[] = []): Promise<Hit[]> {
  const negative = excludeNames.slice(0, 12).map((n) => ` -"${n}"`).join('');
  const finalQuery = `${query}${negative}`;

  const res = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(finalQuery)}`, {
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
    out.push({ name, website: website, source: finalUrl, snippet });
    if (out.length >= 10) break;
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
  const existingItems = listOpportunities();
  const existingTitleKeys = new Set(existingItems.map((o) => normTitle(o.title)));
  const existingDomainKeys = new Set(existingItems.map((o) => rootDomain(o.sourceLinks?.[1] || o.sourceLinks?.[0])).filter(Boolean));

  const queries = [
    'global respiratory homecare companies remote monitoring integration',
    'global CPAP NIV manufacturers API interoperability',
    'global sleep apnea digital health medical device companies',
    'global respiratory therapy startups FHIR HL7 integration',
    'global connected inhaler and oxygen therapy companies platform API',
    'global hospital at home respiratory technology companies',
  ];

  const excludeForSearch = Array.from(existingTitleKeys).slice(0, 20);
  const hits = (await Promise.all(queries.map((q) => ddg(q, excludeForSearch).catch(() => [])))).flat();
  const uniq: Hit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const k = h.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(h);
  }

  const selected: Hit[] = [];
  const selectedTitleKeys = new Set<string>();
  const selectedDomainKeys = new Set<string>();

  for (const h of uniq) {
    const tKey = normTitle(h.name);
    const dKey = rootDomain(h.website) || rootDomain(h.source);

    const repeatedByTitle = tKey && (existingTitleKeys.has(tKey) || selectedTitleKeys.has(tKey));
    const repeatedByDomain = dKey && (existingDomainKeys.has(dKey) || selectedDomainKeys.has(dKey));
    if (repeatedByTitle || repeatedByDomain) continue;

    selected.push(h);
    if (tKey) selectedTitleKeys.add(tKey);
    if (dKey) selectedDomainKeys.add(dKey);

    if (selected.length >= 5) break;
  }

  // Fallback reserve when live search finds no unique candidates
  if (!selected.length) {
    for (const r of RESERVE_CANDIDATES) {
      const tKey = normTitle(r.name);
      const dKey = rootDomain(r.website) || rootDomain(r.source);
      const repeatedByTitle = tKey && (existingTitleKeys.has(tKey) || selectedTitleKeys.has(tKey));
      const repeatedByDomain = dKey && (existingDomainKeys.has(dKey) || selectedDomainKeys.has(dKey));
      if (repeatedByTitle || repeatedByDomain) continue;

      selected.push({ name: r.name, website: r.website, source: r.source, snippet: r.snippet });
      if (tKey) selectedTitleKeys.add(tKey);
      if (dKey) selectedDomainKeys.add(dKey);
      if (selected.length >= 3) break;
    }
  }

  if (!selected.length) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Scouting live completado: sin nuevas empresas (incluyendo reserva).' });
  }

  const items = selected.map((h) => ({
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
