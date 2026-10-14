import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, LineChart, Line 
} from 'recharts';
import { 
  Clock, Flame, Moon, Sparkles, Download, 
  BookOpen, Users, Cpu, CheckCircle2, AlertCircle, Search, 
  Timer, School, ArrowUpRight, Check
} from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6'];
const CATEGORY_ICONS: Record<string, string> = {
  'Wiskunde': '📐', 'Taal & Literatuur': '📚', 'Programmeren': '💻', 'Wetenschap': '🔬',
  'Geschiedenis': '🏛️', 'Aardrijkskunde': '🌍', 'Engels': '🇬🇧', 'Creatief': '🎨', 'Overig': '📝'
};

const DAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const DAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

type PeriodKey = 'today' | '7d' | '30d' | 'schoolyear';

function StatCard({ 
  label, 
  value, 
  sub, 
  color, 
  icon 
}: { 
  label: string; 
  value: string | number; 
  sub?: string; 
  color: string; 
  icon: React.ReactNode 
}) {
  return (
    <div 
      className="glass-panel" 
      style={{ 
        padding: '1.25rem', 
        position: 'relative', 
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(18, 20, 32, 0.65)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div 
        style={{ 
          position: 'absolute', 
          top: '-20px', 
          right: '-20px', 
          width: '90px', 
          height: '90px', 
          background: color, 
          filter: 'blur(45px)', 
          opacity: 0.18 
        }} 
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {label}
        </span>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '8px', 
          background: `${color}18`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: color 
        }}>
          {icon}
        </div>
      </div>
      <p style={{ 
        fontSize: '1.85rem', 
        fontWeight: 800, 
        background: `linear-gradient(135deg, #ffffff, ${color})`, 
        WebkitBackgroundClip: 'text', 
        WebkitTextFillColor: 'transparent', 
        lineHeight: 1.1,
        letterSpacing: '-0.02em'
      }}>
        {typeof value === 'number' ? value.toLocaleString('nl-NL') : value}
      </p>
      {sub && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{sub}</p>}
    </div>
  );
}

function LatencyBadge({ ms }: { ms: number | null }) {
  if (ms === null || ms === undefined) return <span style={{ color: '#64748b', fontSize: '0.75rem' }}>—</span>;
  const color = ms < 500 ? '#10b981' : ms < 1500 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{ 
      color, 
      fontWeight: 700, 
      fontSize: '0.82rem',
      background: `${color}15`,
      padding: '3px 8px',
      borderRadius: '6px',
      border: `1px solid ${color}30`
    }}>
      {ms.toLocaleString('nl-NL')} ms
    </span>
  );
}

export default function ReportingPanel() {
  const [activeTab, setActiveTab] = useState<'tijdstippen' | 'modellen' | 'gebruikers' | 'slimcheck' | 'onderwerpen' | 'systeem'>('tijdstippen');
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const token = useAuthStore(state => state.token);
  
  const [classData, setClassData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [csvExporting, setCsvExporting] = useState(false);

  // Subfilters & Search
  const [memberViewType, setMemberViewType] = useState<'klassen' | 'groepen'>('klassen');
  const [searchFilter, setSearchFilter] = useState('');
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{ day: number; hour: number; count: number } | null>(null);

  const fetchData = (selectedPeriod: PeriodKey) => {
    setLoading(true);
    fetch(`/api/admin/reporting?period=${selectedPeriod}`, {
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
  };

  useEffect(() => {
    fetchData(period);
  }, [token, period]);

  const formatTokens = (t: number) => {
    if (!t) return '0';
    if (t > 1_000_000) return (t / 1_000_000).toFixed(1) + 'M';
    if (t > 1_000) return (t / 1_000).toFixed(1) + 'K';
    return t.toLocaleString('nl-NL');
  };

  const exportCSV = () => {
    setCsvExporting(true);
    try {
      const lines: string[] = [];
      const pLabel = period === 'today' ? 'Vandaag' : period === '7d' ? '7 Dagen' : period === 'schoolyear' ? 'Schooljaar' : '30 Dagen';

      lines.push(`LOCRA ANALYTICS EXPORT - ${pLabel} (${new Date().toLocaleDateString('nl-NL')})`);
      lines.push('');
      lines.push('--- ALGEMEEN OVERZICHT ---');
      lines.push(`Totaal Prompts;${analytics?.totalPrompts || 0}`);
      lines.push(`Totaal Gesprekken;${analytics?.totalConversations || 0}`);
      lines.push(`Totaal Tokens;${analytics?.totalTokens || 0}`);
      lines.push(`Gemiddelde Latency (ms);${analytics?.avgLatencyMs || 0}`);
      lines.push(`Piek Uur;${analytics?.peakHour?.label || 'N/A'};${analytics?.peakHour?.prompts || 0} prompts`);
      lines.push(`Rustigste Uur;${analytics?.quietestHour?.label || 'N/A'};${analytics?.quietestHour?.prompts || 0} prompts`);
      lines.push('');

      lines.push('--- ACTIVITEIT PER UUR (0-23) ---');
      lines.push('Uur;Prompts;Tokens');
      (analytics?.hourlyUsage || []).forEach((h: any) => {
        lines.push(`${h.label};${h.prompts};${h.tokens}`);
      });
      lines.push('');

      lines.push('--- MODELLEN VERDELING ---');
      lines.push('Model;Prompts;Tokens;Aandeel %;Gem Latency (ms)');
      (analytics?.modelDistribution || []).forEach((m: any) => {
        lines.push(`"${m.fullModel}";${m.count};${m.tokens || 0};${m.percentage}%;${m.avgLatency || 'N/A'}`);
      });
      lines.push('');

      lines.push('--- SLIMCHECK NAKIJKSTATISTIEKEN ---');
      const sc = analytics?.slimCheckStats;
      lines.push(`Sessies / Toetsen;${sc?.totalSessions || 0}`);
      lines.push(`Scans & Leerlingbladen;${sc?.totalScans || 0}`);
      lines.push(`Nagekeken Antwoorden;${sc?.totalResponses || 0}`);
      lines.push(`Direct Gematcht (Accuraat);${sc?.autoMatchRate || 0}%`);
      lines.push(`Handmatige Review Docent;${sc?.manualReviewRate || 0}%`);
      lines.push(`Geschatte Uren Bespaard;${sc?.estimatedHoursSaved || 0}`);
      lines.push('');

      lines.push('--- KLASSEN ---');
      lines.push('Klas;Aantal Leerlingen;Totaal Prompts;Gemiddeld p.p.;Tokens;Primair Model;Top Onderwerpen');
      classData.forEach(r => {
        lines.push(`"${r.name}";${r.students};${r.totalPrompts};${r.avgPrompts};${r.totalTokens};"${r.primaryModel}";"${(r.topTopics || []).map((t: any) => t.topic).join(', ')}"`);
      });
      lines.push('');

      lines.push('--- GROEPEN ---');
      lines.push('Groep;Leden;Totaal Prompts;Gemiddeld p.p.;Tokens;Primair Model;Top Onderwerpen');
      groupData.forEach(r => {
        lines.push(`"${r.name}";${r.members};${r.totalPrompts};${r.avgPrompts};${r.totalTokens};"${r.primaryModel}";"${(r.topTopics || []).map((t: any) => t.topic).join(', ')}"`);
      });

      const csvContent = '\uFEFF' + lines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `locra-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvExporting(false);
    }
  };

  const tabs = [
    { key: 'tijdstippen', label: '🕒 Piekuren & Tijdstippen', icon: <Clock size={16} /> },
    { key: 'modellen', label: '🤖 Modellen & Tokens', icon: <Cpu size={16} /> },
    { key: 'gebruikers', label: '👥 Gebruikers & Klassen', icon: <Users size={16} /> },
    { key: 'slimcheck', label: '📝 SlimCheck AI Nakijken', icon: <CheckCircle2 size={16} /> },
    { key: 'onderwerpen', label: '📚 Schoolvakken & Topics', icon: <BookOpen size={16} /> },
    { key: 'systeem', label: '💻 Systeem & Hardware', icon: <School size={16} /> },
  ];

  // 7x24 Heatmap max value calculation for color scaling
  const heatmapMax = useMemo(() => {
    if (!analytics?.heatmap7x24) return 1;
    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const val = analytics.heatmap7x24[d]?.[h] || 0;
        if (val > max) max = val;
      }
    }
    return max || 1;
  }, [analytics?.heatmap7x24]);

  // Filtered classes or groups
  const filteredList = useMemo(() => {
    const list = memberViewType === 'klassen' ? classData : groupData;
    if (!searchFilter.trim()) return list;
    const term = searchFilter.toLowerCase();
    return list.filter(item => 
      item.name.toLowerCase().includes(term) ||
      (item.primaryModel && item.primaryModel.toLowerCase().includes(term))
    );
  }, [memberViewType, classData, groupData, searchFilter]);

  // Timeslot Pie data
  const timeslotPieData = useMemo(() => {
    const ts = analytics?.timeSlotBreakdown || { schoolHours: 0, homeworkHours: 0, nightHours: 0 };
    return [
      { name: 'Schooluren (08:30-16:30)', value: ts.schoolHours, color: '#6366f1' },
      { name: 'Huiswerktijd (16:30-22:00)', value: ts.homeworkHours, color: '#10b981' },
      { name: 'Nacht / Avond (22:00-08:30)', value: ts.nightHours, color: '#8b5cf6' },
    ];
  }, [analytics?.timeSlotBreakdown]);

  return (
    <div className="panel-content" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* ── TOP HEADER & CONTROLS ── */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          flexWrap: 'wrap', 
          gap: '1rem',
          marginBottom: '1.75rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.35))',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a78bfa'
            }}>
              <Flame size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Analytics & Statistieken
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  background: 'rgba(99,102,241,0.15)', 
                  color: '#818cf8', 
                  border: '1px solid rgba(99,102,241,0.3)',
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  textTransform: 'uppercase'
                }}>
                  Live Inzichten
                </span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                Diepgaande piekuren analyse, AI model distributie, SlimCheck tijdswinst en gebruikersactiviteit.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Period selector */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(255,255,255,0.04)', 
            border: '1px solid rgba(255,255,255,0.08)', 
            borderRadius: '10px', 
            padding: '3px' 
          }}>
            {[
              { key: 'today', label: 'Vandaag' },
              { key: '7d', label: '7 Dagen' },
              { key: '30d', label: '30 Dagen' },
              { key: 'schoolyear', label: 'Dit Schooljaar' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key as PeriodKey)}
                style={{
                  background: period === p.key ? 'var(--primary)' : 'transparent',
                  color: period === p.key ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: period === p.key ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button 
            className="btn" 
            onClick={exportCSV} 
            disabled={csvExporting || loading}
            style={{ 
              background: 'rgba(255,255,255,0.06)', 
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <Download size={15} />
            {csvExporting ? 'Exporteren...' : 'Exporteer CSV'}
          </button>
        </div>
      </div>

      {/* ── TOP KPI HERO CARDS ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.75rem' 
      }}>
        <StatCard 
          label="Totaal AI Prompts" 
          value={analytics?.totalPrompts || 0} 
          icon={<Clock size={18} />} 
          color="#6366f1" 
          sub={`${(analytics?.totalConversations || 0).toLocaleString('nl-NL')} unieke sessies`}
        />
        <StatCard 
          label="🔥 Drukste Piek Uur" 
          value={analytics?.peakHour?.label || '11:00'} 
          icon={<Flame size={18} />} 
          color="#f59e0b" 
          sub={`${analytics?.peakHour?.prompts || 0} prompts op het hoogtepunt`}
        />
        <StatCard 
          label="🌙 Rustigste Uur" 
          value={analytics?.quietestHour?.label || '04:00'} 
          icon={<Moon size={18} />} 
          color="#8b5cf6" 
          sub={`${analytics?.quietestHour?.prompts || 0} prompts tijdens daluren`}
        />
        <StatCard 
          label="Tokens & Snelheid" 
          value={formatTokens(analytics?.totalTokens || 0)} 
          icon={<Sparkles size={18} />} 
          color="#10b981" 
          sub={`Gem. reactietijd: ${analytics?.avgLatencyMs || 0} ms`}
        />
        <StatCard 
          label="Docententijd Bespaard" 
          value={`${analytics?.slimCheckStats?.estimatedHoursSaved || 0} uur`} 
          icon={<CheckCircle2 size={18} />} 
          color="#ec4899" 
          sub={`${analytics?.slimCheckStats?.totalResponses || 0} antwoorden nagekeken`}
        />
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div style={{ 
        display: 'flex', 
        gap: '0.4rem', 
        marginBottom: '1.75rem', 
        borderBottom: '1px solid rgba(255,255,255,0.08)', 
        overflowX: 'auto',
        paddingBottom: '0' 
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              background: activeTab === t.key ? 'rgba(99,102,241,0.12)' : 'transparent',
              border: 'none',
              color: activeTab === t.key ? '#818cf8' : 'var(--text-secondary)',
              padding: '0.85rem 1.15rem',
              fontSize: '0.88rem',
              fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LOADING SPINNER ── */}
      {loading ? (
        <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', border: '3px solid rgba(99,102,241,0.25)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Analytics data berekenen voor geselecteerde periode...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: PIEKUREN & TIJDSTIPPEN (HOURLY / TEMPORAL ANALYSIS)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'tijdstippen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* 24-Hour Barchart */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={19} color="#6366f1" />
                      24-Uurs Activiteit (Tijdens welke uren wordt AI het meest gebruikt?)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                      Piekuren gemarkeerd in amber. Zie direct wanneer de server en modellen het zwaarst worden belast.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#6366f1' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Normaal Gebruik</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>Piek Uur ({analytics?.peakHour?.label})</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.hourlyUsage || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        interval={1}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#0f172a', 
                          border: '1px solid rgba(255,255,255,0.12)', 
                          borderRadius: '8px', 
                          fontSize: '0.82rem',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                        }}
                        formatter={(val: any, name: any) => [
                          name === 'prompts' ? `${val} prompts` : formatTokens(val), 
                          name === 'prompts' ? 'AI Prompts' : 'Tokens'
                        ]}
                        labelFormatter={(lbl) => `Tijdstip: ${lbl} - ${(parseInt(lbl) + 1).toString().padStart(2, '0')}:00`}
                      />
                      <Bar dataKey="prompts" radius={[4, 4, 0, 0]}>
                        {(analytics?.hourlyUsage || []).map((entry: any, index: number) => {
                          const isPeak = entry.hour === analytics?.peakHour?.hour && entry.prompts > 0;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isPeak ? '#f59e0b' : '#6366f1'} 
                              style={{ transition: 'all 0.3s ease' }}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two Column: Schooltijd vs Huiswerktijd & Piekuren Samenvatting */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* Donut Chart: Schooluren vs Huiswerkuren */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    🏫 Schooltijd vs. Huiswerktijd
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Verhouding van AI interacties tijdens lesuren versus buitenschoolse uren.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={timeslotPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          strokeWidth={0}
                        >
                          {timeslotPieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '0.8rem' }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
                    {timeslotPieData.map((slot, i) => {
                      const total = timeslotPieData.reduce((acc, curr) => acc + curr.value, 0);
                      const pct = total > 0 ? Math.round((slot.value / total) * 100) : 0;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: slot.color }} />
                            <span>{slot.name}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: slot.color }}>
                            {slot.value.toLocaleString('nl-NL')} prompts ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Piek vs Daluren Detail Card */}
                <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                      ⚡ Conclusies & Piekbelasting
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                      Capaciteitsinzichten voor docenten en systeembeheerders.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ 
                        padding: '1rem', 
                        borderRadius: '10px', 
                        background: 'rgba(245, 158, 11, 0.08)', 
                        border: '1px solid rgba(245, 158, 11, 0.2)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem' }}>
                          <Flame size={17} /> Piek Uur: {analytics?.peakHour?.label}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
                          Tijdens dit uur piekt de AI interactie met <strong>{analytics?.peakHour?.prompts} vragen</strong>. Zorg dat voldoende Ollama nodes of VRAM beschikbaar zijn rond dit tijdstip.
                        </p>
                      </div>

                      <div style={{ 
                        padding: '1rem', 
                        borderRadius: '10px', 
                        background: 'rgba(139, 92, 246, 0.08)', 
                        border: '1px solid rgba(139, 92, 246, 0.2)' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa', fontWeight: 700, fontSize: '0.88rem' }}>
                          <Moon size={17} /> Rustigste Moment: {analytics?.quietestHour?.label}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
                          Ideaal tijdslot voor geautomatiseerde back-ups, model downloads of offline batchverwerkingen ({analytics?.quietestHour?.prompts} prompts).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    marginTop: '1.25rem',
                    padding: '0.85rem', 
                    borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.03)', 
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Timer size={16} color="#6366f1" />
                    <span>Gemiddelde wachttijd per prompt op het piekuur: <strong>{analytics?.avgLatencyMs || 0} ms</strong></span>
                  </div>
                </div>
              </div>

              {/* 7x24 Heatmap Grid (Maandag - Zondag x 00:00 - 23:00) */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🔥 7x24 Activiteit Heatmap (Weekdag & Uur Matrix)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                      Beweeg over de tegels om het exacte aantal prompts per dag en tijdstip te bekijken.
                    </p>
                  </div>
                  
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>0</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)' }} />
                      <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(99,102,241,0.25)' }} />
                      <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(99,102,241,0.55)' }} />
                      <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(139,92,246,0.85)' }} />
                      <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#f59e0b' }} />
                    </div>
                    <span>Piek ({heatmapMax})</span>
                  </div>
                </div>

                {/* Heatmap Matrix */}
                <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  <div style={{ minWidth: '780px' }}>
                    {/* Hour Column Headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(24, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      <div />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div 
                          key={h} 
                          style={{ 
                            fontSize: '0.68rem', 
                            color: '#64748b', 
                            textAlign: 'center', 
                            fontWeight: 600 
                          }}
                        >
                          {h % 2 === 0 ? `${h}u` : ''}
                        </div>
                      ))}
                    </div>

                    {/* Day Rows */}
                    {DAY_LABELS.map((dayName, dayIdx) => (
                      <div 
                        key={dayIdx} 
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '48px repeat(24, 1fr)', 
                          gap: '4px', 
                          marginBottom: '4px',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                          {DAY_SHORT[dayIdx]}
                        </span>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const count = analytics?.heatmap7x24?.[dayIdx]?.[hour] || 0;
                          const ratio = count / heatmapMax;
                          
                          let bg = 'rgba(255, 255, 255, 0.03)';
                          let border = '1px solid rgba(255, 255, 255, 0.04)';
                          if (count > 0) {
                            if (ratio >= 0.8) {
                              bg = '#f59e0b';
                              border = '1px solid rgba(245, 158, 11, 0.9)';
                            } else if (ratio >= 0.5) {
                              bg = 'rgba(139, 92, 246, 0.85)';
                              border = '1px solid rgba(139, 92, 246, 0.9)';
                            } else if (ratio >= 0.25) {
                              bg = 'rgba(99, 102, 241, 0.55)';
                              border = '1px solid rgba(99, 102, 241, 0.6)';
                            } else {
                              bg = 'rgba(99, 102, 241, 0.25)';
                              border = '1px solid rgba(99, 102, 241, 0.3)';
                            }
                          }

                          return (
                            <div
                              key={hour}
                              onMouseEnter={() => setHoveredHeatmapCell({ day: dayIdx, hour, count })}
                              onMouseLeave={() => setHoveredHeatmapCell(null)}
                              title={`${dayName} om ${hour}:00 - ${count} prompts`}
                              style={{
                                height: '24px',
                                borderRadius: '4px',
                                background: bg,
                                border,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                transform: (hoveredHeatmapCell?.day === dayIdx && hoveredHeatmapCell?.hour === hour) ? 'scale(1.2)' : 'none',
                                zIndex: (hoveredHeatmapCell?.day === dayIdx && hoveredHeatmapCell?.hour === hour) ? 10 : 1
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Heatmap Tooltip Display */}
                {hoveredHeatmapCell && (
                  <div style={{ 
                    marginTop: '0.75rem', 
                    padding: '8px 14px', 
                    background: 'rgba(99,102,241,0.15)', 
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.82rem'
                  }}>
                    <span style={{ fontWeight: 700, color: '#fff' }}>
                      📅 {DAY_LABELS[hoveredHeatmapCell.day]} om {hoveredHeatmapCell.hour}:00
                    </span>
                    <span style={{ color: '#a78bfa' }}>
                      💬 <strong>{hoveredHeatmapCell.count}</strong> AI interacties
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: MODELLEN & TOKENS
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'modellen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Model Usage Pie Chart */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    🤖 Model Verdeling
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Aandeel per actief LLM / vision model in deze organisatie.
                  </p>
                  
                  {analytics?.modelDistribution?.length > 0 ? (
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.modelDistribution}
                            dataKey="count"
                            nameKey="fullModel"
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            innerRadius={55}
                            strokeWidth={0}
                          >
                            {analytics.modelDistribution.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '0.8rem' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen data beschikbaar.</p>
                  )}
                </div>

                {/* Model Latency Benchmark */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    ⚡ Gemiddelde Reactietijd (Latency)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Snelheid per model in milliseconden. Lager is sneller.
                  </p>

                  {analytics?.modelDistribution?.length > 0 ? (
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.modelDistribution.filter((m: any) => m.avgLatency !== null)}
                          layout="vertical"
                          margin={{ left: 100, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit=" ms" />
                          <YAxis type="category" dataKey="model" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }} 
                            formatter={(v: any) => [`${v} ms`, 'Latency']} 
                          />
                          <Bar dataKey="avgLatency" radius={[0, 4, 4, 0]}>
                            {analytics.modelDistribution.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen latency data.</p>
                  )}
                </div>
              </div>

              {/* Models Table */}
              <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>AI Model</th>
                      <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Prompts</th>
                      <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Tokens Gebruikt</th>
                      <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Aandeel</th>
                      <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Reactietijd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.modelDistribution || []).map((m: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: COLORS[i % COLORS.length] }} />
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.fullModel}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>{m.count.toLocaleString('nl-NL')}</td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatTokens(m.tokens)}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, maxWidth: '100px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${m.percentage}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{m.percentage}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}><LatencyBadge ms={m.avgLatency} /></td>
                      </tr>
                    ))}
                    {(!analytics?.modelDistribution || analytics.modelDistribution.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Nog geen modelgebruik geregistreerd.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: GEBRUIKERS & KLASSEN (ROLES, CLASSES & GROUPS)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'gebruikers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Role Cards Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🎓 Leerlingen</span>
                    <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                      {analytics?.roleUsage?.student?.activeUsers || 0} actieve accounts
                    </span>
                  </div>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0' }}>
                    {(analytics?.roleUsage?.student?.prompts || 0).toLocaleString('nl-NL')}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>prompts</span>
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {formatTokens(analytics?.roleUsage?.student?.tokens || 0)} tokens gebruikt
                  </p>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>👨‍🏫 Docenten</span>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                      {analytics?.roleUsage?.teacher?.activeUsers || 0} actieve accounts
                    </span>
                  </div>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0' }}>
                    {(analytics?.roleUsage?.teacher?.prompts || 0).toLocaleString('nl-NL')}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>prompts</span>
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {formatTokens(analytics?.roleUsage?.teacher?.tokens || 0)} tokens gebruikt
                  </p>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🛡️ Beheerders</span>
                    <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                      {analytics?.roleUsage?.admin?.activeUsers || 0} actieve accounts
                    </span>
                  </div>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0' }}>
                    {(analytics?.roleUsage?.admin?.prompts || 0).toLocaleString('nl-NL')}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>prompts</span>
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {formatTokens(analytics?.roleUsage?.admin?.tokens || 0)} tokens gebruikt
                  </p>
                </div>
              </div>

              {/* Klassen & Groepen Selector & Table */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setMemberViewType('klassen')}
                      className="btn"
                      style={{
                        background: memberViewType === 'klassen' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                        color: memberViewType === 'klassen' ? '#fff' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '6px 14px'
                      }}
                    >
                      🎓 Klassen ({classData.length})
                    </button>
                    <button
                      onClick={() => setMemberViewType('groepen')}
                      className="btn"
                      style={{
                        background: memberViewType === 'groepen' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                        color: memberViewType === 'groepen' ? '#fff' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '6px 14px'
                      }}
                    >
                      👥 Groepen ({groupData.length})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder={`Zoek in ${memberViewType}...`}
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 32px',
                        fontSize: '0.82rem',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <tr>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Naam</th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {memberViewType === 'klassen' ? 'Leerlingen' : 'Leden'}
                        </th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Totaal Prompts</th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Gem. p.p.</th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Tokens</th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Primair Model</th>
                        <th style={{ padding: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Top Onderwerpen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.85rem', fontWeight: 600, fontSize: '0.88rem' }}>{row.name}</td>
                          <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>{row.students || row.members || 0}</td>
                          <td style={{ padding: '0.85rem', fontSize: '0.85rem', fontWeight: 600 }}>{row.totalPrompts.toLocaleString('nl-NL')}</td>
                          <td style={{ padding: '0.85rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{row.avgPrompts}</td>
                          <td style={{ padding: '0.85rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{row.totalTokens}</td>
                          <td style={{ padding: '0.85rem' }}>
                            <span style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {row.primaryModel}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {row.topTopics?.slice(0, 4).map((t: any, idx: number) => (
                                <span key={idx} style={{ background: `${COLORS[idx % COLORS.length]}15`, color: COLORS[idx % COLORS.length], padding: '2px 7px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600 }}>
                                  {t.topic}
                                </span>
                              ))}
                              {(!row.topTopics || row.topTopics.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredList.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Geen {memberViewType} gevonden die voldoen aan de zoekopdracht.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: SLIMCHECK AI NAKIJKANALYTICS (HOURS SAVED & QUALITY METRICS)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'slimcheck' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Hero SlimCheck KPI banner */}
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '2rem', 
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(99,102,241,0.15))',
                  border: '1px solid rgba(236,72,153,0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1.5rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Sparkles size={16} /> SlimCheck Productiviteits Impact
                  </div>
                  <h3 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0.5rem 0' }}>
                    {(analytics?.slimCheckStats?.estimatedHoursSaved || 0).toLocaleString('nl-NL')} Uur Docententijd Bespaard
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, maxWidth: '650px', lineHeight: 1.6 }}>
                    Berekend op basis van 1.5 minuut gemiddelde nakijktijd per open vraag. Door AI-voorstellen en automatische OCR-correcties hoeft de docent alleen nog te verifiëren of bij te sturen.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.35)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#34d399' }}>
                      {analytics?.slimCheckStats?.autoMatchRate || 0}%
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>Auto-Match Ratio</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.35)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#60a5fa' }}>
                      {analytics?.slimCheckStats?.averageGrade ? `${analytics.slimCheckStats.averageGrade}` : '—'}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>Gemiddeld Cijfer</p>
                  </div>
                </div>
              </div>

              {/* Accuracy vs Manual Review Split */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    🎯 Nakijk-Kwaliteit & Verificatie
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                    Verhouding tussen antwoorden met hoge AI-zekerheid vs. vragen die handmatige docentenreview vereisten.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <CheckCircle2 size={16} color="#10b981" /> Direct Goedgekeurd (Hoge Zekerheid &ge; 80%)
                        </span>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{analytics?.slimCheckStats?.autoMatchRate || 0}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${analytics?.slimCheckStats?.autoMatchRate || 0}%`, background: '#10b981', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <AlertCircle size={16} color="#f59e0b" /> Docent Review Nodig (&lt; 80% of twijfel)
                        </span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>{analytics?.slimCheckStats?.manualReviewRate || 0}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${analytics?.slimCheckStats?.manualReviewRate || 0}%`, background: '#f59e0b', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                      <Check size={16} /> Human-in-the-Loop Waarborg
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                      Locra SlimCheck hanteert een strikt "Human-in-the-Loop" principe: cijfers worden pas definitief gepubliceerd nadat de docent het nakijkoverzicht heeft goedgekeurd.
                    </p>
                  </div>
                </div>

                {/* Volumes & Metrics Summary */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    📊 Volumes & Toetsactiviteit
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                    Totaaloverzicht van alle gedigitaliseerde toetsen en scans.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {[
                      { label: 'Aangemaakte Nakijksessies', val: analytics?.slimCheckStats?.totalSessions || 0, icon: '📋' },
                      { label: 'Scans & Leerlingbladen Verwerkt', val: analytics?.slimCheckStats?.totalScans || 0, icon: '📄' },
                      { label: 'Open Vragen Beoordeeld door AI', val: analytics?.slimCheckStats?.totalResponses || 0, icon: '✍️' },
                      { label: 'Gemiddeld Cijfer (Toetsen)', val: analytics?.slimCheckStats?.averageGrade ? `${analytics.slimCheckStats.averageGrade} / 10` : 'Nog niet berekend', icon: '🏆' },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{row.icon}</span> {row.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 5: SCHOOLVAKKEN & TOPICS
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'onderwerpen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Subject Categories */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    📂 Onderwerp Categorieën
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    AI-assistentie uitgesplitst per leervak.
                  </p>

                  {analytics?.topicCategories?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {analytics.topicCategories.map((cat: any, i: number) => {
                        const maxCount = analytics.topicCategories[0]?.count || 1;
                        const pct = Math.round((cat.count / maxCount) * 100);
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {CATEGORY_ICONS[cat.category] || '📝'} {cat.category}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.count} gesprekken</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: '3px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nog geen onderwerpdata beschikbaar.</p>
                  )}
                </div>

                {/* Subject Pie Chart */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    📊 Verdeling per Vak
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Procentuele aandelen van verschillende disciplines.
                  </p>

                  {analytics?.topicCategories?.length > 0 ? (
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={analytics.topicCategories} 
                            dataKey="count" 
                            nameKey="category" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={95} 
                            innerRadius={50}
                            strokeWidth={0}
                          >
                            {analytics.topicCategories.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen data.</p>
                  )}
                </div>
              </div>

              {/* Subject Trends Chart */}
              {analytics?.subjectTrends && Object.keys(analytics.subjectTrends).length > 0 && (
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    📈 Trendanalyse per Vak (Wekelijks)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Ontdek welke vakken opleven rond toetsperiodes of projectweken.
                  </p>

                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={Object.entries(analytics.subjectTrends).map(([week, counts]: [string, any]) => ({ week, ...counts })).sort((a, b) => a.week.localeCompare(b.week))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="week" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }} />
                        {Array.from(new Set(Object.values(analytics.subjectTrends).flatMap(obj => Object.keys(obj as object)))).map((subject, i) => (
                          <Line key={subject as string} type="monotone" dataKey={subject as string} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Popular Keywords Cloud */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                  🔤 Populairste Vraagtermen & Onderwerpen
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Meest voorkomende sleutelwoorden uit gesprekken van studenten en docenten.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                  {(analytics?.topTopicsGlobal || []).map((t: any, i: number) => (
                    <span 
                      key={i} 
                      style={{
                        background: `${COLORS[i % COLORS.length]}18`,
                        color: COLORS[i % COLORS.length],
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        border: `1px solid ${COLORS[i % COLORS.length]}33`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {t.topic} 
                      <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>({t.count})</span>
                    </span>
                  ))}
                  {(!analytics?.topTopicsGlobal || analytics.topTopicsGlobal.length === 0) && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nog geen trefwoorden geregistreerd.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 6: SYSTEEM & TELEMETRIE (HARDWARE & SYSTEM OVERVIEW)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'systeem' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {/* Server Hardware */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🖥️ Server Hardware & Resources
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Specificaties van de hostmachine waarop Locra Core draait.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    { label: 'Besturingssysteem', value: `${telemetry?.hardware?.platform || '?'} (${telemetry?.hardware?.arch || '?'})` },
                    { label: 'CPU Model', value: telemetry?.hardware?.cpuModel || '?' },
                    { label: 'CPU Cores', value: `${telemetry?.hardware?.cpus || '?'} cores` },
                    { label: 'Geheugen (Totaal)', value: `${telemetry?.hardware?.totalMemGB || '?'} GB` },
                    { label: 'Geheugen (Vrij)', value: `${telemetry?.hardware?.freeMemGB || '?'} GB`, color: 'var(--success)' },
                    { label: 'Geheugen Gebruik', value: `${telemetry?.hardware?.memUsagePercent || 0}%`, color: (telemetry?.hardware?.memUsagePercent || 0) > 80 ? '#ef4444' : '#10b981' },
                    { label: 'Load Average (1m/5m/15m)', value: (telemetry?.hardware?.loadAvg || []).join(' / ') },
                    { label: 'Server Uptime', value: `${telemetry?.hardware?.uptimeDays || 0} dagen` },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{item.label}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: item.color || 'inherit' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status & Telemetry details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    📡 Telemetrie & Licentiestatus
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                    Informatie over geaggregeerde benchmarking.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Licentie</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', color: telemetry?.licenseTier === 'free' ? '#f59e0b' : '#10b981' }}>
                        {telemetry?.licenseTier || 'free'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Data Delen</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: telemetry?.shared ? '#34d399' : '#64748b' }}>
                        {telemetry?.shared ? '✅ Actief (Gratis EDU geanonimiseerd)' : '🔒 Uitgeschakeld'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                    ⚡ Systeem Responsiviteit
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '10px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 0.25rem 0' }}>Gem. Latency</p>
                      <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: (analytics?.avgLatencyMs || 0) < 1000 ? '#10b981' : '#f59e0b' }}>
                        {analytics?.avgLatencyMs || 0}<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}> ms</span>
                      </p>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '10px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 0.25rem 0' }}>Modellen Actief</p>
                      <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#8b5cf6' }}>
                        {analytics?.modelDistribution?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
