import fs from 'node:fs';
import path from 'node:path';

export type Opportunity = {
  id: string;
  createdAt: string;
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

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'opportunities.json');

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf8');
}

export function listOpportunities() {
  ensureStore();
  const raw = fs.readFileSync(dataFile, 'utf8');
  const data = JSON.parse(raw) as Opportunity[];
  return data.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function normalizeTitle(title: string) {
  return (title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(inc|ltd|llc|corp|corporation|sa|ag|gmbh|medical|healthcare|technologies|technology|systems)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rootHost(url?: string) {
  if (!url) return '';
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = h.split('.');
    return parts.slice(-2).join('.');
  } catch {
    return '';
  }
}

export function insertOpportunities(items: Omit<Opportunity, 'id' | 'createdAt'>[]) {
  ensureStore();
  const current = listOpportunities();
  const now = new Date().toISOString();

  const mapped: Opportunity[] = items.map((i) => ({
    ...i,
    id: crypto.randomUUID(),
    createdAt: now,
  }));

  const seen = new Set<string>();
  const merged = [...mapped, ...current].filter((o) => {
    const titleKey = normalizeTitle(o.title);
    const hostKey = rootHost(o.sourceLinks?.[1]) || rootHost(o.sourceLinks?.[0]);
    const key = hostKey ? `h:${hostKey}` : `t:${titleKey}`;
    if (!titleKey && !hostKey) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(dataFile, JSON.stringify(merged, null, 2), 'utf8');
  // Return actually inserted count (not requested count)
  const inserted = merged.length - current.length;
  return Math.max(0, inserted);
}
