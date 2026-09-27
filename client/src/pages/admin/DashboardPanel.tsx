import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

export default function DashboardPanel() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const [stats, setStats] = useState({ users: 0, models: 0, knowledgeBases: 0, conversations: 0, e2eEnabled: false, kennisnetEnabled: false });
  const [sysHealth, setSysHealth] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (!d.error) setStats(d); }).catch(() => {});
    fetch('/api/admin/system', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (!d.error) setSysHealth(d); }).catch(() => {});
  }, [token]);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateMsg('');
    try {
      const res = await fetch('/api/admin/system/update', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUpdateMsg(data.message || 'Update gestart!');
    } catch {
      setUpdateMsg('Fout bij starten update.');
    } finally {
      setUpdating(false);
    }
  };

  const memPct = sysHealth ? parseFloat(sysHealth.memory.usagePercentage) : 0;
  const memColor = memPct > 80 ? '#f87171' : memPct > 60 ? '#fb923c' : '#4ade80';

  const STAT_CARDS = [
    { label: 'Gebruikers', value: stats.users, icon: '◉', gradient: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', glow: 'rgba(124,92,252,0.3)', link: '/admin/users' },
    { label: 'Modellen', value: stats.models, icon: '⬡', gradient: 'linear-gradient(135deg, #38bdf8, #818cf8)', glow: 'rgba(56,189,248,0.3)', link: '/admin/models' },
    { label: 'Gesprekken', value: stats.conversations, icon: '◐', gradient: 'linear-gradient(135deg, #4ade80, #22d3ee)', glow: 'rgba(74,222,128,0.3)', link: '/admin/reporting' },
    { label: 'Kennisbanken', value: stats.knowledgeBases, icon: '◎', gradient: 'linear-gradient(135deg, #fb923c, #fbbf24)', glow: 'rgba(251,146,60,0.3)', link: '/admin/knowledge' },
  ];

  const QUICK_LINKS = [
    { to: '/admin/models', label: 'Model installeren', desc: 'Voeg een nieuw Ollama of API model toe', icon: '⬡', color: '#7c5cfc' },
    { to: '/admin/knowledge', label: 'Document uploaden', desc: 'Voeg bestanden toe aan een kennisbank', icon: '◎', color: '#38bdf8' },
    { to: '/admin/users', label: 'Gebruiker aanmaken', desc: 'Voeg een nieuwe leerling of docent toe', icon: '◉', color: '#4ade80' },
    { to: '/admin/customization', label: 'Uiterlijk aanpassen', desc: 'Pas kleuren, naam en AI karakter aan', icon: '◐', color: '#fb923c' },
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
          Welkom terug,{' '}
          <span style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {user?.displayName}
          </span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Hier is een overzicht van jouw Locra omgeving.
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {STAT_CARDS.map(card => (
          <Link key={card.label} to={card.link} style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s, border-color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', background: card.glow, filter: 'blur(40px)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', fontSize: '1.5rem', opacity: 0.6 }}>{card.icon}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, background: card.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {card.value}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Quick Links */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'rgba(255,255,255,0.7)' }}>Snel naar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {QUICK_LINKS.map(link => (
              <Link key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                <div
                  style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: link.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, color: link.color }}>
                    {link.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', marginBottom: '0.25rem' }}>{link.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{link.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* System Status + Update */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* System Health */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Engine Status</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: sysHealth ? '#4ade80' : '#fb923c', boxShadow: sysHealth ? '0 0 8px #4ade80' : 'none' }} />
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{sysHealth ? 'Online' : 'Laden...'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Memory bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Geheugen (RAM)</span>
                  <span style={{ fontSize: '0.8rem', color: memColor, fontWeight: 600 }}>{memPct.toFixed(0)}%</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${memPct}%`, background: memColor, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Uptime */}
              {sysHealth && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Uptime</span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                    {Math.floor(sysHealth.uptime / 3600)}u {Math.floor((sysHealth.uptime % 3600) / 60)}m
                  </span>
                </div>
              )}

              {/* CPU */}
              {sysHealth && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Load avg (1m)</span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{sysHealth.cpu.loadAverage[0].toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'SSO Kennisnet', active: stats.kennisnetEnabled },
                  { label: 'E2E Encryptie', active: stats.e2eEnabled },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                      background: s.active ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                      color: s.active ? '#4ade80' : '#f87171',
                      border: `1px solid ${s.active ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    }}>
                      {s.active ? 'ACTIEF' : 'INACTIEF'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Update Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.08), rgba(56,189,248,0.05))', borderRadius: '20px', border: '1px solid rgba(124,92,252,0.2)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff', margin: '0 0 0.35rem' }}>Software Update</h3>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Haalt de nieuwste code op van GitHub en herstart de server automatisch.
            </p>
            {updateMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', fontSize: '0.8rem', color: '#4ade80' }}>
                {updateMsg}
              </div>
            )}
            <button
              onClick={handleUpdate}
              disabled={updating}
              style={{
                width: '100%', padding: '0.75rem',
                borderRadius: '12px',
                border: 'none', cursor: updating ? 'not-allowed' : 'pointer',
                background: updating ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                color: updating ? 'rgba(255,255,255,0.4)' : '#fff',
                fontWeight: 700, fontSize: '0.875rem',
                transition: 'all 0.2s',
                boxShadow: updating ? 'none' : '0 4px 15px rgba(124,92,252,0.3)',
              }}
            >
              {updating ? '⏳ Bezig met updaten...' : '🔄 Update uitvoeren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
