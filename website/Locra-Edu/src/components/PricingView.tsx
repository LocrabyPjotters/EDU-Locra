import { Check, ChevronDown } from 'lucide-react';
import type { MainTabId } from '../data/locraData';
import { PRICING_TIERS, FEATURE_MATRIX, FAQS } from '../data/locraData';

interface PricingViewProps {
  onTabChange: (id: MainTabId) => void;
}

export default function PricingView({ onTabChange }: PricingViewProps) {
  return (
    <section className="section">
      <style>{`
        details[open] summary .faq-chevron {
          transform: rotate(180deg);
        }
        .faq-chevron {
          transition: transform 0.2s ease;
        }
        summary::-webkit-details-marker {
          display: none;
        }
      `}</style>

      <div className="container">
        {/* ── Pricing Cards ── */}
        <div className="section-header">
          <span className="badge badge-cobalt">Prijzen</span>
          <h2>Transparante Licenties voor Elke School</h2>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 20,
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {PRICING_TIERS.map((tier) => (
            <div
              className="card"
              key={tier.name}
              style={{
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                flex: '1 0 260px',
                position: 'relative',
                ...(tier.highlight
                  ? { border: '2px solid var(--accent-cobalt)' }
                  : {}),
              }}
            >
              {tier.highlight && (
                <span
                  className="badge badge-cobalt"
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 16,
                  }}
                >
                  Meest Gekozen
                </span>
              )}

              <h3 style={{ margin: '0 0 8px' }}>{tier.name}</h3>

              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {tier.price}
              </div>
              <small
                style={{
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                {tier.period}
              </small>

              <p
                style={{
                  color: 'var(--text-muted)',
                  marginBottom: 16,
                  fontSize: '0.95rem',
                }}
              >
                {tier.tagline}
              </p>

              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 auto',
                }}
              >
                {tier.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    <Check
                      size={16}
                      style={{
                        color: 'var(--accent-emerald)',
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${tier.highlight ? 'btn-primary' : 'btn-secondary'}`}
                style={{ marginTop: 20, width: '100%' }}
                onClick={() => onTabChange('aanvragen')}
              >
                {tier.ctaLabel}
              </button>
            </div>
          ))}
        </div>

        {/* ── Feature Matrix ── */}
        <h3 style={{ marginTop: 48, marginBottom: 16 }}>
          Vergelijk Alle Pakketten
        </h3>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>EDU-Free</th>
                <th>EDU-Basic</th>
                <th
                  style={{
                    backgroundColor: 'var(--accent-cobalt-soft)',
                  }}
                >
                  EDU-Plus
                </th>
                <th>EDU-Premium</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.free}</td>
                  <td>{row.basic}</td>
                  <td
                    style={{
                      backgroundColor: 'var(--accent-cobalt-soft)',
                    }}
                  >
                    {row.plus}
                  </td>
                  <td>{row.premium}</td>
                  <td>{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── FAQ ── */}
        <h3 style={{ marginTop: 48, marginBottom: 16 }}>
          Veelgestelde Vragen
        </h3>

        <div>
          {FAQS.map((faq) => (
            <details key={faq.q}>
              <summary
                style={{
                  fontWeight: 600,
                  padding: '16px 0',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  listStyle: 'none',
                }}
              >
                {faq.q}
                <ChevronDown size={18} className="faq-chevron" />
              </summary>
              <p style={{ padding: '0 0 16px' }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
