import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';
import {
  X, BarChart2, CheckCircle2, AlertTriangle, Users,
  Trophy, ArrowRight, Sparkles, Printer, Loader2
} from 'lucide-react';

interface LiveResultsModalProps {
  sessionId: string;
  onClose: () => void;
}

export default function LiveResultsModal({ sessionId, onClose }: LiveResultsModalProps) {
  const token = useAuthStore(s => s.token);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !token) return;
    setLoading(true);
    fetch(`/api/live/sessions/${sessionId}/results`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message || 'Kon resultaten niet laden'))
      .finally(() => setLoading(false));
  }, [sessionId, token]);

  if (!sessionId) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.98), rgba(12, 16, 33, 0.99))',
        border: '1px solid rgba(124, 92, 252, 0.35)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2.2rem',
        boxShadow: '0 30px 80px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(124, 92, 252, 0.2)',
        position: 'relative',
        color: '#fff'
      }}>
        {/* Sluitknop */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
            <Loader2 size={36} className="spin" color="#818cf8" />
            <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Formatieve resultaten analyseren...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: '#fca5a5' }}>
            <p>{error}</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.8rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
              }}>
                <BarChart2 size={26} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                  Formatief Lesverslag: {data?.session?.title}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {data?.session?.subject || 'Vak'} • {data?.session?.totalParticipants || 0} deelnemers • Gespeeld op {new Date(data?.session?.startedAt || Date.now()).toLocaleDateString('nl-NL')}
                </p>
              </div>
            </div>

            {/* Slide Analytics List */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.8rem', color: '#c4b5fd' }}>
              Begrip per vraag & onderdeel:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {(data?.slideAnalytics || []).map((sa: any) => (
                <div
                  key={sa.slideIndex}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: sa.needsReview ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '1rem 1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                        #{sa.slideIndex + 1}
                      </span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{sa.title}</span>
                      {sa.needsReview && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>
                          Aandachtspunt (&lt; 60% goed)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      Type: {sa.type} • {sa.totalAnswered} antwoorden
                    </div>
                  </div>

                  {sa.type === 'multiple_choice' && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: sa.percentageCorrect >= 75 ? '#4ade80' : sa.percentageCorrect >= 60 ? '#facc15' : '#f87171'
                      }}>
                        {sa.percentageCorrect}%
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
                        {sa.correctCount} / {sa.totalAnswered} goed
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Top Scores */}
            {data?.topParticipants && data.topParticipants.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.8rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={18} color="#facc15" />
                  <span>Klassikaal Podium (Top Deelnemers)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {data.topParticipants.slice(0, 3).map((p: any, idx: number) => (
                    <div
                      key={p.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '1rem',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.nickname}</div>
                      <div style={{ color: '#818cf8', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                        {p.score} <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>pnt</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                        {p.accuracy}% accuratesse
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
