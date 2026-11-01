import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Clock,
  ArrowRight,
  UserCheck
} from 'lucide-react';

interface RequestData {
  id: string;
  token: string;
  status: string;
  scope: string;
  expiresAt: string;
  createdAt: string;
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }[];
  };
  requestedBy: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
  targetUser: {
    id: string;
    username: string;
    displayName: string;
  };
}

export default function AccessConsentPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<RequestData | null>(null);

  // Form states
  const [scope, setScope] = useState<'full' | 'selection' | 'metadata_only'>('full');
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/access-request/${token}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Kon verzoek niet ophalen');
        setRequestData(data);
        // Default: pre-select all messages for convenience
        if (data.conversation?.messages) {
          setSelectedMsgIds(data.conversation.messages.map((m: any) => m.id));
        }
      })
      .catch(err => {
        setError(err.message || 'Verzoek niet gevonden of verlopen');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleRespond = async (action: 'approve' | 'reject') => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/access-request/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          scope: action === 'approve' ? scope : 'metadata_only',
          selectedMsgIds: action === 'approve' && scope === 'selection' ? selectedMsgIds : []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fout bij opslaan van keuze');
      setSubmittedStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMsgSelection = (id: string) => {
    setSelectedMsgIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          <div style={{ fontSize: '1rem', color: '#94a3b8' }}>Verzoek tot inzage wordt geladen...</div>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '1.5rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '20px', padding: '2rem', textAlign: 'center', color: '#f8fafc' }}>
          <AlertCircle size={48} color="#f87171" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', color: '#f87171' }}>Verzoek Niet Beschikbaar</h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>{error || 'Deze link is mogelijk verlopen, al eerder beantwoord of ongeldig.'}</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.7rem 1.4rem', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
            Naar Locra Home
          </Link>
        </div>
      </div>
    );
  }

  const requesterName = requestData.requestedBy.displayName || requestData.requestedBy.username;
  const requesterRole = requestData.requestedBy.role === 'admin' ? 'Beheerder' : requestData.requestedBy.role === 'teacher' ? 'Docent' : requestData.requestedBy.role;
  const isExpired = new Date(requestData.expiresAt) < new Date();
  const alreadyResolved = requestData.status !== 'pending' || submittedStatus !== null;
  const currentStatus = submittedStatus || requestData.status;

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ maxWidth: '680px', width: '100%', background: '#1e293b', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.15))', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Shield size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff' }}>Toestemming voor Chat-Inzage</h1>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Locra Privacy &amp; Leerlingregie</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            <strong>{requesterName}</strong> ({requesterRole}) heeft verzocht om een van jouw AI-gesprekken in te zien. Jij bepaalt zelf of en wat je wilt delen.
          </p>
        </div>

        {/* Conversation Summary Card */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <MessageSquare size={16} color="#38bdf8" />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                {requestData.conversation.title}
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span>Aantal berichten: <strong>{requestData.conversation.messages?.length || 0}</strong></span>
              <span>Aangemaakt: <strong>{new Date(requestData.conversation.createdAt).toLocaleDateString('nl-NL')}</strong></span>
            </div>
          </div>
        </div>

        {/* Status result if already resolved */}
        {alreadyResolved ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            {currentStatus === 'approved' ? (
              <div>
                <CheckCircle size={54} color="#4ade80" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80', margin: '0 0 0.5rem' }}>Toestemming Verleend</h3>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Je hebt {scope === 'full' ? 'het volledige gesprek' : scope === 'selection' ? `${selectedMsgIds.length} geselecteerde berichten` : 'alleen de metadata'} vrijgegeven aan {requesterName}.
                </p>
              </div>
            ) : (
              <div>
                <XCircle size={54} color="#f87171" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', margin: '0 0 0.5rem' }}>Inzage Geweigerd</h3>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Je hebt dit inzageverzoek afgewezen. De inhoud van jouw gesprek blijft strikt versleuteld en niet leesbaar voor de docent of beheerder.
                </p>
              </div>
            )}
            <Link
              to="/chat"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.88rem'
              }}
            >
              <span>Terug naar je Chats</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : isExpired ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <AlertCircle size={48} color="#fbbf24" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', margin: '0 0 0.5rem' }}>Dit verzoek is verlopen</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>De geldigheidsduur van 7 dagen is verstreken. De inhoud is versleuteld gebleven.</p>
          </div>
        ) : (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', color: '#fff' }}>
              Kies wat je wilt delen:
            </div>

            {/* Scope Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: scope === 'full' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.025)',
                  border: scope === 'full' ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'full'}
                  onChange={() => setScope('full')}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                    1. Volledig gesprek delen
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    De aanvrager mag alle berichten en AI-antwoorden in dit gesprek inzien.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: scope === 'selection' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.025)',
                  border: scope === 'selection' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'selection'}
                  onChange={() => setScope('selection')}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                    2. Alleen geselecteerde berichten delen
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Vink hieronder zelf aan welke berichten relevant zijn. De overige berichten blijven versleuteld.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: scope === 'metadata_only' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.025)',
                  border: scope === 'metadata_only' ? '1px solid #eab308' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'metadata_only'}
                  onChange={() => setScope('metadata_only')}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                    3. Alleen titel en datum delen (inhoud blijft versleuteld)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    De aanvrager ziet alleen dat je een gesprek hebt met deze titel, maar kan geen enkel bericht lezen.
                  </div>
                </div>
              </label>
            </div>

            {/* Selection Checklist if scope === 'selection' */}
            {scope === 'selection' && requestData.conversation.messages && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                    Selecteer berichten ({selectedMsgIds.length} van {requestData.conversation.messages.length} gekozen):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMsgIds.length === requestData.conversation.messages.length) {
                        setSelectedMsgIds([]);
                      } else {
                        setSelectedMsgIds(requestData.conversation.messages.map(m => m.id));
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {selectedMsgIds.length === requestData.conversation.messages.length ? 'Alles deselecteren' : 'Alles selecteren'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {requestData.conversation.messages.map(m => {
                    const isSelected = selectedMsgIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMsgSelection(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255,255,255,0.04)',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ marginTop: '0.2rem' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.72rem', color: m.role === 'user' ? '#818cf8' : '#38bdf8', fontWeight: 700 }}>
                            {m.role === 'user' ? 'Jij' : 'Locra AI'}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleRespond('reject')}
                style={{
                  padding: '0.75rem 1.4rem',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                Inzage Weigeren
              </button>

              <button
                type="button"
                disabled={submitting || (scope === 'selection' && selectedMsgIds.length === 0)}
                onClick={() => handleRespond('approve')}
                style={{
                  padding: '0.75rem 1.6rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: (submitting || (scope === 'selection' && selectedMsgIds.length === 0)) ? 'not-allowed' : 'pointer',
                  opacity: (submitting || (scope === 'selection' && selectedMsgIds.length === 0)) ? 0.6 : 1
                }}
              >
                {submitting ? 'Verwerken...' : '✓ Toestemming Bevestigen & Delen'}
              </button>
            </div>

            {/* Dutch AVG explanation */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, textAlign: 'center' }}>
              🔒 <strong>Privacy by Design:</strong> Jouw gesprekken binnen Locra zijn versleuteld. Docenten en beheerders kunnen jouw chatberichten niet zonder jouw toestemming inzien, conform het Privacyconvenant Onderwijs en de AVG.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

