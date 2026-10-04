import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

interface DashboardStats {
  users: number;
  models: number;
  knowledgeBases: number;
  conversations: number;
  classes: number;
  messages: number;
  totalCreditsUsed: number;
  todayMessages: number;
  weekMessages: number;
  apiCost: number;
  e2eEnabled: boolean;
  kennisnetEnabled: boolean;
  webSearchEnabled: boolean;
  creditsEnabled: boolean;
  recentActivity: { id: string; action: string; details?: string; createdAt: string; userName: string }[];
  topUsers: { id: string; displayName: string; username: string; creditsUsed: number; role: string }[];
  dailyData: { date: string; messages: number }[];
  installedModels: { id: string; displayName: string; ollamaName: string; isActive: boolean; routingTier: string }[];
  ollamaStatus: string;
  licenseTier: string;
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes('login')) return <>🔑</>;
  if (action.includes('backup')) return <>💾</>;
  if (action.includes('password')) return <>🔐</>;
  if (action.includes('user')) return <>👤</>;
  if (action.includes('model')) return <>🧠</>;
  if (action.includes('knowledge')) return <>📚</>;
  if (action.includes('settings')) return <>⚙️</>;
  if (action.includes('credit')) return <>⚡</>;
  return <>📋</>;
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    'user.login': 'Ingelogd',
    'user.created': 'Gebruiker aangemaakt',
    'user.deleted': 'Gebruiker verwijderd',
    'user.email-changed': 'E-mail gewijzigd',
    'user.password-reset': 'Wachtwoord gereset',
    'backup.downloaded': 'Backup gedownload',
    'backup.json-exported': 'JSON export gedaan',
    'model.installed': 'Model geïnstalleerd',
    'model.deleted': 'Model verwijderd',
    'settings.updated': 'Instellingen opgeslagen',
    'knowledge.document-uploaded': 'Document geüpload',
  };
  return map[action] || action;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function DashboardPanel() {
  const user = useAuthStore((state: any) => state.user);
  const token = useAuthStore((state: any) => state.token);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sysHealth, setSysHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/admin/system', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([dashData, sysData]) => {
      if (!dashData.error) setStats(dashData);
      if (!sysData.error) setSysHealth(sysData);
    }).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const maxDailyMessages = stats ? Math.max(...(stats.dailyData?.map((d: any) => d.messages) || [1]), 1) : 1;

  const tierColors: Record<string, string> = {
    'free': 'rgba(255,255,255,0.15)',
    'edu': 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'edu-plus': 'linear-gradient(135deg,#6366f1,#06b6d4)',
    'enterprise': 'linear-gradient(135deg,#f59e0b,#ef4444)',
  };
  const tierLabel: Record<string, string> = {
    'free': 'Free',
    'edu': 'EDU',
    'edu-plus': 'EDU Plus ⭐',
    'enterprise': 'Enterprise 🚀',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Dashboard laden...</span>
      </div>
    );
  }

  const hora = new Date().getHours();
  const greeting = hora < 12 ? 'Goedemorgen' : hora < 18 ? 'Goedemiddag' : 'Goedenavond';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            {greeting}, <span className="text-gradient">{user?.displayName?.split(' ')[0]}</span> 👋
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.4rem', marginBottom: 0, fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 1rem', borderRadius: '99px',
            background: stats?.ollamaStatus === 'online' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${stats?.ollamaStatus === 'online' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '0.8rem', fontWeight: 600,
            color: stats?.ollamaStatus === 'online' ? '#34d399' : '#f87171'
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: stats?.ollamaStatus === 'online' ? '#34d399' : '#f87171',
              boxShadow: `0 0 6px ${stats?.ollamaStatus === 'online' ? '#34d399' : '#f87171'}`
            }} />
            Ollama {stats?.ollamaStatus === 'online' ? 'Online' : 'Offline'}
          </div>
          <div style={{
            padding: '0.4rem 1rem', borderRadius: '99px',
            background: tierColors[stats?.licenseTier || 'free'],
            fontSize: '0.8rem', fontWeight: 700, color: '#fff'
          }}>
            {tierLabel[stats?.licenseTier || 'free']}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Gebruikers', value: stats?.users ?? 0, gradient: 'linear-gradient(135deg,#6366f1,#a5b4fc)', icon: '👥', to: '/admin/users' },
          { label: 'Gesprekken', value: stats?.conversations ?? 0, gradient: 'linear-gradient(135deg,#10b981,#6ee7b7)', icon: '💬', to: null },
          { label: 'Berichten Vandaag', value: stats?.todayMessages ?? 0, gradient: 'linear-gradient(135deg,#06b6d4,#7dd3fc)', icon: '🚀', to: null },
          { label: 'Klassen', value: stats?.classes ?? 0, gradient: 'linear-gradient(135deg,#ec4899,#fbcfe8)', icon: '🏫', to: '/admin/groups' },
          { label: 'AI Modellen', value: stats?.models ?? 0, gradient: 'linear-gradient(135deg,#8b5cf6,#ddd6fe)', icon: '🧠', to: '/admin/models' },
          { label: 'Credits Gebruikt', value: stats?.totalCreditsUsed ?? 0, gradient: 'linear-gradient(135deg,#f59e0b,#fde68a)', icon: '⚡', to: '/admin/quotas' },
        ].map(card => {
          const inner = (
            <div key={card.label} style={{
              padding: '1.5rem', background: 'rgba(255,255,255,0.03)',
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)',
              position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease',
              cursor: card.to ? 'pointer' : 'default',
            }} className={card.to ? 'hover-card' : ''}>
              <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: card.gradient, filter: 'blur(55px)', opacity: 0.25 }} />
              <div style={{ fontSize: '1.75rem', marginBottom: '0.6rem' }}>{card.icon}</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, background: card.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1, marginBottom: '0.3rem' }}>{card.value}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            </div>
          );
          return card.to ? <Link key={card.label} to={card.to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
        })}
      </div>

      {/* ── Middle Row: Chart + Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>

        {/* Daily Activity Chart */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>📈 Berichten — Afgelopen 7 dagen</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px' }}>
            {(stats?.dailyData || []).map((d, i) => {
              const pct = maxDailyMessages > 0 ? Math.round((d.messages / maxDailyMessages) * 100) : 0;
              const isToday = i === (stats?.dailyData?.length ?? 0) - 1;
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{d.messages}</span>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 4px 4px',
                    height: `${Math.max(pct, 3)}%`,
                    background: isToday ? 'linear-gradient(180deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.3)',
                    transition: 'height 0.5s ease',
                    boxShadow: isToday ? '0 0 12px rgba(99,102,241,0.4)' : 'none'
                  }} />
                  <span style={{ fontSize: '0.68rem', color: isToday ? '#a5b4fc' : 'rgba(255,255,255,0.35)', fontWeight: isToday ? 700 : 400 }}>{d.date}</span>
                </div>
              );
            })}
            {(stats?.dailyData || []).length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', margin: 'auto' }}>Nog geen data</div>
            )}
          </div>
        </div>

        {/* System Status Panel */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🖥️ Systeem Status</h3>
          {[
            { label: 'Ollama AI Engine', value: stats?.ollamaStatus === 'online', badge: stats?.ollamaStatus === 'online' ? 'Online' : 'Offline' },
            { label: 'E2E Encryptie', value: stats?.e2eEnabled, badge: stats?.e2eEnabled ? 'Actief' : 'Uit' },
            { label: 'Web Zoeken', value: stats?.webSearchEnabled, badge: stats?.webSearchEnabled ? 'Aan' : 'Uit' },
            { label: 'SSO Kennisnet', value: stats?.kennisnetEnabled, badge: stats?.kennisnetEnabled ? 'Actief' : 'Inactief' },
            { label: 'Credits Systeem', value: stats?.creditsEnabled, badge: stats?.creditsEnabled ? 'Aan' : 'Uit' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
              <span style={{
                padding: '2px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700,
                background: item.value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)',
                color: item.value ? '#34d399' : 'rgba(255,255,255,0.35)',
                border: `1px solid ${item.value ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`
              }}>{item.badge}</span>
            </div>
          ))}
          {sysHealth && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.15rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>RAM Gebruik</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 52, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99 }}>
                    <div style={{ width: `${sysHealth.memory?.usagePercentage}%`, height: '100%', borderRadius: 99, background: sysHealth.memory?.usagePercentage > 80 ? '#ef4444' : '#6366f1' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{sysHealth.memory?.usagePercentage}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>Uptime</span>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                  {Math.floor((sysHealth.uptime || 0) / 3600)}u {Math.floor(((sysHealth.uptime || 0) % 3600) / 60)}m
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>

        {/* Recent Activity Feed */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🛡️ Recente Activiteit</h3>
            <Link to="/admin/audit" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Alles →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(stats?.recentActivity || []).length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>Nog geen activiteit</div>
            ) : (stats?.recentActivity || []).slice(0, 8).map(a => (
              <div key={a.id} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.95rem', flexShrink: 0, marginTop: '1px' }}><ActivityIcon action={a.action} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatAction(a.action)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{a.userName} · {new Date(a.createdAt).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Users by Credits */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>⚡ Meest Actieve Gebruikers</h3>
            <Link to="/admin/quotas" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Beheer →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(stats?.topUsers || []).length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>Geen data</div>
            ) : (stats?.topUsers || []).map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
                  {u.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.75)' }}>{u.displayName}</div>
                  <MiniBar value={u.creditsUsed} max={Math.max(...(stats?.topUsers || [{ creditsUsed: 1 }]).map((x: any) => x.creditsUsed), 1)} color="#6366f1" />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{u.creditsUsed}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Models + Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🧠 AI Modellen</h3>
              <Link to="/admin/models" style={{ fontSize: '0.72rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Beheer →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(stats?.installedModels || []).slice(0, 4).map((m: any) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: m.isActive ? '#34d399' : 'rgba(255,255,255,0.2)', boxShadow: m.isActive ? '0 0 6px #34d399' : 'none' }} />
                  <span style={{ flex: 1, fontSize: '0.8rem', color: m.isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                  <span style={{ fontSize: '0.63rem', padding: '1px 6px', borderRadius: 99, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{m.routingTier || 'std'}</span>
                </div>
              ))}
              {(stats?.installedModels || []).length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Geen modellen geïnstalleerd</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              { to: '/admin/users', icon: '👤', label: 'Gebruikers beheren' },
              { to: '/admin/settings', icon: '⚙️', label: 'Instellingen' },
              { to: '/admin/reporting', icon: '📈', label: 'Rapportage' },
            ].map(link => (
              <Link key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.15s' }} className="hover-card">
                  <span style={{ fontSize: '0.9rem' }}>{link.icon}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{link.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
