import { useState } from 'react';
import {
  CheckCircle,
  Zap,
  Clock,
  FileText,
  Shield,
  Code,
  GraduationCap,
  Calendar,
  Smartphone,
  Monitor,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { PLATFORM_MODULES, type PlatformModuleId } from '../data/locraData';

function LivePreview() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const options = [
    { label: 'A', text: 'Zuurstof (O₂)', correct: false },
    { label: 'B', text: 'Koolstofdioxide (CO₂)', correct: true },
    { label: 'C', text: 'Stikstof (N₂)', correct: false },
    { label: 'D', text: 'Calciumcarbonaat', correct: false },
  ];

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
          <Monitor size={18} color="var(--accent-cobalt)" />
          <span>Locra Live — Les 3: Fotosynthese</span>
        </div>
        <span className="badge badge-cobalt">RTTI: T1</span>
      </div>

      <p style={{ fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '14px', fontSize: '1rem' }}>
        Welke stof wordt tijdens de fotosynthese opgenomen door de bladgroenkorrels?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {options.map((opt, idx) => {
          const isSelected = selectedAnswer === idx;
          let bg = 'var(--bg-muted)';
          let border = '1px solid var(--border-light)';
          let color = 'var(--ink-primary)';

          if (isSelected) {
            if (opt.correct) {
              bg = 'var(--accent-emerald-soft)';
              border = '1px solid var(--accent-emerald)';
              color = 'var(--accent-emerald)';
            } else {
              bg = 'var(--accent-rose-soft)';
              border = '1px solid var(--accent-rose)';
              color = 'var(--accent-rose)';
            }
          }

          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSelectedAnswer(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: bg,
                border,
                color,
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.9rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#fff',
                  border: '1px solid var(--border-medium)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--ink-primary)',
                }}
              >
                {opt.label}
              </span>
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
        <span>24 van 28 leerlingen hebben geantwoord</span>
        <div style={{ width: '90px', height: '6px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: '85%', height: '100%', background: 'var(--accent-cobalt)' }} />
        </div>
      </div>
    </div>
  );
}

function QueueHeatmapPreview() {
  const days = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const blocks = ['Nacht', 'Ochtend', 'Middag', 'Avond'];
  // 0 = rustig (emerald), 1 = druk (amber), 2 = piek (rose)
  const matrix = [
    [0, 2, 1, 0],
    [0, 2, 2, 0],
    [0, 1, 1, 0],
    [0, 2, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  const getCellStyle = (val: number) => {
    if (val === 0) return { background: 'rgba(5, 150, 105, 0.22)', color: 'var(--accent-emerald)', label: 'Rustig' };
    if (val === 1) return { background: 'rgba(217, 119, 6, 0.25)', color: 'var(--accent-amber)', label: 'Druk' };
    return { background: 'rgba(225, 29, 72, 0.22)', color: 'var(--accent-rose)', label: 'Piek' };
  };

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
          <Clock size={18} color="var(--accent-amber)" />
          <span>7×24 GPU Load-Matrix</span>
        </div>
        <span className="badge badge-emerald">Chat heeft voorrang</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(4, 1fr)', gap: '6px', marginBottom: '18px', fontSize: '0.75rem' }}>
        <div />
        {blocks.map(b => (
          <div key={b} style={{ textAlign: 'center', color: 'var(--ink-muted)', fontWeight: 600 }}>{b}</div>
        ))}
        {days.map((d, rIdx) => (
          <>
            <div key={`d-${d}`} style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--ink-secondary)' }}>
              {d}
            </div>
            {matrix[rIdx].map((val, cIdx) => {
              const s = getCellStyle(val);
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  title={`${d} ${blocks[cIdx]}: ${s.label}`}
                  style={{
                    height: '24px',
                    borderRadius: '6px',
                    background: s.background,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: s.color,
                  }}
                >
                  {s.label}
                </div>
              );
            })}
          </>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
          <span style={{ fontWeight: 600 }}>SlimCheck — Aardrijkskunde H3 (28×)</span>
          <span className="badge badge-amber">Daluren · Prio 3</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
          <span style={{ fontWeight: 600 }}>Live Les — Biologie (Deadline 08:30)</span>
          <span className="badge badge-cobalt">Direct · Prio 8</span>
        </div>
      </div>
    </div>
  );
}

function SlimCheckPreview() {
  const rubrics = [
    { label: 'Begrip kernconcepten', pct: 85 },
    { label: 'Brongebruik & onderbouwing', pct: 75 },
    { label: 'Heldere formulering', pct: 90 },
  ];

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink-primary)' }}>Emma van Dijk</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Aardrijkskunde H3 — Open Vraag 4</div>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-display)' }}>
          8,2 / 10
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {rubrics.map(r => (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>{r.label}</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>{r.pct}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${r.pct}%`, height: '100%', background: 'var(--accent-emerald)', borderRadius: '999px' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
        “Goede analyse van de platentektoniek. Tip: voeg bij je tweede argument nog één concreet voorbeeld uit de bron toe.”
      </div>
    </div>
  );
}

function ChatDocsPreview() {
  const [mode, setMode] = useState<'socratisch' | 'docs'>('socratisch');

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'socratisch' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('socratisch')}
        >
          <MessageSquare size={14} /> Socratische Coach
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'docs' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('docs')}
        >
          <FileText size={14} /> Docs 2.0 A4 Studio
        </button>
      </div>

      {mode === 'socratisch' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '12px', background: 'var(--accent-cobalt-soft)', color: 'var(--ink-primary)', fontSize: '0.86rem' }}>
            <strong>Locra Coach:</strong> Wat weet je al over hoe planten energie aanmaken?
          </div>
          <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-muted)', color: 'var(--ink-primary)', fontSize: '0.86rem' }}>
            Dat ze zonlicht gebruiken in hun bladeren!
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '12px', background: 'var(--accent-cobalt-soft)', color: 'var(--ink-primary)', fontSize: '0.86rem' }}>
            <strong>Locra Coach:</strong> Precies! En welke twee stoffen heeft de plant naast zonlicht nog meer nodig voor die reactie?
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '16px', background: '#FFFDF9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-muted)' }}>WERKSTUK.DOCX — A4 PAGINA 1</span>
            <span className="badge badge-emerald">B1-taalhulp</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--ink-primary)', marginBottom: '12px', lineHeight: 1.65 }}>
            De industriële revolutie zorgde vanaf 1760 voor grote veranderingen in de manier waarop producten werden gemaakt. Stoommachines namen het zware handwerk over.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="btn btn-sm btn-secondary"><Sparkles size={13} /> Vereenvoudig naar B1</span>
            <span className="btn btn-sm btn-secondary">Maak korter</span>
            <span className="btn btn-sm btn-secondary">1-klik Undo</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamRoomPreview() {
  const segments = [
    { label: 'R (25%)', width: '25%', color: 'var(--accent-cobalt)' },
    { label: 'T1 (30%)', width: '30%', color: 'var(--accent-emerald)' },
    { label: 'T2 (25%)', width: '25%', color: 'var(--accent-amber)' },
    { label: 'I (20%)', width: '20%', color: 'var(--accent-rose)' },
  ];

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
          <Shield size={18} color="var(--accent-emerald)" />
          <span>ExamRoom Kiosk Monitor</span>
        </div>
        <span className="badge badge-emerald">● Beveiligd</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
        <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink-primary)' }}>24</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>Actief</div>
        </div>
        <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-amber-soft)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-amber)' }}>2</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--accent-amber)' }}>Tab-switches</div>
        </div>
        <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink-primary)' }}>38:24</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>Resterend</div>
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: '8px' }}>
        RTTI-verdeling van deze toets
      </div>
      <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', gap: '2px', marginBottom: '8px' }}>
        {segments.map(s => (
          <div key={s.label} style={{ width: s.width, background: s.color }} title={s.label} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
        {segments.map(s => (
          <span key={s.label}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

function EcosystemPreview() {
  const items = [
    { icon: Code, title: 'CodeMatch IDE', desc: 'Veilige code-editor met stapsgewijze AI-hints', color: 'var(--accent-cobalt)' },
    { icon: GraduationCap, title: 'Locra Academy', desc: 'Leerpaden & Teacher AI-certificaten', color: 'var(--accent-emerald)' },
    { icon: Calendar, title: 'SOMtoday', desc: 'Lesroosters, huiswerk & cijfers gekoppeld', color: 'var(--accent-amber)' },
    { icon: Smartphone, title: 'Connect App', desc: '1-klik QR-koppeling & Face ID', color: 'var(--accent-rose)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="card" style={{ padding: '18px', background: 'var(--bg-surface)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', marginBottom: '10px' }}>
              <Icon size={18} color={item.color} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink-primary)', marginBottom: '4px' }}>
              {item.title}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
              {item.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function PlatformTabs() {
  const [activeModule, setActiveModule] = useState<PlatformModuleId>('live');
  const current = PLATFORM_MODULES.find(m => m.id === activeModule) || PLATFORM_MODULES[0];

  const renderPreview = (id: PlatformModuleId) => {
    switch (id) {
      case 'live':
        return <LivePreview />;
      case 'ai-queue':
        return <QueueHeatmapPreview />;
      case 'slimcheck':
        return <SlimCheckPreview />;
      case 'chat-docs':
        return <ChatDocsPreview />;
      case 'examroom':
        return <ExamRoomPreview />;
      case 'ecosystem':
        return <EcosystemPreview />;
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="badge badge-cobalt">
            <Zap size={14} /> Platform & Functies
          </span>
          <h2>Zes Pijlers voor Modern Onderwijs</h2>
          <p>
            Ontdek hoe Locra elke stap van het onderwijsproces ondersteunt — van interactieve lessen en daluren-verwerking tot veilig toetsen.
          </p>
        </div>

        <div className="tablist-bar" role="tablist" aria-label="Locra modules" style={{ marginBottom: '32px' }}>
          {PLATFORM_MODULES.map(mod => (
            <button
              key={mod.id}
              type="button"
              role="tab"
              className="subtab-btn"
              aria-selected={activeModule === mod.id}
              onClick={() => setActiveModule(mod.id)}
            >
              {mod.shortLabel}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="grid-2" style={{ alignItems: 'center', gap: '36px' }}>
          <div>
            <span className="badge badge-cobalt" style={{ marginBottom: '12px' }}>
              {current.badge}
            </span>
            <h3 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', marginBottom: '10px' }}>
              {current.title}
            </h3>
            <p style={{ color: 'var(--ink-secondary)', fontWeight: 500, marginBottom: '16px', fontSize: '1.02rem' }}>
              {current.subtitle}
            </p>
            <p style={{ marginBottom: '20px', lineHeight: 1.65 }}>
              {current.description}
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {current.highlights.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.94rem', color: 'var(--ink-primary)' }}>
                  <CheckCircle size={18} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', fontWeight: 600 }}>Geschikt voor:</span>
              {current.roles.map(role => (
                <span key={role} className="badge badge-neutral">
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div>{renderPreview(current.id)}</div>
        </div>
      </div>
    </section>
  );
}
