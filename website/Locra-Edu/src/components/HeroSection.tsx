import { useState, useEffect } from 'react';
import { Zap, Clock, CheckCircle, FileText } from 'lucide-react';
import { MainTabId, ALL_CAPABILITIES_GRID } from '../data/locraData';

interface HeroSectionProps {
  onTabChange: (id: MainTabId) => void;
}

const TAG_BADGE_MAP: Record<string, string> = {
  Onderwijs: 'badge-cobalt',
  Didactiek: 'badge-cobalt',
  Schrijven: 'badge-cobalt',
  Toetsing: 'badge-cobalt',
  Infra: 'badge-amber',
  STEM: 'badge-amber',
  Docent: 'badge-emerald',
  Scholing: 'badge-emerald',
  Veiligheid: 'badge-rose',
  Integriteit: 'badge-rose',
  Koppeling: 'badge-neutral',
  Soeverein: 'badge-neutral',
};

function getTagBadgeClass(tag: string): string {
  for (const key of Object.keys(TAG_BADGE_MAP)) {
    if (tag.includes(key)) return TAG_BADGE_MAP[key];
  }
  return 'badge-neutral';
}

const PREVIEW_ITEMS = [
  { label: 'Live Quiz', Icon: Zap },
  { label: 'Daluren Heatmap', Icon: Clock },
  { label: 'SlimCheck', Icon: CheckCircle },
  { label: 'Docs 2.0', Icon: FileText },
] as const;

function LiveQuizMock() {
  const [selected, setSelected] = useState<number | null>(null);
  const answers = [
    { letter: 'A', text: 'Zuurstof' },
    { letter: 'B', text: 'Koolstofdioxide', correct: true },
    { letter: 'C', text: 'Stikstof' },
    { letter: 'D', text: 'Waterstof' },
  ];
  return (
    <div className="card" style={{ padding: '20px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cobalt)', marginBottom: '8px' }}>
        Vraag 3/10
      </p>
      <p style={{ fontWeight: 600, marginBottom: '16px' }}>
        Welke stof nemen bladgroenkorrels op?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {answers.map((a, i) => {
          let bg = 'var(--bg-paper)';
          if (selected === i) bg = a.correct ? '#059669' : '#E11D48';
          return (
            <button
              key={a.letter}
              onClick={() => setSelected(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                background: bg,
                color: selected === i ? '#fff' : 'inherit',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 700 }}>{a.letter}</span> {a.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapMock() {
  const days = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const colors = [
    ['#059669', '#059669', '#D97706', '#059669', '#E11D48', '#D97706', '#E11D48'],
    ['#059669', '#D97706', '#059669', '#059669', '#D97706', '#E11D48', '#E11D48'],
    ['#D97706', '#059669', '#059669', '#D97706', '#059669', '#E11D48', '#D97706'],
    ['#E11D48', '#D97706', '#D97706', '#059669', '#059669', '#D97706', '#E11D48'],
  ];
  return (
    <div className="card" style={{ padding: '20px' }}>
      <p style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem' }}>Daluren Heatmap</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#888', paddingBottom: '4px' }}>{d}</div>
        ))}
        {colors.flat().map((c, i) => (
          <div
            key={i}
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: '4px',
              background: c,
              opacity: 0.75,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SlimCheckMock() {
  const rubrics = [
    { label: 'Argumentatie', pct: 90 },
    { label: 'Spelling & Grammatica', pct: 78 },
    { label: 'Structuur', pct: 85 },
  ];
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <p style={{ fontWeight: 600 }}>Emma van Dijk</p>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>Klas 4V – Nederlands</p>
        </div>
        <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>8.2<span style={{ fontSize: '0.9rem', fontWeight: 400 }}>/10</span></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rubrics.map((r) => (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>{r.label}</span>
              <span className="mono">{r.pct}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: '#e5e5e5' }}>
              <div style={{ height: '100%', width: `${r.pct}%`, borderRadius: '3px', background: 'var(--accent-emerald)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Docs2Mock() {
  return (
    <div className="card" style={{ padding: '24px', background: '#fff', minHeight: '160px' }}>
      <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: '8px', marginBottom: '12px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>De Gouden Eeuw</p>
      </div>
      <p style={{ fontSize: '0.8rem', lineHeight: 1.7, color: '#555', marginBottom: '16px' }}>
        De Republiek der Zeven Verenigde Nederlanden kende in de 17e eeuw een ongekende bloei op het gebied van handel, wetenschap en kunst. De VOC voer op Azië en Amsterdam groeide uit tot het financiële centrum van Europa.
      </p>
      <button
        className="btn btn-sm btn-primary"
        style={{ pointerEvents: 'none' }}
      >
        Vereenvoudig naar B1
      </button>
    </div>
  );
}

const PREVIEW_COMPONENTS = [LiveQuizMock, HeatmapMock, SlimCheckMock, Docs2Mock];

export default function HeroSection({ onTabChange }: HeroSectionProps) {
  const [activePreview, setActivePreview] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePreview((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const ActiveMock = PREVIEW_COMPONENTS[activePreview];

  return (
    <>
      {/* Section 1: Hero */}
      <section className="section container">
        <div className="grid-2" style={{ gap: '48px', alignItems: 'center' }}>
          {/* LEFT COLUMN */}
          <div>
            <span className="badge badge-emerald" style={{ marginBottom: '16px', display: 'inline-block' }}>
              🏫 Het Nr.1 Soevereine AI-Platform voor Onderwijs
            </span>
            <h1
              style={{
                fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)',
                fontFamily: 'var(--font-display)',
                lineHeight: 1.15,
                marginBottom: '16px',
              }}
            >
              Didactische AI op jullie eigen schoolserver
            </h1>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#555', marginBottom: '24px' }}>
              Locra draait 100% lokaal of in een afgeschermde Nederlandse enclave. Geen Big Tech. Geen datadeling. Wél interactieve lessen, automatisch nakijken en Socratische begeleiding.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
              <span className="badge badge-neutral">🔒 Lokaal op jullie server</span>
              <span className="badge badge-neutral">✅ AVG &amp; Privacyconvenant</span>
              <span className="badge badge-neutral">💰 Vanaf €0 / jaar</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button className="btn btn-primary btn-lg" onClick={() => onTabChange('platform')}>
                Ontdek het Platform
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => onTabChange('prijzen')}>
                Prijzen Bekijken
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Mini Platform Switcher */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {PREVIEW_ITEMS.map((item, idx) => {
                const isActive = activePreview === idx;
                return (
                  <div
                    key={item.label}
                    className="card"
                    onClick={() => setActivePreview(idx)}
                    style={{
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      border: isActive ? '2px solid var(--accent-cobalt)' : '2px solid transparent',
                      boxShadow: isActive ? '0 2px 12px rgba(37,99,235,0.15)' : 'none',
                      transition: 'border 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <item.Icon size={18} style={{ color: isActive ? 'var(--accent-cobalt)' : '#888' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
            <ActiveMock />
          </div>
        </div>
      </section>

      {/* Section 2: Capabilities Grid */}
      <section className="section container">
        <div className="section-header">
          <span className="badge badge-cobalt">12 Modules</span>
          <h2>Alles wat je school nodig heeft</h2>
          <p>Van interactieve lessen tot AI-nakijken — alles in één soeverein platform.</p>
        </div>
        <div className="grid-3" style={{ gap: '20px' }}>
          {ALL_CAPABILITIES_GRID.map((cap) => (
            <div key={cap.title} className="card card-interactive" style={{ padding: '24px' }}>
              <span className={`badge ${getTagBadgeClass(cap.tag)}`} style={{ marginBottom: '12px', display: 'inline-block' }}>
                {cap.tag}
              </span>
              <h4 style={{ marginBottom: '8px' }}>{cap.title}</h4>
              <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.6 }}>{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
