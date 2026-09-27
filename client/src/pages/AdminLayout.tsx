import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
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

export default function AdminLayout() {
  const user = useAuthStore(state => state.user);
  const academyName = useAcademyName();
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return (
      <div className="center-container">
        <div className="glass-panel text-center">
          <h2>Geen Toegang</h2>
          <p style={{ marginTop: '1rem' }}>Je moet beheerder zijn om deze pagina te bekijken.</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            Ga naar Inloggen
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const location = useLocation();

  const NavItem = ({ to, icon, label }: { to: string, icon: string, label: string }) => {
    const isActive = location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to));
    return (
      <li>
        <Link 
          to={to} 
          style={{ 
            color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
            textDecoration: 'none', 
            fontWeight: 500, 
            padding: '0.75rem 1rem', 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.75rem',
            borderRadius: 'var(--radius-md)',
            background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'var(--bg-surface-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>{icon}</span>
          {label}
        </Link>
      </li>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative background glow */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0, opacity: 0.5, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0, opacity: 0.5, pointerEvents: 'none' }} />
      
      <nav style={{ 
        width: '280px', 
        background: 'rgba(17, 24, 39, 0.7)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '2rem 1.5rem', 
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10
      }}>
        <h2 style={{ marginBottom: '2.5rem', fontSize: '1.5rem', paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px var(--primary-glow)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div><span className="text-gradient" style={{ fontWeight: 800 }}>Locra</span> <span style={{ fontWeight: 400, opacity: 0.7 }}>Admin</span></div>
        </h2>
        
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavItem to="/admin" icon="📊" label="Dashboard" />
          <NavItem to="/admin/models" icon="🧠" label="Modellen Beheer" />
          <NavItem to="/admin/benchmark" icon="⚡" label="Hardware & Concurrency" />
          <NavItem to="/admin/license" icon="🎓" label="Licentie & EDU Plus" />
          <NavItem to="/admin/knowledge" icon="📚" label="Kennisbanken (RAG)" />
          <NavItem to="/admin/customization" icon="🎨" label="Vormgeving & AI Karakter" />
          <NavItem to="/admin/templates" icon="📝" label="Prompt Templates" />
          <NavItem to="/admin/users" icon="👥" label="Gebruikers" />
          <NavItem to="/admin/groups" icon="🧑‍🤝‍🧑" label="Groepen & Klassen" />
          <NavItem to="/admin/reporting" icon="📈" label="Uitgebreide Rapportage" />
          <NavItem to="/admin/quotas" icon="⚖️" label="Quotas & Modellen Toegang" />
          <NavItem to="/admin/api" icon="☁️" label="Cloud API & Kosten" />
          <NavItem to="/admin/audit" icon="🛡️" label="Audit Logboek" />
          <NavItem to="/admin/settings" icon="⚙️" label="Instellingen" />
          <div style={{ margin: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <NavItem to="/academy" icon="🏛️" label={academyName} />
          <NavItem to="/chat" icon="💬" label="Naar Chat" />
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--bg-surface-hover)' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{user.displayName}</strong>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Superadmin</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn" 
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Uitloggen
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '3rem', overflowY: 'auto', zIndex: 1, position: 'relative' }}>
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
      </main>
    </div>
  );
}
