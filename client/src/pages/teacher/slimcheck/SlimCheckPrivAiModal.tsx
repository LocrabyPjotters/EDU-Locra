import React, { useState } from 'react';
import { Lock, Sparkles, X, Check, Server, EyeOff, Award } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SlimCheckPrivAiModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setJoined(true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 7, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(23, 27, 44, 0.98), rgba(13, 16, 28, 0.98))',
        border: '1px solid rgba(124, 92, 252, 0.3)',
        borderRadius: '24px',
        maxWidth: '640px',
        width: '100%',
        padding: '36px',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 92, 252, 0.15)',
        color: '#f1f5f9'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {/* Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.25), rgba(56, 189, 248, 0.25))',
            border: '1px solid rgba(124, 92, 252, 0.5)',
            color: '#c4b5fd',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={14} color="#38bdf8" /> BINNENKORT BESCHIKBAAR
          </span>
          <span style={{
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: '#34d399',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 600
          }}>
            Q2 2027
          </span>
        </div>

        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          fontFamily: 'Outfit, sans-serif',
          margin: '0 0 10px 0',
          background: 'linear-gradient(135deg, #ffffff, #c4b5fd, #38bdf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Locra PrivAI™
        </h2>

        <p style={{
          color: '#94a3b8',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          <em>"Krachtige AI-nakijking vanuit de cloud — 100% privacyproof gegarandeerd."</em>
        </p>

        {/* Feature Highlights Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px',
          marginBottom: '28px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <Lock size={20} color="#7c5cfc" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>OpenPCC Enclave</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8b9dc3', lineHeight: '1.4' }}>
                End-to-end versleuteld in een hardware enclave. Zelfs Locra-engineers kunnen uw scans nooit inzien.
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <Server size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>Cloud Schaalbaarheid</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8b9dc3', lineHeight: '1.4' }}>
                Geen zware lokale GPU nodig op school. Hele jaarlagen binnen enkele minuten nagekeken.
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <Award size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>Klaar voor Summatief</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8b9dc3', lineHeight: '1.4' }}>
                Zodra officieel gecertificeerd, ook geschikt voor summatieve schoolexamens en rapporttoetsen.
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <EyeOff size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>Zero Data Retention</h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8b9dc3', lineHeight: '1.4' }}>
                Direct na verwerking worden alle tijdelijke enclaves gewist uit het geheugen.
              </p>
            </div>
          </div>
        </div>

        {/* Waitlist Form */}
        <div style={{
          background: 'rgba(124, 92, 252, 0.08)',
          border: '1px solid rgba(124, 92, 252, 0.25)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          {joined ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#34d399' }}>
              <Check size={20} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Bedankt! U staat op de waitlist voor Locra PrivAI™. We houden u op de hoogte.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
                Wilt u als eerste toegang tot de besloten bèta voor uw school?
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  required
                  placeholder="Uw school e-mailadres..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(10, 14, 26, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    boxShadow: '0 4px 14px rgba(124, 92, 252, 0.4)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Meld mij aan
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
