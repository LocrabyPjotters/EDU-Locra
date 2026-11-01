import React from 'react';

interface SentinelReflectionModalProps {
  reason: string;
  reflectionPrompt: string;
  onClose: () => void;
}

export default function SentinelReflectionModal({ reason, reflectionPrompt, onClose }: SentinelReflectionModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
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
          maxWidth: '520px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          boxShadow: '0 25px 50px -12px rgba(234, 179, 8, 0.25)',
          overflow: 'hidden',
          padding: '1.75rem'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🤝</div>
          <h3 style={{ margin: 0, color: '#fde047', fontSize: '1.25rem', fontWeight: 800 }}>
            Locra Klas Sentinel
          </h3>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px' }}>
            Even stilstaan bij je bericht
          </div>
        </div>

        <div style={{
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          color: '#fef08a',
          fontSize: '0.88rem',
          lineHeight: '1.5',
          marginBottom: '1.25rem'
        }}>
          <strong>Gesignaleerd:</strong> {reason}
          <div style={{ marginTop: '8px', color: '#f8fafc', fontSize: '0.84rem' }}>
            {reflectionPrompt}
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.78rem',
          color: '#94a3b8',
          marginBottom: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          💡 <strong>Tip:</strong> In een fijne schoolklas werken we samen en helpen we elkaar. Herschrijf je bericht op een respectvolle manier om verder te gaan.
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
            color: '#0f172a',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Ik pas mijn bericht aan
        </button>
      </div>
    </div>
  );
}
