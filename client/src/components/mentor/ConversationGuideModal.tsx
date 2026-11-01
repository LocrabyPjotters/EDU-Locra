import React from 'react';

interface ConversationGuideModalProps {
  guide: string;
  studentName?: string;
  onClose: () => void;
}

export default function ConversationGuideModal({ guide, studentName, onClose }: ConversationGuideModalProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(guide);
    alert('Gespreksleidraad gekopieerd naar klembord!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(239, 68, 68, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>📋</span>
              <h3 style={{ margin: 0, color: '#fca5a5', fontSize: '1.15rem', fontWeight: 800 }}>
                Vertrouwelijke Gespreksleidraad
              </h3>
            </div>
            {studentName && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                Mentoropvolging voor: <strong style={{ color: '#f8fafc' }}>{studentName}</strong>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, color: '#e2e8f0', fontSize: '0.92rem', lineHeight: '1.6' }}>
          <div style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '1.25rem',
            color: '#fef08a',
            fontSize: '0.82rem',
            display: 'flex',
            gap: '10px'
          }}>
            <span>🔒</span>
            <div>
              <strong>AVG & Pedagogische Vertrouwelijkheid:</strong> Confronteer de leerling nooit direct met digitale AI-detecties. Gebruik deze leidraad om vanuit je eigen menselijke rol als mentor een open, veilig gesprek te voeren.
            </div>
          </div>

          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {guide}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.3)'
        }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              fontSize: '0.82rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            📋 Kopieer Leidraad
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
