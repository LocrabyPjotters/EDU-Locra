import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState } from 'react';
import ModelsPanel from './admin/ModelsPanel';
import KnowledgePanel from './admin/KnowledgePanel';
import SettingsPanel from './admin/SettingsPanel';
import UsersPanel from './admin/UsersPanel';
import CustomizationPanel from './admin/CustomizationPanel';
import DashboardPanel from './admin/DashboardPanel';
import TemplatesPanel from './admin/TemplatesPanel';
import AuditLogsPanel from './admin/AuditLogsPanel';
import GroupsPanel from './admin/GroupsPanel';
import BenchmarkPanel from './admin/BenchmarkPanel';
import LicensePanel from './admin/LicensePanel';
import ReportingPanel from './admin/ReportingPanel';
import QuotasPanel from './admin/QuotasPanel';
import APIPanel from './admin/APIPanel';
import { useAcademyName } from '../store/orgStore';

const NAV_GROUPS = [
  {
    label: 'Overzicht',
    items: [
      { to: '/admin', icon: '◈', label: 'Dashboard', exact: true },
    ]
  },
  {
    label: 'AI & Modellen',
    items: [
      { to: '/admin/models', icon: '⬡', label: 'Modellen' },
      { to: '/admin/benchmark', icon: '⚡', label: 'Hardware & Concurrency' },
      { to: '/admin/knowledge', icon: '◎', label: 'Kennisbanken (RAG)' },
    ]
  },
  {
    label: 'Organisatie',
    items: [
      { to: '/admin/users', icon: '◉', label: 'Gebruikers' },
      { to: '/admin/groups', icon: '⊞', label: 'Groepen & Klassen' },
      { to: '/admin/quotas', icon: '◩', label: 'Quota\'s & Toegang' },
      { to: '/admin/reporting', icon: '◈', label: 'Rapportage' },
    ]
  },
  {
    label: 'Beheer',
    items: [
      { to: '/admin/customization', icon: '◐', label: 'Vormgeving & AI Karakter' },
      { to: '/admin/templates', icon: '◳', label: 'Prompt Templates' },
      { to: '/admin/api', icon: '⬡', label: 'Cloud API & Kosten' },
      { to: '/admin/license', icon: '◎', label: 'Licentie & EDU Plus' },
      { to: '/admin/audit', icon: '◉', label: 'Audit Logboek' },
      { to: '/admin/settings', icon: '◈', label: 'Instellingen' },
    ]
  },
];

export default function AdminLayout() {
  const user = useAuthStore(state => state.user);
  const academyName = useAcademyName();
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>Geen toegang</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Je hebt geen beheerdersrechten voor deze pagina.</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">Terug naar inloggen</button>
        </div>
      </div>
    );
  }

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to || location.pathname === to + '/';
    return location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to));
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'inherit' }}>
      {/* ── AMBIENT GLOWS ── */}
      <div style={{ position: 'fixed', top: '-10%', left: '14%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '260px',
        minWidth: '260px',
        background: 'rgba(10, 10, 18, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '1.75rem 1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(124,92,252,0.4)',
              flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                <span style={{ background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Locra</span>
                {' '}
                <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Admin</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{academyName}</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups[group.label];
            return (
              <div key={group.label} style={{ marginBottom: '0.5rem' }}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.35rem 0.75rem',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    borderRadius: '8px',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                  <span>{group.label}</span>
                  <span style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'none', fontSize: '0.6rem' }}>▾</span>
                </button>

                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '0.25rem' }}>
                    {group.items.map(item => {
                      const active = isActive(item.to, (item as any).exact);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: active ? 600 : 400,
                            color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                            background: active ? 'rgba(124,92,252,0.15)' : 'transparent',
                            border: active ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
                            transition: 'all 0.15s ease',
                            position: 'relative',
                          }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}}
                        >
                          {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', background: 'linear-gradient(180deg, #7c5cfc, #38bdf8)', borderRadius: '0 3px 3px 0' }} />}
                          <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider */}
          <div style={{ margin: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

          {/* Academy & Chat shortcuts */}
          {[
            { to: '/academy', icon: '🏛', label: academyName },
            { to: '/chat', icon: '💬', label: 'Naar Chat' }
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Footer */}
        <div style={{ padding: '1rem 0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0
            }}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.displayName}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Uitloggen"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1,
        marginLeft: '260px',
        minHeight: '100vh',
        zIndex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 15,
          background: 'rgba(10,10,18,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          padding: '0 2.5rem',
          height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}>
            {/* Breadcrumb based on path */}
            {location.pathname === '/admin' ? 'Dashboard' :
             location.pathname.includes('/models') ? 'AI & Modellen → Modellen' :
             location.pathname.includes('/benchmark') ? 'AI & Modellen → Hardware & Concurrency' :
             location.pathname.includes('/knowledge') ? 'AI & Modellen → Kennisbanken' :
             location.pathname.includes('/users') ? 'Organisatie → Gebruikers' :
             location.pathname.includes('/groups') ? 'Organisatie → Groepen' :
             location.pathname.includes('/quotas') ? 'Organisatie → Quota\'s' :
             location.pathname.includes('/reporting') ? 'Organisatie → Rapportage' :
             location.pathname.includes('/customization') ? 'Beheer → Vormgeving' :
             location.pathname.includes('/templates') ? 'Beheer → Templates' :
             location.pathname.includes('/api') ? 'Beheer → Cloud API' :
             location.pathname.includes('/license') ? 'Beheer → Licentie' :
             location.pathname.includes('/audit') ? 'Beheer → Audit Logboek' :
             location.pathname.includes('/settings') ? 'Beheer → Instellingen' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Systeem online</span>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ flex: 1, padding: '2.5rem', maxWidth: '1400px', width: '100%' }}>
          <Routes>
            <Route path="/" element={<DashboardPanel />} />
            <Route path="/models" element={<ModelsPanel />} />
            <Route path="/benchmark" element={<BenchmarkPanel />} />
            <Route path="/license" element={<LicensePanel />} />
            <Route path="/knowledge" element={<KnowledgePanel />} />
            <Route path="/customization" element={<CustomizationPanel />} />
            <Route path="/templates" element={<TemplatesPanel />} />
            <Route path="/users" element={<UsersPanel />} />
            <Route path="/groups" element={<GroupsPanel />} />
            <Route path="/reporting" element={<ReportingPanel />} />
            <Route path="/quotas" element={<QuotasPanel />} />
            <Route path="/api" element={<APIPanel />} />
            <Route path="/audit" element={<AuditLogsPanel />} />
            <Route path="/settings" element={<SettingsPanel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
