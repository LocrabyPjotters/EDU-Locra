import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6'];
const CATEGORY_ICONS: Record<string, string> = {
  'Wiskunde': '📐', 'Taal & Literatuur': '📚', 'Programmeren': '💻', 'Wetenschap': '🔬',
  'Geschiedenis': '🏛️', 'Aardrijkskunde': '🌍', 'Engels': '🇬🇧', 'Creatief': '🎨', 'Overig': '📝'
};

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: color, filter: 'blur(40px)', opacity: 0.15 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 800, background: `linear-gradient(135deg, #fff, ${color})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{sub}</p>}
    </div>
  );
}

function LatencyBadge({ ms }: { ms: number | null }) {
  if (ms === null) return <span style={{ color: '#64748b', fontSize: '0.75rem' }}>—</span>;
  const color = ms < 500 ? '#10b981' : ms < 1500 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{ color, fontWeight: 700, fontSize: '0.85rem' }}>
      {ms.toLocaleString()} ms
    </span>
  );
}

export default function ReportingPanel() {
  const [activeTab, setActiveTab] = useState<'overzicht' | 'onderwerpen' | 'modellen' | 'systeem' | 'klassen' | 'groepen'>('overzicht');
  const token = useAuthStore(state => state.token);
  const [classData, setClassData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [csvExporting, setCsvExporting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/reporting', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setClassData(data.classes || []);
          setGroupData(data.groups || []);
          setAnalytics(data.analytics || null);
          setTelemetry(data.telemetry || null);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [token]);

  const exportCSV = () => {
    setCsvExporting(true);
    try {
      const rows = [['Type', 'Naam', 'Leden', 'Prompts', 'Gem/persoon', 'Tokens', 'Primair Model', 'Top Onderwerpen']];
      classData.forEach(r => rows.push(['Klas', r.name, r.students, r.totalPrompts, r.avgPrompts, r.totalTokens, r.primaryModel, (r.topTopics || []).map((t: any) => t.topic).join('; ')]));
      groupData.forEach(r => rows.push(['Groep', r.name, r.members, r.totalPrompts, r.avgPrompts, r.totalTokens, r.primaryModel, (r.topTopics || []).map((t: any) => t.topic).join('; ')]));
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `locra-rapportage-${new Date().toISOString().split('T')[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Rapportage data laden...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const tabs = [
    { key: 'overzicht', label: '📊 Overzicht' },
    { key: 'onderwerpen', label: '📚 Onderwerpen' },
    { key: 'modellen', label: '🤖 Model Prestaties' },
    { key: 'klassen', label: '🎓 Klassen' },
    { key: 'groepen', label: '👥 Groepen' },
    { key: 'systeem', label: '💻 Systeem & Telemetrie' },
  ];

  const totalPersons = classData.reduce((a, r) => a + (r.students || 0), 0) + groupData.reduce((a, r) => a + (r.members || 0), 0);
  const formatTokens = (t: number) => t > 1000000 ? (t/1000000).toFixed(1)+'M' : t > 1000 ? (t/1000).toFixed(1)+'K' : t.toString();

  return (
    <div className="panel-content">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📈 Uitgebreide Rapportage
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
            Geanonimiseerde gebruiksstatistieken en AI-prestatie analyses.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {telemetry?.shared && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#34d399' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse-dot 2s infinite' }} />
              Data wordt gedeeld met Locra (Gratis EDU)
            </div>
          )}
          <button className="btn" style={{ background: 'var(--bg-surface)' }} onClick={exportCSV} disabled={csvExporting}>
            {csvExporting ? '⏳ Exporteren...' : '📥 Exporteer CSV'}
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overzicht ── */}
      {activeTab === 'overzicht' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Totaal Prompts" value={analytics?.totalPrompts || 0} icon="💬" color="#6366f1" />
            <StatCard label="Gesprekken" value={analytics?.totalConversations || 0} icon="🗨️" color="#8b5cf6" />
            <StatCard label="Tokens Gebruikt" value={formatTokens(analytics?.totalTokens || 0)} icon="⚡" color="#3b82f6" />
            <StatCard label="Gem. Latency" value={`${analytics?.avgLatencyMs || 0} ms`} icon="⏱️" color={analytics?.avgLatencyMs < 1000 ? '#10b981' : '#f59e0b'} sub={analytics?.avgLatencyMs < 500 ? 'Uitstekend' : analytics?.avgLatencyMs < 1500 ? 'Goed' : 'Verbetering nodig'} />
            <StatCard label="Actieve Gebruikers" value={totalPersons} icon="👤" color="#14b8a6" />
          </div>

          {/* Daily Usage Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>📅 Dagelijks Gebruik (afgelopen 30 dagen)</h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.dailyTimeline || []}>
                  <defs>
                    <linearGradient id="gradientPrompts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '0.85rem' }} />
                  <Area type="monotone" dataKey="prompts" stroke="#6366f1" strokeWidth={2} fill="url(#gradientPrompts)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Model Distribution */}
          {analytics?.modelDistribution?.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>🤖 Model Verdeling</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.modelDistribution} dataKey="count" nameKey="model" cx="50%" cy="50%" outerRadius={90} innerRadius={50} strokeWidth={0}>
                        {analytics.modelDistribution.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {analytics.modelDistribution.slice(0, 6).map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{m.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Onderwerpen ── */}
      {activeTab === 'onderwerpen' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Category Distribution */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>📂 Onderwerp Categorieën</h3>
              {analytics?.topicCategories?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analytics.topicCategories.map((cat: any, i: number) => {
                    const maxCount = analytics.topicCategories[0]?.count || 1;
                    const pct = Math.round((cat.count / maxCount) * 100);
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {CATEGORY_ICONS[cat.category] || '📝'} {cat.category}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.count} gesprekken</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: '3px', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nog geen onderwerpdata beschikbaar.</p>
              )}
            </div>

            {/* Category Pie Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>📊 Verdeling per Vak</h3>
              {analytics?.topicCategories?.length > 0 ? (
                <div style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.topicCategories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={100} strokeWidth={0} label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`}>
                        {analytics.topicCategories.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen data.</p>
              )}
            </div>
          </div>

          {/* Popular Keywords */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>🔤 Populairste Onderwerpen / Woorden</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(analytics?.topTopicsGlobal || []).map((t: any, i: number) => {
                const maxCount = analytics?.topTopicsGlobal?.[0]?.count || 1;
                const scale = 0.7 + (t.count / maxCount) * 0.6;
                return (
                  <span key={i} style={{
                    background: `${COLORS[i % COLORS.length]}22`,
                    color: COLORS[i % COLORS.length],
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: `${scale}rem`,
                    fontWeight: 600,
                    border: `1px solid ${COLORS[i % COLORS.length]}33`,
                    transition: 'transform 0.2s',
                    cursor: 'default'
                  }}>
                    {t.topic} <span style={{ opacity: 0.6 }}>({t.count})</span>
                  </span>
                );
              })}
              {(!analytics?.topTopicsGlobal || analytics.topTopicsGlobal.length === 0) && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nog geen onderwerpdata beschikbaar.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: Model Prestaties ── */}
      {activeTab === 'modellen' && (
        <>
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>⚡ Model Latency Benchmark</h3>
            {analytics?.modelDistribution?.length > 0 ? (
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.modelDistribution.filter((m: any) => m.avgLatency !== null)} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit=" ms" />
                    <YAxis type="category" dataKey="model" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} formatter={(v: any) => [`${v} ms`, 'Gem. Latency']} />
                    <Bar dataKey="avgLatency" radius={[0, 4, 4, 0]}>
                      {analytics.modelDistribution.filter((m: any) => m.avgLatency !== null).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nog geen latency data beschikbaar.</p>
            )}
          </div>

          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-surface-hover)' }}>
                <tr>
                  <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Model</th>
                  <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Gesprekken</th>
                  <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aandeel</th>
                  <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Gem. Latency</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.modelDistribution || []).map((m: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{m.fullModel}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{m.count}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, maxWidth: '100px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                          <div style={{ height: '100%', width: `${m.percentage}%`, background: COLORS[i % COLORS.length], borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{m.percentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}><LatencyBadge ms={m.avgLatency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: Klassen / Groepen ── */}
      {(activeTab === 'klassen' || activeTab === 'groepen') && (() => {
        const data = activeTab === 'klassen' ? classData : groupData;
        const personLabel = activeTab === 'klassen' ? 'leerlingen' : 'leden';
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <StatCard label={`Totaal Prompts`} value={data.reduce((a, r) => a + r.totalPrompts, 0)} icon="💬" color="#6366f1" />
              <StatCard label={`Aantal ${personLabel}`} value={data.reduce((a, r) => a + (r.students || r.members || 0), 0)} icon="👤" color="#8b5cf6" />
              <StatCard label="Meest gebruikt model" value={data[0]?.primaryModel || 'N/A'} icon="🤖" color="#10b981" />
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>📊 Prompts per {activeTab === 'klassen' ? 'Klas' : 'Groep'}</h3>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Bar dataKey="totalPrompts" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-surface-hover)' }}>
                  <tr>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Naam</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aantal {personLabel}</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Totaal Prompts</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Gem. per persoon</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tokens</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Primair Model</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Top Onderwerpen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: '1rem' }}>{row.students || row.members || 0}</td>
                      <td style={{ padding: '1rem' }}>{row.totalPrompts.toLocaleString()}</td>
                      <td style={{ padding: '1rem' }}>{row.avgPrompts}</td>
                      <td style={{ padding: '1rem' }}>{row.totalTokens}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {row.primaryModel}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {row.topTopics?.slice(0, 5).map((t: any, idx: number) => (
                            <span key={idx} style={{ background: `${COLORS[idx % COLORS.length]}18`, color: COLORS[idx % COLORS.length], padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                              {t.topic}
                            </span>
                          ))}
                          {(!row.topTopics || row.topTopics.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Geen {activeTab} gevonden.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {/* ── TAB: Systeem & Telemetrie ── */}
      {activeTab === 'systeem' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Hardware */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>🖥️ Server Hardware</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Besturingssysteem', value: `${telemetry?.hardware?.platform || '?'} (${telemetry?.hardware?.arch || '?'})` },
                { label: 'CPU', value: telemetry?.hardware?.cpuModel || '?' },
                { label: 'CPU Cores', value: `${telemetry?.hardware?.cpus || '?'} cores` },
                { label: 'Geheugen (Totaal)', value: `${telemetry?.hardware?.totalMemGB || '?'} GB` },
                { label: 'Geheugen (Vrij)', value: `${telemetry?.hardware?.freeMemGB || '?'} GB`, color: 'var(--success)' },
                { label: 'Geheugen Gebruik', value: `${telemetry?.hardware?.memUsagePercent || 0}%`, color: (telemetry?.hardware?.memUsagePercent || 0) > 80 ? '#ef4444' : '#10b981' },
                { label: 'Load Average (1m/5m/15m)', value: (telemetry?.hardware?.loadAvg || []).join(' / ') },
                { label: 'Server Uptime', value: `${telemetry?.hardware?.uptimeDays || 0} dagen` },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: item.color || 'inherit' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>📡 Telemetrie Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Licentie</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', color: telemetry?.licenseTier === 'free' ? '#f59e0b' : '#10b981' }}>
                    {telemetry?.licenseTier || 'free'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Data Delen</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: telemetry?.shared ? '#34d399' : '#64748b' }}>
                    {telemetry?.shared ? '✅ Actief (Gratis EDU)' : '🔒 Uitgeschakeld'}
                  </span>
                </div>
              </div>
            </div>

            {telemetry?.shared && (
              <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid #34d399' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#34d399' }}>ℹ️ Wat wordt er gedeeld?</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                  Met het gratis EDU-account worden de volgende <strong>geanonimiseerde</strong> gegevens automatisch gedeeld met Locra:
                </p>
                <ul style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.8, paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                  <li>Gemiddelde latency per AI model (benchmark data)</li>
                  <li>Hardware specificaties (CPU, RAM, OS)</li>
                  <li>Model gebruik verdeling (welke modellen populair zijn)</li>
                  <li>Onderwerp categorieën (welke vakken worden besproken)</li>
                  <li>Totaal aantal prompts en tokens (volume statistieken)</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  Er worden <strong>geen</strong> persoonlijke gesprekken, namen of inhoud gedeeld. Upgrade naar een betaald plan om data sharing uit te schakelen.
                </p>
              </div>
            )}

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>⚡ Performance Overview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Gem. Latency</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: (analytics?.avgLatencyMs || 0) < 1000 ? '#10b981' : '#f59e0b' }}>
                    {analytics?.avgLatencyMs || 0}<span style={{ fontSize: '0.8rem', color: '#94a3b8' }}> ms</span>
                  </p>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Modellen Actief</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {analytics?.modelDistribution?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
