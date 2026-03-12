'use client';

import { useEffect, useMemo, useState } from 'react';
import { COMPANIES } from '@/lib/companies';
import type { NewsItem } from '@/lib/news-store';

type Opportunity = {
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

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [tab, setTab] = useState<'news' | 'bi'>('news');

  const [company, setCompany] = useState('ALL');
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [news, setNews] = useState<NewsItem[]>([]);

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [q, setQ] = useState('');
  const [minScore, setMinScore] = useState('0');
  const [onlyToday, setOnlyToday] = useState(false);
  const [onlyHighScore, setOnlyHighScore] = useState(false);

  const [loading, setLoading] = useState(true);

  async function loadNews() {
    const query = new URLSearchParams({ company, from, to });
    const res = await fetch(`/api/news?${query.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setNews(Array.isArray(data) ? data : []);
  }

  async function loadOpps() {
    const query = new URLSearchParams({ q, minScore });
    const res = await fetch(`/api/opportunities?${query.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setOpps(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadNews(), loadOpps()]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
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

  const filteredOpps = useMemo(() => {
    return opps.filter((i) => {
      if (onlyToday && !i.createdAt.startsWith(today)) return false;
      if (onlyHighScore && i.score < 8.5) return false;
      return true;
    });
  }, [opps, onlyToday, onlyHighScore, today]);

  const topOpps = useMemo(() => [...opps].sort((a, b) => b.score - a.score).slice(0, 5), [opps]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <h1 className="text-3xl font-bold">Respiratory Intelligence Hub</h1>
        <p className="text-zinc-400">Noticias + oportunidades de negocio en una sola web.</p>

        <div className="inline-flex rounded-xl border border-zinc-700 overflow-hidden">
          <button className={`px-4 py-2 ${tab === 'news' ? 'bg-blue-600' : 'bg-zinc-900'}`} onClick={() => setTab('news')}>News</button>
          <button className={`px-4 py-2 ${tab === 'bi' ? 'bg-blue-600' : 'bg-zinc-900'}`} onClick={() => setTab('bi')}>BI Opportunities</button>
        </div>

        {loading ? <p>Cargando…</p> : tab === 'news' ? (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid md:grid-cols-4 gap-3">
              <select className="bg-zinc-800 rounded px-3 py-2" value={company} onChange={(e) => setCompany(e.target.value)}>
                <option value="ALL">Todas las empresas</option>
                {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="bg-zinc-800 rounded px-3 py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input className="bg-zinc-800 rounded px-3 py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-2" onClick={loadNews}>Actualizar</button>
            </section>

            {groupedByDate.length === 0 ? (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
                <p className="text-lg font-semibold">No hay noticias relevantes</p>
                <p className="text-zinc-400 mt-1">No se han encontrado novedades en el rango de fechas y empresas seleccionadas.</p>
              </section>
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
          </>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid md:grid-cols-4 gap-2">
              <input className="bg-zinc-800 rounded px-3 py-2 md:col-span-2" placeholder="Buscar oportunidad..." value={q} onChange={(e) => setQ(e.target.value)} />
              <input className="bg-zinc-800 rounded px-3 py-2" type="number" min={0} max={10} step={0.5} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
              <button className="bg-blue-600 rounded px-3 py-2" onClick={loadOpps}>Filtrar</button>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={onlyToday} onChange={(e) => setOnlyToday(e.target.checked)} /> Solo nuevas de hoy</label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={onlyHighScore} onChange={(e) => setOnlyHighScore(e.target.checked)} /> Solo score ≥ 8.5</label>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="font-semibold mb-2">Top oportunidades</h2>
              <div className="flex flex-wrap gap-2">
                {topOpps.map((t) => <span key={t.id} className="text-xs rounded-full border border-zinc-700 px-3 py-1 bg-zinc-800">{t.title} · {t.score}/10</span>)}
              </div>
            </section>

            {filteredOpps.length === 0 ? (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
                <p className="text-lg font-semibold">Aún no hay oportunidades registradas</p>
              </section>
            ) : (
              <section className="grid gap-4">
                {filteredOpps.map((o) => (
                  <article key={o.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
                    <div className="flex justify-between gap-3 items-start">
                      <h3 className="text-xl font-semibold">{o.title}</h3>
                      <span className="text-sm rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-1">{o.score}/10</span>
                    </div>
                    <p className="text-zinc-300">{o.description}</p>
                    <p><b>Problema:</b> {o.marketProblem}</p>
                    <p><b>Solución:</b> {o.proposedSolution}</p>
                    <p><b>Integración:</b> {o.technicalIntegration}</p>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
