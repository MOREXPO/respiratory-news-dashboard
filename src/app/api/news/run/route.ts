import { NextResponse } from 'next/server';
import { addNews } from '@/lib/news-store';

const COMPANIES = [
  'Breas Medical',
  'Philips Respironics',
  'ResMed',
  'Oxymesa',
  'Esteve Teijin',
  'Air Liquide',
  'Yuwell Medical',
  'BMC Medical',
] as const;

type ParsedItem = {
  company: string;
  date: string;
  title: string;
  summary: string;
  url: string;
  source?: string;
};

function text(x: string) {
  return x
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function ymdFromPubDate(pubDate?: string) {
  if (!pubDate) return new Date().toISOString().slice(0, 10);
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function parseRss(xml: string, company: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = text((block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim());
    const link = text((block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim());
    const desc = text((block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '').trim());
    const source = text((block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '').trim()) || 'Google News';
    const pubDate = text((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim());

    if (!title || !link) continue;
    out.push({
      company,
      date: ymdFromPubDate(pubDate),
      title,
      summary: desc || 'Noticia sectorial detectada en feed de 24h.',
      url: link,
      source,
    });
  }

  return out;
}

export async function POST() {
  const all: ParsedItem[] = [];

  for (const company of COMPANIES) {
    const q = `${company} when:1d`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=ES&ceid=ES:es`;
    try {
      const res = await fetch(rssUrl, { cache: 'no-store' });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parseRss(xml, company).slice(0, 8);
      all.push(...parsed);
    } catch {
      // ignore individual feed errors
    }
  }

  // Deduplicate obvious repeats by company+title+url
  const seen = new Set<string>();
  const unique = all.filter((n) => {
    const k = `${n.company}|${n.title.toLowerCase()}|${n.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!unique.length) {
    return NextResponse.json({ ok: true, inserted: 0, scanned: 0, message: 'Sin noticias nuevas en feeds 24h.' });
  }

  const inserted = addNews(unique);
  return NextResponse.json({ ok: true, inserted: inserted.length, scanned: unique.length, message: `Insertadas ${inserted.length} noticias.` });
}
