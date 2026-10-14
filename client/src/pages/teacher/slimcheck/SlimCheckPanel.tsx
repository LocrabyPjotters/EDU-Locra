import { useState, useEffect } from 'react';
import {
  Plus, Sparkles, AlertTriangle, Trash2, ArrowRight, Lock, BarChart3
} from 'lucide-react';
import SlimCheckWizard from './SlimCheckWizard';
import SlimCheckResults from './SlimCheckResults';
import SlimCheckAnalytics from './SlimCheckAnalytics';
import SlimCheckPrivAiModal from './SlimCheckPrivAiModal';

interface Props {
  token: string;
  classes: any[];
  assignments: any[];
}

export default function SlimCheckPanel({ token, classes, assignments }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'wizard' | 'results' | 'analytics'>('list');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showPrivAiModal, setShowPrivAiModal] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/slimcheck/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [token]);

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Weet u zeker dat u deze nakijksessie en alle bijbehorende scans wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/slimcheck/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      alert('Verwijderen mislukt');
    }
  };

  const getStatusBadge = (status: string, isPublished: boolean) => {
    if (isPublished) {
      return (
        <span style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399', fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
          ✅ Gepubliceerd
        </span>
      );
    }
    switch (status) {
      case 'review':
        return (
          <span style={{ background: 'rgba(124, 92, 252, 0.18)', border: '1px solid #7c5cfc', color: '#c4b5fd', fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
            🔍 Controle vereist
          </span>
        );
      case 'processing':
        return (
          <span style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
            ⏳ AI Bezig
          </span>
        );
      case 'redacting':
        return (
          <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid #fbbf24', color: '#fbbf24', fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
            ✂️ Anonimiseren
          </span>
        );
      default:
        return (
          <span style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8', fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 600 }}>
            Concept
          </span>
        );
    }
  };

  if (activeView === 'wizard') {
    return (
      <SlimCheckWizard
        token={token}
        classes={classes}
        assignments={assignments}
        onFinish={(newId) => {
          setSelectedSessionId(newId);
          setActiveView('results');
          loadSessions();
        }}
        onCancel={() => setActiveView('list')}
      />
    );
  }

  if (activeView === 'results' && selectedSessionId) {
    return (
      <SlimCheckResults
        sessionId={selectedSessionId}
        token={token}
        onBack={() => {
          setActiveView('list');
          setSelectedSessionId(null);
          loadSessions();
        }}
      />
    );
  }

  if (activeView === 'analytics' && selectedSessionId) {
    return (
      <SlimCheckAnalytics
        sessionId={selectedSessionId}
        token={token}
        onBack={() => {
          setActiveView('list');
          setSelectedSessionId(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner with Action */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(56, 189, 248, 0.3))',
            border: '1px solid rgba(124, 92, 252, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem'
          }}>
            🧠
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              SlimCheck — AI Nakijkhulp
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Upload gescande toetsen, redigeer namen permanent en laat lokale AI handschrift beoordelen.
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveView('wizard')}
          style={{
            background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(124, 92, 252, 0.4)'
          }}
        >
          <Plus size={18} /> Nieuwe Nakijksessie
        </button>
      </div>

      {/* Formative Notice Alert */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '16px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.82rem', color: '#fef3c7', lineHeight: '1.4' }}>
          <strong>Alleen voor formatieve toetsen:</strong> SlimCheck is uitsluitend bedoeld voor diagnostische doeleinden en oefentoetsen. De docent houdt altijd de eindverantwoordelijkheid en kan punten inline aanpassen.
        </div>
      </div>
 {/* OPENPCC Notice Alert */}
      <div style={{
        background: 'rgba(11, 167, 245, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '16px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertTriangle size={20} color="#248cfbff" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.82rem', color: '#fef3c7', lineHeight: '1.4' }}>
          <strong>Let op:</strong> SlimCheck is vanaf <strong>01 Januari 2027</strong> enkel te gebruiken met de gratis OpenPCC encryptie wegens nieuwe Europese wetgeving.
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          Sessies inladen...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          background: 'rgba(17, 24, 39, 0.5)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#fff' }}>Nog geen nakijksessies aangemaakt</h3>
          <p style={{ margin: '0 0 18px 0', fontSize: '0.85rem' }}>Klik op "+ Nieuwe Nakijksessie" om een PDF toetsenscan te uploaden.</p>
          <button
            onClick={() => setActiveView('wizard')}
            style={{ background: '#7c5cfc', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
          >
            Start eerste sessie
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => {
                setSelectedSessionId(s.id);
                setActiveView('results');
              }}
              style={{
                background: 'rgba(17, 24, 39, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {s.subject || 'Algemeen'}
                  </span>
                  {getStatusBadge(s.status, s.isPublished)}
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                  {s.title}
                </h3>

                {s.class && (
                  <div style={{ fontSize: '0.8rem', color: '#c4b5fd', marginBottom: '8px' }}>
                    👥 Klas: {s.class.name}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                paddingTop: '12px',
                fontSize: '0.78rem',
                color: '#94a3b8'
              }}>
                <div>
                  {s._count?.scans || 0} leerlingen • {s._count?.questions || 0} vragen
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(s.status === 'review' || s.status === 'done' || s.isPublished) && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedSessionId(s.id);
                        setActiveView('analytics');
                      }}
                      title="Analyse bekijken"
                      style={{ background: 'rgba(124, 92, 252, 0.12)', border: '1px solid rgba(124, 92, 252, 0.3)', color: '#c4b5fd', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.12)'; }}
                    >
                      <BarChart3 size={14} /> Analyse
                    </button>
                  )}
                  <button
                    onClick={e => handleDeleteSession(s.id, e)}
                    title="Verwijder sessie"
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                  >
                    <Trash2 size={16} />
                  </button>
                  <ArrowRight size={16} color="#7c5cfc" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Marketing Teaser Banner: Locra PrivAI™ */}
      <div style={{
        marginTop: '20px',
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(56, 189, 248, 0.12))',
        border: '1px solid rgba(124, 92, 252, 0.25)',
        borderRadius: '16px',
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(124, 92, 252, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color="#c4b5fd" />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>
              🔒 Binnenkort: Locra PrivAI™ — Nakijken in de cloud met OpenPCC-garantie
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Zelfs Locra kan uw toetsdata niet inzien. Geen lokale GPU vereist. Geschikt voor summatief na certificering.
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowPrivAiModal(true)}
          style={{
            background: 'rgba(124, 92, 252, 0.2)',
            border: '1px solid rgba(124, 92, 252, 0.4)',
            color: '#c4b5fd',
            padding: '8px 18px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Sparkles size={14} /> Meer info & Waitlist
        </button>
      </div>

      {/* PrivAI Modal */}
      <SlimCheckPrivAiModal
        isOpen={showPrivAiModal}
        onClose={() => setShowPrivAiModal(false)}
      />
    </div>
  );
}
