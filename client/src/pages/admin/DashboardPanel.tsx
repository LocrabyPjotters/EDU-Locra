import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

export default function DashboardPanel() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const [stats, setStats] = useState({
    users: 0,
    models: 0,
    knowledgeBases: 0,
    conversations: 0,
    e2eEnabled: false,
    kennisnetEnabled: false
  });

  const [sysHealth, setSysHealth] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setStats(data);
      })
      .catch(e => console.error(e));
      
    fetch('/api/admin/system', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSysHealth(data);
      })
      .catch(e => console.error(e));
  }, [token]);

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Welkom terug, <span className="text-gradient">{user?.displayName}</span>
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-pill)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
          Systeem Online
        </div>
      </div>
      
      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--primary)', filter: 'blur(50px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Actieve Gebruikers</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{stats.users}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--accent)', filter: 'blur(50px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Modellen</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{stats.models}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--success)', filter: 'blur(50px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Gesprekken</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{stats.conversations}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#f59e0b', filter: 'blur(50px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Kennisbanken</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{stats.knowledgeBases}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Quick Actions */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Sneltoetsen & Overzicht</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', flex: 1 }}>
            <Link to="/admin/models" style={{ textDecoration: 'none' }}>
              <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'all 0.3s ease' }} className="hover-card">
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124, 92, 252, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--primary)' }}>🧠</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Nieuw Model Installeren</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Via Ollama Library of API</div>
                </div>
              </div>
            </Link>

            <Link to="/admin/knowledge" style={{ textDecoration: 'none' }}>
              <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1.25rem', transition: 'all 0.3s ease' }} className="hover-card">
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--accent)' }}>📚</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Documenten Uploaden</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Bouw je eigen RAG.</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Locra Engine Status</h3>
          
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Systeemstatus</span>
              {sysHealth ? (
                <span className={`badge ${sysHealth.status === 'online' ? 'badge-success' : 'badge-error'}`}>
                  {sysHealth.status.toUpperCase()}
                </span>
              ) : (
                <span className="badge badge-warning">Laden...</span>
              )}
            </li>
            
            {sysHealth && (
              <>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Geheugen (RAM)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '60px', height: '6px', background: 'var(--bg-surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--primary)', width: `${sysHealth.memory.usagePercentage}%` }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sysHealth.memory.usagePercentage}%</span>
                  </div>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uptime</span>
                  <span style={{ fontSize: '0.875rem' }}>{Math.floor(sysHealth.uptime / 3600)} uur</span>
                </li>
              </>
            )}

            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SSO Kennisnet</span>
              <span className={`badge ${stats.kennisnetEnabled ? 'badge-success' : 'badge-error'}`}>
                {stats.kennisnetEnabled ? 'Actief' : 'Inactief'}
              </span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>E2E Encryptie</span>
              <span className={`badge ${stats.e2eEnabled ? 'badge-success' : 'badge-error'}`}>
                {stats.e2eEnabled ? 'Actief' : 'Uitgeschakeld'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
