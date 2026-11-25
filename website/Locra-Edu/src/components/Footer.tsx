import { Mail, Globe } from 'lucide-react';
import { MainTabId } from '../data/locraData';

interface FooterProps {
  onTabChange: (id: MainTabId) => void;
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94A3B8',
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: '4px 0',
  textAlign: 'left',
};

export default function Footer({ onTabChange }: FooterProps) {
  return (
    <footer style={{ background: '#0F172A', color: '#fff', padding: '56px 0 24px' }}>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 32,
          }}
        >
          {/* Platform */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={linkStyle} onClick={() => onTabChange('overzicht')}>Overzicht</button>
              <button style={linkStyle} onClick={() => onTabChange('platform')}>Platform</button>
              <button style={linkStyle} onClick={() => onTabChange('voor-wie')}>Voor Wie</button>
              <button style={linkStyle} onClick={() => onTabChange('architectuur')}>Architectuur</button>
            </div>
          </div>

          {/* Ondersteuning */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Ondersteuning</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={linkStyle} onClick={() => onTabChange('trust-center')}>Trust Center</button>
              <button style={linkStyle} onClick={() => onTabChange('prijzen')}>Prijzen</button>
              <button style={linkStyle} onClick={() => onTabChange('aanvragen')}>Aanvragen</button>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a
                href="mailto:locra@pjotters.nl"
                style={{ ...linkStyle, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              >
                <Mail size={16} /> locra@pjotters.nl
              </a>
              <a
                href="https://pjotters.nl"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...linkStyle, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              >
                <Globe size={16} /> pjotters.nl
              </a>
            </div>
          </div>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  background: '#2563EB',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                L
              </span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Locra EDU</span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              Het soevereine AI-platform voor Nederlands onderwijs
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: '1px solid #1E293B',
            marginTop: 48,
            paddingTop: 20,
            textAlign: 'center',
            color: '#64748B',
            fontSize: '0.85rem',
          }}
        >
          © 2024–2026 Pjotters — Alle rechten voorbehouden
        </div>
      </div>
    </footer>
  );
}
