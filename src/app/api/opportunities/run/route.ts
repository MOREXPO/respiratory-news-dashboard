import { NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

type SearchHit = {
  name: string;
  website: string;
  source: string;
  snippet: string;
};

type AiOpportunity = {
  title: string;
  description: string;
  marketProblem: string;
  proposedSolution: string;
  technicalIntegration: string;
  potentialClients: string[];
  technicalDifficulty: 'Baja' | 'Media' | 'Alta';
  businessPotential: 'Bajo' | 'Medio' | 'Alto';
  barriers: string;
  validationSteps: string;
  score: number;
  tags: string[];
  sourceLinks: string[];
};

function normalizeCompany(raw: string) {
  return raw
    .replace(/\s*[-|–—].*$/, '')
    .replace(/\b(home|about|contact|news|careers)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ddgSearch(query: string): Promise<SearchHit[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  const html = await res.text();

  const out: SearchHit[] = [];
  const blockRegex = /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/g;
  let b: RegExpExecArray | null;

  while ((b = blockRegex.exec(html)) !== null) {
    const block = b[1];
    const aMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/);
    if (!aMatch) continue;

    const href = aMatch[1];
    const titleHtml = aMatch[2];
    const title = titleHtml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || block.match(/<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);
    const snippet = (snippetMatch?.[1] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

    let finalUrl = href;
    try {
      const parsed = new URL(href);
      if (parsed.hostname.includes('duckduckgo.com') && parsed.searchParams.get('uddg')) {
        finalUrl = decodeURIComponent(parsed.searchParams.get('uddg') || href);
      }
    } catch {}

    if (!/^https?:\/\//i.test(finalUrl)) continue;

    let u: URL;
    try {
      u = new URL(finalUrl);
    } catch {
      continue;
    }

    const host = u.hostname;
    if (!host || host.includes('duckduckgo.com') || host.includes('wikipedia.org') || host.includes('linkedin.com')) continue;

    const company = normalizeCompany(title);
    if (!company || company.length < 3) continue;

    out.push({ name: company, website: `${u.protocol}//${u.hostname}`, source: finalUrl, snippet });
    if (out.length >= 12) break;
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function aiRefineCandidates(hits: SearchHit[]): Promise<AiOpportunity[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Eres analista de business development en terapias respiratorias domiciliarias.\n\nA partir de estos resultados de búsqueda, devuelve SOLO empresas nuevas y reales con potencial de integración B2B.\n\nResultados JSON:\n${JSON.stringify(hits.slice(0, 20), null, 2)}\n\nDevuelve JSON válido con forma: {"items":[...]} donde cada item tenga EXACTAMENTE:\n- title\n- description\n- marketProblem\n- proposedSolution\n- technicalIntegration\n- potentialClients (array de strings)\n- technicalDifficulty (Baja|Media|Alta)\n- businessPotential (Bajo|Medio|Alto)\n- barriers\n- validationSteps\n- score (0-10)\n- tags (array, incluye empresa/partnership/integración/live-scouting)\n- sourceLinks (array de URLs)\n\nReglas:\n- máximo 5 empresas\n- evita duplicados\n- usa enlaces de los resultados cuando puedas\n- español neutro profesional\n- NO markdown, NO texto extra, solo JSON`;

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: prompt,
      max_output_tokens: 2200,
    }),
  });

  if (!r.ok) return null;
  const data = await r.json();

  const text = data?.output_text || '';
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.items)) return null;
    return parsed.items as AiOpportunity[];
  } catch {
    return null;
  }
}

function fallbackFromHits(hits: SearchHit[]): AiOpportunity[] {
  return hits.slice(0, 5).map((h, i) => ({
    title: h.name,
    description: `Empresa detectada en scouting live con potencial de integración B2B en terapias respiratorias. Web: ${h.website}. ${h.snippet ? `Contexto: ${h.snippet}` : ''}`,
    marketProblem: 'Fragmentación de datos y procesos entre fabricantes/plataformas y proveedores de terapia domiciliaria.',
    proposedSolution: 'Iniciar contacto para partnership técnico-comercial y explorar integración de datos/operación.',
    technicalIntegration: 'Evaluación de APIs, exportaciones, HL7/FHIR, webhooks y SSO para integración.',
    potentialClients: ['Hospitales', 'Proveedores domiciliarios', 'Clínicas respiratorias', 'Aseguradoras'],
    technicalDifficulty: 'Media',
    businessPotential: 'Medio',
    barriers: 'Disponibilidad real de APIs, acuerdos de partnership y requisitos regulatorios.',
    validationSteps: '1) Contacto inicial BD. 2) Descubrimiento técnico. 3) Caso piloto con KPIs de integración.',
    score: Number((7.2 + Math.max(0, 0.6 - i * 0.08)).toFixed(1)),
    tags: ['empresa', 'partnership', 'integración', 'live-scouting'],
    sourceLinks: [h.source, h.website],
  }));
}

export async function POST() {
  const current = listOpportunities();
  const existing = new Set(current.map((o) => o.title.toLowerCase()));

  const queries = [
    'respiratory therapy device manufacturer homecare remote monitoring API',
    'CPAP NIV telemonitoring platform medical device company Europe',
    'home respiratory care digital health company integration FHIR HL7',
    'connected respiratory medical device startup remote patient monitoring',
  ];

  const batches = await Promise.all(queries.map((q) => ddgSearch(q).catch(() => [])));
  const merged = batches.flat();

  const unique: SearchHit[] = [];
  const seen = new Set<string>();
  for (const h of merged) {
    const k = h.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(h);
  }

  const freshHits = unique.filter((h) => !existing.has(h.name.toLowerCase()));
  if (freshHits.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'No se detectaron nuevas empresas en scouting live.' });
  }

  const aiItems = await aiRefineCandidates(freshHits);
  const rawItems = aiItems && aiItems.length ? aiItems : fallbackFromHits(freshHits);

  // final sanitize + dedupe against existing
  const sanitized = rawItems
    .map((i) => ({
      ...i,
      title: (i.title || '').trim(),
      score: Math.max(0, Math.min(10, Number(i.score || 0))),
      potentialClients: Array.isArray(i.potentialClients) ? i.potentialClients : [],
      tags: Array.isArray(i.tags) ? i.tags : ['empresa', 'partnership', 'integración', 'live-scouting'],
      sourceLinks: Array.isArray(i.sourceLinks) ? i.sourceLinks.filter((u) => /^https?:\/\//i.test(u)) : [],
    }))
    .filter((i) => i.title && !existing.has(i.title.toLowerCase()))
    .slice(0, 5);

  if (sanitized.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Scouting live ejecutado, pero sin nuevas empresas válidas para insertar.' });
  }

  const inserted = insertOpportunities(sanitized as any);
  return NextResponse.json({
    ok: true,
    inserted,
    message: `Scouting live completado: ${inserted} nuevas empresas insertadas.${aiItems ? ' (IA)' : ' (fallback parser)'}`,
  });
}
