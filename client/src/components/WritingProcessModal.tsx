import React from 'react';

export interface WritingTimelineEvent {
  timestamp: number;
  wordCount: number;
  type: 'typing' | 'paste' | 'ai_edit' | 'manual_edit';
  summary: string;
}

export interface WritingProcessStats {
  startedAt: number;
  totalActiveTimeMs: number;
  totalKeystrokes: number;
  pasteEvents: number;
  totalPastedChars: number;
  totalTypedChars: number;
  aiAssistsCount: number;
  timeline: WritingTimelineEvent[];
}

interface WritingProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  docTitle: string;
  stats: WritingProcessStats;
  currentWordCount: number;
  theme?: 'light' | 'dark';
}

export default function WritingProcessModal({
  isOpen,
  onClose,
  docTitle,
  stats,
  currentWordCount,
  theme = 'dark'
}: WritingProcessModalProps) {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const totalChars = (stats.totalTypedChars || 0) + (stats.totalPastedChars || 0);
  const typingPercentage = totalChars > 0
    ? Math.round((stats.totalTypedChars / totalChars) * 100)
    : 100;

  const minutes = Math.floor(stats.totalActiveTimeMs / 60000);
  const seconds = Math.floor((stats.totalActiveTimeMs % 60000) / 1000);

  const handleDownloadReport = () => {
    const reportData = {
      title: docTitle || 'Naamloos document',
      generatedAt: new Date().toISOString(),
      studentStats: {
        activeWritingTimeMinutes: (stats.totalActiveTimeMs / 60000).toFixed(1),
        totalKeystrokes: stats.totalKeystrokes,
        totalWords: currentWordCount,
        typingAuthenticityPercentage: typingPercentage,
        pasteEventsCount: stats.pasteEvents,
        totalPastedChars: stats.totalPastedChars,
        aiAssistsCount: stats.aiAssistsCount,
      },
      timeline: stats.timeline.map(e => ({
        time: new Date(e.timestamp).toLocaleTimeString(),
        event: e.type,
        wordCount: e.wordCount,
        summary: e.summary
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `authenticiteitsrapport_${(docTitle || 'document').toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 20, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: isLight ? '#ffffff' : '#111827',
        border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: isLight ? '#1f2937' : '#f9fafb',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: `1px solid ${isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⏱️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                Schrijfproces & Authenticiteit
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: isLight ? '#6b7280' : '#9ca3af' }}>
                Document: <strong>{docTitle || 'Naamloos document'}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleDownloadReport}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                color: '#fff',
                border: 'none',
                padding: '7px 13px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              📄 Download Rapport
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#9ca3af' : '#6b7280',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Authenticiteit Score Banner */}
          <div style={{
            background: typingPercentage >= 80
              ? (isLight ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.15)')
              : (isLight ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.15)'),
            border: `1px solid ${typingPercentage >= 80 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`,
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: typingPercentage >= 80 ? '#22c55e' : '#eab308',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Authenticiteit & Eigen Inbreng
              </span>
              <h4 style={{ margin: '4px 0 2px', fontSize: '1.25rem', fontWeight: 800 }}>
                {typingPercentage}% Handmatig getypt
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: isLight ? '#4b5563' : '#d1d5db' }}>
                {typingPercentage >= 80
                  ? 'Dit document toont een hoog percentage authentieke toetsenbordinvoer.'
                  : 'Let op: een aanzienlijk deel van de tekst is ingeplakt of via klembord toegevoegd.'}
              </p>
            </div>

            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: typingPercentage >= 80 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              flexShrink: 0
            }}>
              {typingPercentage >= 80 ? '✍️' : '📋'}
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px'
          }}>
            <div style={{
              background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.2rem' }}>⏱️</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                {minutes}m {seconds}s
              </div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#6b7280' : '#9ca3af' }}>Actieve Schrijftijd</div>
            </div>

            <div style={{
              background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.2rem' }}>⌨️</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                {stats.totalKeystrokes}
              </div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#6b7280' : '#9ca3af' }}>Toetsaanslagen</div>
            </div>

            <div style={{
              background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.2rem' }}>📋</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                {stats.pasteEvents} ({stats.totalPastedChars} tekens)
              </div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#6b7280' : '#9ca3af' }}>Plak-incidenten</div>
            </div>

            <div style={{
              background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.2rem' }}>✨</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                {stats.aiAssistsCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: isLight ? '#6b7280' : '#9ca3af' }}>AI Interacties</div>
            </div>
          </div>

          {/* Timeline of Writing Process */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#6366f1' }}>
              📜 Schrijfproces Tijdlijn
            </h4>

            {stats.timeline.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                fontSize: '0.82rem',
                color: isLight ? '#9ca3af' : '#6b7280',
                background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)',
                borderRadius: '12px'
              }}>
                Nog geen schrijfgebeurtenissen geregistreerd. Begin met typen in Locra Docs!
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}>
                {stats.timeline.map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}`,
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        {event.type === 'typing' ? '✍️' : event.type === 'paste' ? '📋' : event.type === 'ai_edit' ? '✨' : '📝'}
                      </span>
                      <span>{event.summary}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.72rem' }}>
                      <span>{event.wordCount} woorden</span>
                      <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
