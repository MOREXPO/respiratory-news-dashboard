import fs from 'node:fs';
import path from 'node:path';

export type NewsRelevance = 'ALTA' | 'MEDIA' | 'BAJA';

export type NewsItem = {
  id: string;
  company: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  url: string;
  source?: string;
  relevance: NewsRelevance;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'news.json');

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf8');
}

export function listNews() {
  ensureStore();
  const raw = fs.readFileSync(dataFile, 'utf8');
  return JSON.parse(raw) as NewsItem[];
}

export function saveNews(items: NewsItem[]) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), 'utf8');
}

function classifyRelevance(title: string, summary: string): NewsRelevance {
  const text = `${title} ${summary}`.toLowerCase();
  const highSignals = ['fda', 'recall', 'approval', 'acquisition', 'merger', 'consent decree', 'warning', 'regulator', 'earnings'];
  const midSignals = ['partnership', 'integrat', 'platform', 'launch', 'pilot', 'study', 'clinical'];

  if (highSignals.some((k) => text.includes(k))) return 'ALTA';
  if (midSignals.some((k) => text.includes(k))) return 'MEDIA';
  return 'BAJA';
}

export function addNews(items: Array<Partial<NewsItem> & { company: string; date: string; title: string; summary: string; url: string }>) {
  const current = listNews();
  const now = new Date().toISOString();

  const next: NewsItem[] = items.map((n: any) => ({
    ...n,
    relevance: n.relevance || classifyRelevance(n.title || '', n.summary || ''),
    id: crypto.randomUUID(),
    createdAt: now,
  }));

  const merged = [...next, ...current]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5000);

  saveNews(merged);
  return next;
}
