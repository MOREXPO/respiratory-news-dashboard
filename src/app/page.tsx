'use client';

import { useEffect, useMemo, useState } from 'react';
import { COMPANIES } from '@/lib/companies';
import type { NewsItem } from '@/lib/news-store';

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [company, setCompany] = useState('ALL');
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams({ company, from, to });
    const res = await fetch(`/api/news?${q.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setNews(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const n of news) {
      const arr = map.get(n.date) || [];
      arr.push(n);
      map.set(n.date, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [news]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-3xl font-bold">Respiratory News Dashboard</h1>
        <p className="text-zinc-400">Filtra por empresa y rango de fechas las noticias monitorizadas por tu job diario.</p>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid md:grid-cols-4 gap-3">
          <select className="bg-zinc-800 rounded px-3 py-2" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="ALL">Todas las empresas</option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="bg-zinc-800 rounded px-3 py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="bg-zinc-800 rounded px-3 py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-2" onClick={load}>Actualizar</button>
        </section>

        {loading ? (
          <p>Cargando…</p>
        ) : groupedByDate.length === 0 ? (
          <p className="text-zinc-400">No hay noticias para ese filtro.</p>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(([date, items]) => (
              <section key={date} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                <h2 className="text-lg font-semibold">{date} · {items.length} noticia(s)</h2>
                <div className="space-y-2">
                  {items.map((n) => (
                    <article key={n.id} className="rounded-lg border border-zinc-800 p-3">
                      <p className="text-xs text-zinc-400">{n.company}{n.source ? ` · ${n.source}` : ''}</p>
                      <h3 className="font-medium">{n.title}</h3>
                      <p className="text-sm text-zinc-300">{n.summary}</p>
                      <a className="text-blue-400 text-sm underline" href={n.url} target="_blank">Ver fuente</a>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
