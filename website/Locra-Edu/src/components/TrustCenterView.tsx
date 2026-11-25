import { ShieldCheck, Heart, Fingerprint, Lock, Check } from 'lucide-react';

const trustCards = [
  {
    icon: ShieldCheck,
    color: 'var(--accent-emerald)',
    title: 'AVG & Privacyconvenant',
    bullets: [
      'Zero-telemetry: geen data naar externe servers',
      'Privacyconvenant Onderwijs ready',
      'DPIA-documenten direct exporteerbaar',
      'Volledige datawissing op verzoek',
    ],
  },
  {
    icon: Heart,
    color: 'var(--accent-rose)',
    title: '113 Zorgsignalen & Pestdetectie',
    bullets: [
      'Automatische detectie van crisissignalen in chats',
      'Pedagogische vangrail: direct doorverwijzen naar hulplijn',
      'Pestdetectie met escalatieprotocol',
      'Geen surveillance — alleen vangrail bij acute signalen',
    ],
  },
  {
    icon: Fingerprint,
    color: 'var(--accent-amber)',
    title: 'Zero-Width Watermerk',
    bullets: [
      'Onzichtbaar watermerk in alle AI-gegenereerde teksten',
      'Detector tool voor docenten om AI-teksten te herkennen',
      'Per-leerling unieke markering',
      'Bewijs bij vermoeden van plagiaat of fraude',
    ],
  },
  {
    icon: Lock,
    color: 'var(--accent-cobalt)',
    title: 'Kiosk & Tab-Switch Beveiliging',
    bullets: [
      'Toetsbeveiliging zonder invasieve proctoring',
      'Realtime tab-switch detectie',
      'Automatische meldingen bij verdacht gedrag',
      'Tijdsloten en toetsvergrendeling',
    ],
  },
];

export default function TrustCenterView() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="badge badge-emerald">Trust Center (AVG)</span>
          <h2>Privacy, Veiligheid &amp; Compliance</h2>
          <p>
            Locra is ontworpen met privacy en veiligheid als fundament — volledig
            conform de Nederlandse en Europese wet- en regelgeving.
          </p>
        </div>

        <div className="grid-2">
          {trustCards.map((card) => {
            const Icon = card.icon;
            return (
              <div className="card" key={card.title} style={{ padding: 28 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: `color-mix(in srgb, ${card.color} 12%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Icon size={24} style={{ color: card.color }} />
                </div>

                <h3 style={{ margin: '0 0 12px' }}>{card.title}</h3>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {card.bullets.map((bullet) => (
                    <li
                      key={bullet}
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
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
