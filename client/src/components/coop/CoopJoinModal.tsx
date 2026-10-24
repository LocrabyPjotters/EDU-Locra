import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { KeyRound, X, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface CoopJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (roomId: string) => void;
}

export default function CoopJoinModal({ isOpen, onClose, onJoined }: CoopJoinModalProps) {
  const token = useAuthStore(s => s.token);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Automatically prepend COP- if user just enters the 4 characters
    if (val.length <= 8) {
      setCode(val);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let clean = code.trim().toUpperCase();
    if (!clean) {
      setError('Voer a.u.b. een kamercode in');
      return;
    }

    if (!clean.startsWith('COP-') && clean.length === 4) {
      clean = `COP-${clean}`;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat/coop/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: clean })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kon niet deelnemen aan de projectkamer');
      }

      onJoined(data.conversationId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Onbekende fout bij deelnemen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 18, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.95), rgba(12, 17, 33, 0.98))',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '440px',
        padding: '2rem',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.15)',
        position: 'relative'
      }}>
        {/* Sluitknop */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { (e.currentTarget.style.color = '#fff'); (e.currentTarget.style.background = 'rgba(255,255,255,0.12)'); }}
          onMouseLeave={e => { (e.currentTarget.style.color = 'rgba(255,255,255,0.6)'); (e.currentTarget.style.background = 'rgba(255,255,255,0.05)'); }}
        >
          <X size={16} />
        </button>

        {/* Header Icoon & Titel */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.2)'
          }}>
            <KeyRound size={26} color="#818cf8" />
          </div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Deelnemen aan Projectkamer
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.55)', lineHeight: 1.5 }}>
            Voer de 6-cijferige code in van je groepslid of docent om direct mee te werken in de studio.
          </p>
        </div>

        {/* Formulier */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kamercode
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={code}
                onChange={handleInputChange}
                placeholder="COP-XXXX of XXXX"
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.8)',
                  border: error ? '1px solid #ef4444' : '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '14px',
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textAlign: 'center',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)'
                }}
                onFocus={e => e.target.style.borderColor = '#818cf8'}
                onBlur={e => { if (!error) e.target.style.borderColor = 'rgba(99, 102, 241, 0.35)'; }}
              />
            </div>
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center', fontWeight: 500 }}>
                {error}
              </div>
            )}
          </div>

          <div style={{
            background: 'rgba(99, 102, 241, 0.07)',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: '1px solid rgba(99, 102, 241, 0.15)'
          }}>
            <Sparkles size={18} color="#a5b4fc" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.4 }}>
              Een code ziet er bijvoorbeeld uit als <strong style={{ color: '#a5b4fc' }}>COP-8Y42</strong>.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                flex: 1.5,
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                border: 'none',
                color: '#fff',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !code.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Kamer zoeken...</span>
                </>
              ) : (
                <>
                  <span>Deelnemen</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
