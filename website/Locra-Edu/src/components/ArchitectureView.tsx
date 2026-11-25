import { Server, Shield, GitBranch, RefreshCw, Check } from 'lucide-react';

interface DeploymentModel {
  badge: string;
  badgeClass: string;
  icon: React.ReactNode;
  headline: string;
  bullets: string[];
  bottomTag: string;
  bottomTagClass?: string;
  highlighted?: boolean;
}

const MODELS: DeploymentModel[] = [
  {
    badge: 'Lokaal',
    badgeClass: 'badge badge-emerald',
    icon: <Server size={28} />,
    headline: '100% op eigen hardware',
    bullets: [
      'Eigen GPU server met Ollama',
      'Geen internetvereiste voor AI',
      'Volledige dataeigendom',
      'Ideaal voor daluren-verwerking',
    ],
    bottomTag: 'Maximale controle',
  },
  {
    badge: 'PrivAI™',
    badgeClass: 'badge badge-cobalt',
    icon: <Shield size={28} />,
    headline: 'Soevereine cloud in Nederland',
    bullets: [
      'OpenPCC hardware in Amsterdam',
      'Zero-access cryptografische enclave',
      'Nederlandse jurisdictie (geen US Cloud Act)',
      'GPU-as-a-Service zonder datadeling',
    ],
    bottomTag: 'Aanbevolen',
    bottomTagClass: 'badge badge-emerald',
    highlighted: true,
  },
  {
    badge: 'Hybride',
    badgeClass: 'badge badge-amber',
    icon: <GitBranch size={28} />,
    headline: 'Best of both worlds',
    bullets: [
      'Chat lokaal + zware taken via PrivAI',
      'Automatische failover',
      'Daluren lokaal + live vragen PrivAI',
      'Flexibel opschalen per seizoen',
    ],
    bottomTag: 'Meest flexibel',
  },
];

export default function ArchitectureView() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="badge badge-cobalt">Architectuur &amp; PrivAI™</span>
          <h2>Drie Deployment Modellen</h2>
          <p
            style={{
              color: 'var(--text-secondary, #64748b)',
              maxWidth: 640,
              margin: '8px auto 0',
              fontSize: '1.05rem',
            }}
          >
            Kies hoe en waar Locra draait — volledig lokaal, via onze soevereine
            cloud, of een combinatie van beide.
          </p>
        </div>

        <div className="grid-3" style={{ marginTop: 32 }}>
          {MODELS.map((model) => (
            <div
              key={model.badge}
              className="card"
              style={{
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                ...(model.highlighted
                  ? {
                      border: '2px solid var(--accent-cobalt)',
                      boxShadow: 'var(--shadow-md)',
                    }
                  : {}),
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span className={model.badgeClass}>{model.badge}</span>
                <span style={{ color: 'var(--accent-cobalt)' }}>
                  {model.icon}
                </span>
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {model.headline}
              </h3>

              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                }}
              >
                {model.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: '0.925rem',
                      lineHeight: 1.5,
                      color: 'var(--text-secondary, #64748b)',
                    }}
                  >
                    <Check
                      size={16}
                      style={{
                        color: 'var(--accent-emerald)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <span
                  className={
                    model.bottomTagClass ?? 'badge badge-neutral'
                  }
                >
                  {model.bottomTag}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Update System explanation card */}
        <div
          className="card"
          style={{
            marginTop: 40,
            padding: 28,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <span
            style={{
              color: 'var(--accent-cobalt)',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <RefreshCw size={24} />
          </span>
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                fontWeight: 700,
                margin: '0 0 8px',
              }}
            >
              Licentie-gecontroleerde Updates
            </h4>
            <p
              style={{
                margin: 0,
                color: 'var(--text-secondary, #64748b)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              Locra is niet meer open-source. Elke school haalt updates op via
              het ingebouwde UpdatePanel. De server valideert de licentiesleutel
              bij{' '}
              <span className="mono">api.rowmatch.nl</span> en ontvangt een
              tijdelijk read-only token (1 uur geldig).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
