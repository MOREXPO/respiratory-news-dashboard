import { NextResponse } from 'next/server';
import { insertOpportunities, listOpportunities } from '@/lib/opportunity-store';

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

async function runAiWebScouting(existingTitles: string[]): Promise<AiOpportunity[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Actúa como scout senior de business development en terapias respiratorias domiciliarias.

Objetivo:
- Buscar en internet (live) nuevas empresas para partnership/integración técnica en respiratorio (CPAP, NIV, ventilación, telemonitorización, plataformas clínicas, interoperabilidad).
- Priorizar fabricantes/plataformas/proveedores tecnológicos con encaje B2B.

Empresas ya existentes (NO repetir):
${JSON.stringify(existingTitles)}

Devuelve SOLO JSON válido con forma:
{"items":[
  {
    "title":"...",
    "description":"... incluye país/región, web oficial y canal de contacto público",
    "marketProblem":"...",
    "proposedSolution":"...",
    "technicalIntegration":"... API/HL7/FHIR/export/webhooks/SSO",
    "potentialClients":["..."],
    "technicalDifficulty":"Baja|Media|Alta",
    "businessPotential":"Bajo|Medio|Alto",
    "barriers":"...",
    "validationSteps":"...",
    "score": 0-10,
    "tags":["empresa","partnership","integración","live-scouting"],
    "sourceLinks":["https://...","https://..."]
  }
]}

Reglas:
- máximo 5 empresas nuevas
- no repetir empresas de la lista existente
- sourceLinks deben ser enlaces reales usados en la investigación
- español profesional
- no markdown, no texto fuera del JSON.`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
      max_output_tokens: 2600,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
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

export async function POST() {
  const current = listOpportunities();
  const existingTitles = current.map((o) => o.title.toLowerCase());
  const existingSet = new Set(existingTitles);

  const aiItems = await runAiWebScouting(existingTitles);
  if (!aiItems) {
    return NextResponse.json({
      ok: false,
      inserted: 0,
      message: 'No se pudo ejecutar scouting con IA (revisa OPENAI_API_KEY o disponibilidad del modelo/tool).',
    }, { status: 500 });
  }

  const sanitized = aiItems
    .map((i) => ({
      ...i,
      title: (i.title || '').trim(),
      score: Math.max(0, Math.min(10, Number(i.score || 0))),
      potentialClients: Array.isArray(i.potentialClients) ? i.potentialClients : [],
      tags: Array.isArray(i.tags) ? i.tags : ['empresa', 'partnership', 'integración', 'live-scouting'],
      sourceLinks: Array.isArray(i.sourceLinks) ? i.sourceLinks.filter((u) => /^https?:\/\//i.test(u)) : [],
    }))
    .filter((i) => i.title && !existingSet.has(i.title.toLowerCase()))
    .slice(0, 5);

  if (sanitized.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Scouting IA completado, sin nuevas empresas válidas.' });
  }

  const inserted = insertOpportunities(sanitized as any);
  return NextResponse.json({ ok: true, inserted, message: `Scouting IA live completado: ${inserted} nuevas empresas insertadas.` });
}
