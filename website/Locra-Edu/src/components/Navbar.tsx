import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { MainTabId, MAIN_TABS } from '../data/locraData';

interface NavbarProps {
  activeTab: MainTabId;
  onTabChange: (id: MainTabId) => void;
}

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTabClick = (id: MainTabId) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  return (
    <nav className="site-nav">
      <div className="container site-nav-inner">
        <button
          className="brand"
          onClick={() => handleTabClick('overzicht')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span className="brand-mark">L</span>
          <span>Locra</span>
          <span className="brand-tag">EDU</span>
        </button>

        <div className="nav-tabs" role="tablist">
          {MAIN_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="nav-tab-btn"
              aria-selected={activeTab === t.id}
              onClick={() => handleTabClick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary btn-sm nav-cta-desktop"
          onClick={() => handleTabClick('aanvragen')}
        >
          Licentie Aanvragen
        </button>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Menu sluiten' : 'Menu openen'}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 0,
            right: 0,
            background: '#fff',
            padding: 16,
            borderBottom: '1px solid #e2e8f0',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {MAIN_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="nav-tab-btn"
              aria-selected={activeTab === t.id}
              onClick={() => handleTabClick(t.id)}
              style={{ textAlign: 'left' }}
            >
              {t.label}
            </button>
          ))}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleTabClick('aanvragen')}
            style={{ marginTop: 8 }}
          >
            Licentie Aanvragen
          </button>
        </div>
      )}
    </nav>
  );
}
