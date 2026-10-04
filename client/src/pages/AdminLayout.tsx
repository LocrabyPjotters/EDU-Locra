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
import CodeMatchPanel from './admin/CodeMatchPanel';
import { useAcademyName } from '../store/orgStore';

// Navigation sections definition
const NAV_SECTIONS = [
  {
    title: 'Beheer',
    items: [
      { to: '/admin', icon: '📊', label: 'Dashboard', exact: true },
      { to: '/admin/models', icon: '🧠', label: 'Modellen' },
      { to: '/admin/benchmark', icon: '⚡', label: 'Hardware & Performance' },
      { to: '/admin/license', icon: '🎓', label: 'Licentie & EDU Plus' },
    ]
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/knowledge', icon: '📚', label: 'Kennisbanken (RAG)' },
      { to: '/admin/customization', icon: '🎨', label: 'Vormgeving & AI Karakter' },
      { to: '/admin/templates', icon: '📝', label: 'Prompt Templates' },
      { to: '/admin/codematch', icon: '💻', label: 'CodeMatch (IDE)' },
    ]
  },
  {
    title: 'Gebruikers',
    items: [
      { to: '/admin/users', icon: '👥', label: 'Gebruikers' },
      { to: '/admin/groups', icon: '🧑‍🤝‍🧑', label: 'Groepen & Klassen' },
      { to: '/admin/quotas', icon: '⚖️', label: 'Quota & Toegang' },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { to: '/admin/reporting', icon: '📈', label: 'Rapportage' },
      { to: '/admin/audit', icon: '🛡️', label: 'Audit Logboek' },
    ]
  },
  {
    title: 'Systeem',
    items: [
      { to: '/admin/settings', icon: '⚙️', label: 'Instellingen' },
    ]
  },
];

export default function AdminLayout() {
  const user = useAuthStore(state => state.user);
  const academyName = useAcademyName();
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Geen Toegang</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Je moet beheerder zijn om deze pagina te bekijken.</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">Ga naar Inloggen</button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (to: string, exact = false) => {
    if (exact) return location.pathname === to;
    return to !== '/admin' && location.pathname.startsWith(to);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0b12', position: 'relative', overflow: 'hidden' }}>
      {/* Global background glows */}
      <div style={{ position: 'fixed', top: '-10%', right: '-5%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', left: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />

      {/* SIDEBAR */}
      <nav style={{
        width: collapsed ? '72px' : '260px',
        minHeight: '100vh',
        background: 'rgba(10, 11, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}>
        {/* Logo header */}
        <div style={{ padding: collapsed ? '1.5rem 0' : '1.5rem', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
          {!collapsed && (
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
              <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.4)', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>Locra</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Beheerderspanel</div>
              </div>
            </Link>
          )}
          {collapsed && (
            <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '6px', display: 'flex' }}
              title="Zijbalk inklappen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{ margin: '0.5rem auto 1rem', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '8px', borderRadius: '8px', display: 'flex' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '0 0.5rem' : '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.75rem 0.5rem 0.35rem' }}>
                  {section.title}
                </div>
              )}
              {collapsed && <div style={{ height: '0.5rem' }} />}
              {section.items.map((item) => {
                const active = item.exact ? location.pathname === item.to : isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: collapsed ? '0.65rem' : '0.65rem 0.75rem',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.08))' : 'transparent',
                      border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontWeight: active ? 600 : 400,
                      fontSize: '0.9rem',
                      transition: 'all 0.18s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                      }
                    }}
                  >
                    {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', background: 'linear-gradient(180deg, #6366f1, #06b6d4)', borderRadius: '0 3px 3px 0' }} />}
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Divider */}
          <div style={{ margin: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

          {/* Quick links */}
          {[
            { to: '/academy', icon: '🏛️', label: academyName },
            { to: '/chat', icon: '💬', label: 'Naar Chat' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: collapsed ? '0.65rem' : '0.65rem 0.75rem', borderRadius: '10px', textDecoration: 'none', justifyContent: collapsed ? 'center' : 'flex-start', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', transition: 'all 0.18s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </Link>
          ))}
        </div>

        {/* User profile footer */}
        <div style={{ padding: collapsed ? '1rem 0.5rem' : '1rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.displayName}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user.role}</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              title="Uitloggen"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '6px', borderRadius: '8px', display: 'flex', flexShrink: 0, transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, overflowY: 'auto', zIndex: 1, position: 'relative', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2.5rem 2.5rem' }}>
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
            <Route path="/audit" element={<AuditLogsPanel />} />
            <Route path="/settings" element={<SettingsPanel />} />
            <Route path="/codematch" element={<CodeMatchPanel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
