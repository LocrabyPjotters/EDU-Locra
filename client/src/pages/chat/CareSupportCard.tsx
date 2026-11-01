import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, HeartHandshake, Shield, ExternalLink, Copy, Check, School, Info, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export interface CareSupportHotline {
  name: string;
  phone?: string;
  chatUrl?: string;
  description: string;
  isPrimary?: boolean;
  isSchool?: boolean;
}

export interface CareSupportData {
  mode: 'crisis' | 'info';
  title: string;
  subtitle: string;
  hotlines: CareSupportHotline[];
}

interface SchoolConfidant {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

interface CareSupportCardProps {
  data: CareSupportData;
  theme?: 'light' | 'dark';
}

export default function CareSupportCard({ data, theme = 'dark' }: CareSupportCardProps) {
  const token = useAuthStore(state => state.token);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hotlines' | 'school'>('hotlines');
  const [schoolConfidants, setSchoolConfidants] = useState<SchoolConfidant[]>([]);

  const isLight = theme === 'light';
  const isCrisis = data.mode === 'crisis';

  useEffect(() => {
    const fetchConfidants = async () => {
      try {
        const authToken = token || localStorage.getItem('token');
        const res = await fetch('/api/users/confidants', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            setSchoolConfidants(list);
          }
        }
      } catch (e) {
        // Rustig negeren bij offline/netwerk issues
      }
    };
    fetchConfidants();
  }, [token]);

  const copyToClipboard = (number: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(number.replace(/[^0-9]/g, ''));
    setCopiedNumber(number);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const copyEmailToClipboard = (email: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const schoolHotline = data.hotlines.find(h => h.isSchool);
  const directHotlines = data.hotlines.filter(h => !h.isSchool);

  // ── Info (Subtiele Vangnet-versie bij biologische/historische/twijfel vragen) ──
  if (!isCrisis) {
    return (
      <div
        style={{
          marginTop: '1.25rem',
          padding: '1rem 1.25rem',
          borderRadius: '16px',
          background: isLight 
            ? 'linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(245, 243, 255, 0.95))' 
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(49, 46, 129, 0.4))',
          border: isLight ? '1px solid rgba(199, 210, 254, 0.8)' : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: isLight 
            ? '0 4px 16px rgba(99, 102, 241, 0.08)' 
            : '0 6px 20px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          fontSize: '0.875rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '999px',
              background: isLight ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.25)',
              color: isLight ? '#4f46e5' : '#a5b4fc',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            <Info size={13} />
            <span>Hulp & Ondersteuning</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
            24/7 Gratis & Anoniem
          </span>
        </div>

        <p style={{ margin: '0 0 0.85rem 0', color: isLight ? '#334155' : '#cbd5e1', lineHeight: 1.5 }}>
          {data.subtitle || 'Heb jij of iemand in je omgeving hulp nodig of donkere gedachten? Er zijn altijd mensen die anoniem en zonder oordeel naar je luisteren.'}
        </p>

        {/* Compacte Actieknoppen */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <a
            href="tel:08000113"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              background: '#4f46e5',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <Phone size={13} />
            <span>Bel 113 (0800-0113)</span>
          </a>

          <a
            href="https://www.113.nl"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
              color: isLight ? '#4f46e5' : '#e0e7ff',
              border: isLight ? '1px solid rgba(79, 70, 229, 0.2)' : '1px solid rgba(255, 255, 255, 0.15)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageCircle size={13} />
            <span>Chat via 113.nl</span>
            <ExternalLink size={11} style={{ opacity: 0.7 }} />
          </a>

          <a
            href="tel:08000432"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
              color: isLight ? '#475569' : '#cbd5e1',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.8rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Phone size={13} />
            <span>De Kindertelefoon (0800-0432)</span>
          </a>
        </div>
      </div>
    );
  }

  // ── Crisis Modus (Warme, beschermende en interactieve interface) ──
  return (
    <div
      style={{
        margin: '1rem 0',
        borderRadius: '20px',
        overflow: 'hidden',
        background: isLight
          ? 'linear-gradient(135deg, #ffffff 0%, #fbfbfe 100%)'
          : 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(30, 27, 75, 0.85) 100%)',
        border: isLight
          ? '2px solid rgba(239, 68, 68, 0.35)'
          : '2px solid rgba(244, 63, 94, 0.4)',
        boxShadow: isLight
          ? '0 12px 32px rgba(239, 68, 68, 0.12), 0 4px 12px rgba(99, 102, 241, 0.06)'
          : '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(244, 63, 94, 0.15)',
        backdropFilter: 'blur(16px)',
        position: 'relative'
      }}
    >
      {/* Top Banner & Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          background: isLight
            ? 'linear-gradient(90deg, rgba(254, 226, 226, 0.7), rgba(238, 242, 255, 0.7))'
            : 'linear-gradient(90deg, rgba(225, 29, 72, 0.22), rgba(99, 102, 241, 0.22))',
          borderBottom: isLight ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px'
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: isLight ? '#fee2e2' : 'rgba(244, 63, 94, 0.2)',
            border: isLight ? '1px solid #fca5a5' : '1px solid rgba(244, 63, 94, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isLight ? '#dc2626' : '#fb7185',
            flexShrink: 0
          }}
        >
          <HeartHandshake size={24} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 800,
                color: isLight ? '#0f172a' : '#f8fafc',
                letterSpacing: '-0.01em'
              }}
            >
              {data.title || 'We zijn er voor je — Praat erover'}
            </h3>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: isLight ? '#dcfce7' : 'rgba(34, 197, 94, 0.2)',
                color: isLight ? '#166534' : '#4ade80',
                border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(34, 197, 94, 0.3)'
              }}
            >
              24/7 Gratis & Anoniem
            </span>
          </div>
          <p
            style={{
              margin: '0.4rem 0 0 0',
              fontSize: '0.9rem',
              color: isLight ? '#475569' : '#cbd5e1',
              lineHeight: 1.5
            }}
          >
            {data.subtitle}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          padding: '0.5rem 1.25rem 0 1.25rem',
          background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.5)',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
          gap: '8px'
        }}
      >
        <button
          onClick={() => setActiveTab('hotlines')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'hotlines' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'hotlines' 
              ? (isLight ? '#dc2626' : '#f43f5e') 
              : (isLight ? '#64748b' : '#94a3b8'),
            fontWeight: activeTab === 'hotlines' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Phone size={14} />
          <span>Landelijke Hulplijnen (Direct)</span>
        </button>

        {schoolHotline && (
          <button
            onClick={() => setActiveTab('school')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'school' ? '2px solid #ef4444' : '2px solid transparent',
              color: activeTab === 'school' 
                ? (isLight ? '#dc2626' : '#f43f5e') 
                : (isLight ? '#64748b' : '#94a3b8'),
              fontWeight: activeTab === 'school' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <School size={14} />
            <span>Op School Praten</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div style={{ padding: '1.25rem' }}>
        {activeTab === 'hotlines' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {directHotlines.map((hotline, idx) => {
              const is113 = hotline.phone === '0800-0113';
              return (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    background: is113
                      ? (isLight ? 'linear-gradient(135deg, #fef2f2, #ffffff)' : 'rgba(239, 68, 68, 0.08)')
                      : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'),
                    border: is113
                      ? (isLight ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)')
                      : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isLight ? '#0f172a' : '#f8fafc' }}>
                          {hotline.name}
                        </span>
                        {is113 && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#ef4444',
                              color: '#ffffff',
                              fontWeight: 700
                            }}
                          >
                            AANBEVOLEN
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                        {hotline.description}
                      </p>
                    </div>

                    {hotline.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: isLight ? '#dc2626' : '#fb7185',
                            padding: '3px 8px',
                            background: isLight ? '#fee2e2' : 'rgba(244, 63, 94, 0.15)',
                            borderRadius: '8px'
                          }}
                        >
                          {hotline.phone}
                        </span>
                        <button
                          onClick={(e) => copyToClipboard(hotline.phone!, e)}
                          title="Kopieer telefoonnummer"
                          style={{
                            border: 'none',
                            background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                            color: isLight ? '#475569' : '#cbd5e1',
                            padding: '6px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {copiedNumber === hotline.phone ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actieknoppen */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {hotline.phone && (
                      <a
                        href={`tel:${hotline.phone.replace(/[^0-9]/g, '')}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          background: is113 ? '#ef4444' : (isLight ? '#0f172a' : '#334155'),
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          boxShadow: is113 ? '0 2px 10px rgba(239, 68, 68, 0.35)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Phone size={14} />
                        <span>Bel direct {hotline.phone}</span>
                      </a>
                    )}

                    {hotline.chatUrl && (
                      <a
                        href={hotline.chatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                          color: isLight ? '#0f172a' : '#f8fafc',
                          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <MessageCircle size={14} />
                        <span>Start Anonieme Chat</span>
                        <ExternalLink size={12} style={{ opacity: 0.6 }} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: isLight ? '#e0e7ff' : 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLight ? '#4f46e5' : '#818cf8',
                  flexShrink: 0
                }}
              >
                <Shield size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isLight ? '#0f172a' : '#f8fafc' }}>
                  Vertrouwenspersoon van jouw school
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                  Veilig, 100% vertrouwelijk en op school aanwezig
                </p>
              </div>
            </div>

            {/* Lijst van actieve vertrouwenspersonen van de school indien aanwezig */}
            {schoolConfidants.length > 0 ? (
              <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Aangestelde Vertrouwenspersonen op jouw school:
                </div>
                {schoolConfidants.map(confidant => (
                  <div
                    key={confidant.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.03)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isLight ? '#0f172a' : '#f8fafc' }}>
                            {confidant.displayName || confidant.username}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                            Officiële Vertrouwenspersoon
                          </div>
                        </div>
                      </div>

                      {confidant.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.825rem',
                              color: isLight ? '#4f46e5' : '#a5b4fc',
                              padding: '3px 8px',
                              background: isLight ? '#e0e7ff' : 'rgba(99, 102, 241, 0.15)',
                              borderRadius: '6px'
                            }}
                          >
                            {confidant.email}
                          </span>
                          <button
                            onClick={(e) => copyEmailToClipboard(confidant.email, e)}
                            title="Kopieer e-mailadres"
                            style={{
                              border: 'none',
                              background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                              color: isLight ? '#475569' : '#cbd5e1',
                              padding: '6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {copiedEmail === confidant.email ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {confidant.email && (
                      <div style={{ marginTop: '4px' }}>
                        <a
                          href={`mailto:${confidant.email}?subject=Vertrouwelijk%20gesprek%20aanvragen%20(Locra)`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: '#4f46e5',
                            color: '#ffffff',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Mail size={13} />
                          <span>✉️ Stuur Vertrouwelijke E-mail</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: isLight ? '#334155' : '#cbd5e1', lineHeight: 1.6 }}>
                Elke school heeft minimaal één officiële vertrouwenspersoon en een zorgcoördinator. Zij zijn er speciaal voor wanneer het thuis niet lekker gaat, als je gepest wordt, of als je worstelt met sombere gevoelens.
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
                fontSize: '0.825rem'
              }}
            >
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontWeight: 700, color: isLight ? '#0f172a' : '#f8fafc' }}>🔒 100% Vertrouwelijk</span>
                <p style={{ margin: '4px 0 0 0', color: isLight ? '#64748b' : '#94a3b8' }}>
                  Wat je bespreekt blijft strikt tussen jou en de vertrouwenspersoon. Er wordt niets gedeeld zonder jouw medeweten.
                </p>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontWeight: 700, color: isLight ? '#0f172a' : '#f8fafc' }}>🏫 Hoe vind je hen?</span>
                <p style={{ margin: '4px 0 0 0', color: isLight ? '#64748b' : '#94a3b8' }}>
                  Vraag je mentor, loop binnen bij de zorgkamer, of stuur direct een bericht via het e-mailadres hierboven.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standaard fallback data als JSON parsing faalt door onzichtbare tekens of formatting
 */
export const DEFAULT_CARE_SUPPORT_DATA: CareSupportData = {
  mode: 'info',
  title: 'Hulp & Ondersteuning — Altijd Bereikbaar',
  subtitle: 'Heb jij of iemand in je omgeving te maken met moeilijke gevoelens of donkere gedachten? Er zijn altijd deskundige mensen die gratis en anoniem naar je luisteren.',
  hotlines: [
    {
      name: '113 Zelfmoordpreventie',
      phone: '0800-0113',
      chatUrl: 'https://www.113.nl',
      description: 'Dag en nacht 24/7 gratis & anoniem bellen of chatten via 113.nl.',
      isPrimary: true
    },
    {
      name: 'De Kindertelefoon',
      phone: '0800-0432',
      chatUrl: 'https://www.kindertelefoon.nl',
      description: 'Voor jongeren tot 18 jaar. Elke dag gratis en vertrouwelijk bellen of chatten (11:00 - 21:00).',
      isPrimary: false
    },
    {
      name: 'Alles Oké? Supportlijn',
      phone: '0800-0450',
      chatUrl: 'https://www.allesoke.nl',
      description: 'Voor jongvolwassenen van 18 t/m 24 jaar. Dagelijks tussen 14:00 en 22:00 bereikbaar.',
      isPrimary: false
    },
    {
      name: 'Vertrouwenspersoon op jouw school',
      description: 'Je kunt altijd terecht bij de zorgcoördinator, mentor of vertrouwenspersoon op school voor een discreet en veilig gesprek.',
      isSchool: true
    }
  ]
};

/**
 * Parse :::care_support { JSON } ::: blocks from message content.
 * Filtert gegarandeerd alle verborgen Unicode/watermerk-tekens weg,
 * en garandeert dat de ruwe :::care_support string NOOIT op het scherm blijft staan.
 */
export function parseCareSupportBlocks(content: string): { before: string; careSupport: CareSupportData | null; after: string } {
  if (!content) return { before: '', careSupport: null, after: '' };

  const careRegex = /:::care_support\s*([\s\S]*?)\s*:::/i;
  const match = content.match(careRegex);

  if (!match) {
    return { before: content, careSupport: null, after: '' };
  }

  const before = content.substring(0, match.index || 0).trim();
  const after = content.substring((match.index || 0) + match[0].length).trim();

  try {
    // Strip alle eventuele verborgen Unicode tekens / zero-width spaces van watermarking:
    const cleanJson = match[1]
      .replace(/[\u200B-\u200D\u200E\u200F\u2060\u200A\uFEFF]/g, '')
      .trim();

    const parsedData = JSON.parse(cleanJson) as CareSupportData;
    if (parsedData && parsedData.title && Array.isArray(parsedData.hotlines)) {
      return { before, careSupport: parsedData, after };
    }
  } catch (e) {
    console.warn('Kon care_support JSON niet parsen, val terug op veilige default:', e);
  }

  // Fallback: Als er wél een :::care_support tag stond maar parsing faalde,
  // toon ALSNOG de mooie card met de standaard hulplijnen en verberg de ruwe code:
  const isCrisisMode = match[1].includes('"crisis"');
  const fallbackData: CareSupportData = {
    ...DEFAULT_CARE_SUPPORT_DATA,
    mode: isCrisisMode ? 'crisis' : 'info',
    title: isCrisisMode ? 'We zijn er voor je — Praat erover' : DEFAULT_CARE_SUPPORT_DATA.title
  };

  return { before, careSupport: fallbackData, after };
}

