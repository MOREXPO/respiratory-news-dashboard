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
  const [maxScore, setMaxScore] = useState('10');
  const [difficulty, setDifficulty] = useState<'ALL' | 'Baja' | 'Media' | 'Alta'>('ALL');
  const [potential, setPotential] = useState<'ALL' | 'Bajo' | 'Medio' | 'Alto'>('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'recent'>('score_desc');
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

  const tagOptions = useMemo(() => {
    const s = new Set<string>();
    opps.forEach((o) => o.tags.forEach((t) => s.add(t)));
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [opps]);

  const filteredOpps = useMemo(() => {
    const min = Number(minScore || 0);
    const max = Number(maxScore || 10);

    const list = opps.filter((i) => {
      if (onlyToday && !i.createdAt.startsWith(today)) return false;
      if (onlyHighScore && i.score < 8.5) return false;
      if (!Number.isNaN(min) && i.score < min) return false;
      if (!Number.isNaN(max) && i.score > max) return false;
      if (difficulty !== 'ALL' && i.technicalDifficulty !== difficulty) return false;
      if (potential !== 'ALL' && i.businessPotential !== potential) return false;
      if (selectedTag !== 'ALL' && !i.tags.includes(selectedTag)) return false;
      return true;
    });

    if (sortBy === 'score_asc') return [...list].sort((a, b) => a.score - b.score);
    if (sortBy === 'recent') return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return [...list].sort((a, b) => b.score - a.score);
  }, [opps, onlyToday, onlyHighScore, today, minScore, maxScore, difficulty, potential, selectedTag, sortBy]);

  const topOpps = useMemo(() => [...opps].sort((a, b) => b.score - a.score).slice(0, 5), [opps]);
  const avgScore = useMemo(() => (filteredOpps.length ? (filteredOpps.reduce((a, b) => a + b.score, 0) / filteredOpps.length).toFixed(2) : '0.00'), [filteredOpps]);

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
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
              <div className="grid md:grid-cols-6 gap-2">
                <input className="bg-zinc-800 rounded px-3 py-2 md:col-span-2" placeholder="Buscar oportunidad..." value={q} onChange={(e) => setQ(e.target.value)} />
                <input className="bg-zinc-800 rounded px-3 py-2" type="number" min={0} max={10} step={0.5} value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Score min" />
                <input className="bg-zinc-800 rounded px-3 py-2" type="number" min={0} max={10} step={0.5} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="Score max" />
                <select className="bg-zinc-800 rounded px-3 py-2" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                  <option value="ALL">Dificultad: todas</option>
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
                <button className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-2" onClick={loadOpps}>Actualizar</button>
              </div>

              <div className="grid md:grid-cols-5 gap-2">
                <select className="bg-zinc-800 rounded px-3 py-2" value={potential} onChange={(e) => setPotential(e.target.value as any)}>
                  <option value="ALL">Potencial: todos</option>
                  <option value="Bajo">Bajo</option>
                  <option value="Medio">Medio</option>
                  <option value="Alto">Alto</option>
                </select>
                <select className="bg-zinc-800 rounded px-3 py-2" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                  {tagOptions.map((tag) => <option key={tag} value={tag}>{tag === 'ALL' ? 'Tag: todos' : tag}</option>)}
                </select>
                <select className="bg-zinc-800 rounded px-3 py-2" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="score_desc">Orden: score ↓</option>
                  <option value="score_asc">Orden: score ↑</option>
                  <option value="recent">Orden: más reciente</option>
                </select>
                <label className="text-sm flex items-center gap-2 bg-zinc-800 rounded px-3 py-2"><input type="checkbox" checked={onlyToday} onChange={(e) => setOnlyToday(e.target.checked)} /> Solo hoy</label>
                <label className="text-sm flex items-center gap-2 bg-zinc-800 rounded px-3 py-2"><input type="checkbox" checked={onlyHighScore} onChange={(e) => setOnlyHighScore(e.target.checked)} /> Score ≥ 8.5</label>
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-400 text-xs">Resultados filtrados</p>
                <p className="text-2xl font-bold">{filteredOpps.length}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-400 text-xs">Score medio</p>
                <p className="text-2xl font-bold">{avgScore}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-400 text-xs">Total oportunidades</p>
                <p className="text-2xl font-bold">{opps.length}</p>
              </div>
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
                  <article key={o.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 shadow-lg shadow-black/20">
                    <div className="flex justify-between gap-3 items-start">
                      <h3 className="text-xl font-semibold">{o.title}</h3>
                      <span className="text-sm rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-1">{o.score}/10</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">Dificultad: {o.technicalDifficulty}</span>
                      <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">Potencial: {o.businessPotential}</span>
                      <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">{new Date(o.createdAt).toLocaleDateString('es-ES')}</span>
                    </div>

                    <p className="text-zinc-300">{o.description}</p>
                    <p><b>Problema:</b> {o.marketProblem}</p>
                    <p><b>Solución:</b> {o.proposedSolution}</p>
                    <p><b>Integración:</b> {o.technicalIntegration}</p>

                    <div className="flex flex-wrap gap-2">
                      {o.tags.slice(0, 8).map((t) => <span key={t} className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700">{t}</span>)}
                    </div>

                    {o.sourceLinks?.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs text-zinc-400 mb-1">Fuentes:</p>
                        <ul className="list-disc pl-5 text-sm text-blue-300 space-y-1">
                          {o.sourceLinks.slice(0, 6).map((s) => (
                            <li key={s}>
                              <a href={s} target="_blank" rel="noreferrer" className="underline break-all">
                                {s}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
