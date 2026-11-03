import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Eye,
  Shield,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function VPChatsPanel() {
  const token = useAuthStore(state => state.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialInspectId = searchParams.get('inspect');

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [search, setSearch] = useState('');

  // Modal inspection
  const [inspectingId, setInspectingId] = useState<string | null>(initialInspectId);
  const [detailedConv, setDetailedConv] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confidant unlock dialog
  const [confidantReason, setConfidantReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchChats = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/vp/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data.data || []);
      setSmtpVerified(Boolean(data.smtpVerified));
    } catch (e) {
      console.error('Failed to load VP chats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [token]);

  const handleInspect = async (id: string) => {
    setInspectingId(id);
    setSearchParams({ inspect: id });
    setLoadingDetail(true);
    setUnlockMsg(null);
    try {
      const res = await fetch(`/api/vp/chats/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDetailedConv(data);
    } catch (e: any) {
      alert(e.message || 'Kon gesprek niet openen');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (initialInspectId) {
      handleInspect(initialInspectId);
    }
  }, [initialInspectId]);

  const handleConfidantUnlock = async (id: string) => {
    if (!confidantReason.trim() || confidantReason.trim().length < 10) {
      alert('Vul een duidelijke zorgreden van minimaal 10 tekens in.');
      return;
    }
    setUnlocking(true);
    setUnlockMsg(null);
    try {
      const res = await fetch(`/api/vp/chats/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: confidantReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ontgrendeling mislukt');
      setUnlockMsg({ type: 'success', text: '🛡️ ' + (data.message || 'Gesprek ontgrendeld. Leerling is per mail geïnformeerd.') });
      setConfidantReason('');
      handleInspect(id);
      fetchChats();
    } catch (e: any) {
      setUnlockMsg({ type: 'error', text: '❌ ' + e.message });
    } finally {
      setUnlocking(false);
    }
  };

  const filtered = conversations.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
            Vertrouwelijke Gespreksmoderatie
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Inzage in gesprekken van leerlingen conform de Wet Veiligheid op School en de AVG.
          </p>
        </div>

        <button
          onClick={fetchChats}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '9px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Vernieuwen</span>
        </button>
      </div>

      {/* SMTP Notice */}
      {!smtpVerified && (
        <div style={{
          padding: '0.9rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.82rem',
          color: '#f87171'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Mailing server niet geverifieerd:</strong> Nood-ontgrendeling is tijdelijk geblokkeerd totdat de IT-beheerder de SMTP-mailserver in Instellingen met een 6-cijferige testcode heeft geverifieerd.
          </span>
        </div>
      )}

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '420px', width: '100%' }}>
        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Zoek op titel of leerling..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.65rem 1rem 0.65rem 2.4rem',
            borderRadius: '10px',
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            fontSize: '0.85rem',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Chats Table */}
      <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>Gesprek</th>
              <th style={{ padding: '0.85rem 1rem' }}>Leerling</th>
              <th style={{ padding: '0.85rem 1rem' }}>Berichten</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Gesprekken laden...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  Geen gesprekken gevonden.
                </td>
              </tr>
            ) : (
              filtered.map(conv => {
                const req = conv.accessRequests?.[0];
                const isApproved = req?.status === 'approved';
                const isConfidant = req?.status === 'confidant_unlocked';
                const isPending = req?.status === 'pending';
                const studentName = conv.user?.displayName || conv.user?.username || 'Leerling';

                return (
                  <tr key={conv.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{conv.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>ID: {conv.id}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 500, color: '#cbd5e1' }}>{studentName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{conv.user?.email || 'Geen e-mail'}</div>
                    </td>
                    <td style={{ padding: '1rem', color: '#cbd5e1' }}>
                      {conv._count?.messages || 0}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {isApproved ? (
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 700 }}>
                          ✅ Vrijgegeven
                        </span>
                      ) : isConfidant ? (
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(234,179,8,0.15)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700 }}>
                          🛡️ VP Inzage
                        </span>
                      ) : isPending ? (
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700 }}>
                          ⏳ In Aanvraag
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>
                          🔒 Versleuteld
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleInspect(conv.id)}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.35)',
                          color: '#fbbf24',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Inzien
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Modal */}
      {inspectingId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                  {detailedConv?.title || 'Gesprek Inzien'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Leerling: <strong>{detailedConv?.user?.displayName || detailedConv?.user?.username}</strong>
                </div>
              </div>
              <button
                onClick={() => {
                  setInspectingId(null);
                  setDetailedConv(null);
                  setSearchParams({});
                }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Notification alert */}
            {unlockMsg && (
              <div style={{
                margin: '1rem 1.5rem 0',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: unlockMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: unlockMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: unlockMsg.type === 'success' ? '#4ade80' : '#f87171',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                {unlockMsg.text}
              </div>
            )}

            {/* Status & Confidant Unlock Banner */}
            {detailedConv && (
              <div style={{
                margin: '1rem 1.5rem 0',
                padding: '1rem',
                borderRadius: '12px',
                background: detailedConv.accessStatus?.isUnlocked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                border: detailedConv.accessStatus?.isUnlocked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                {detailedConv.accessStatus?.isUnlocked ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4ade80' }}>
                      🔓 Inhoud Ontgrendeld
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                      {detailedConv.accessStatus.status === 'confidant_unlocked'
                        ? `Ontgrendeld wegens zorgreden: "${detailedConv.accessStatus.reason}". De leerling is per e-mail geïnformeerd.`
                        : `Vrijgegeven met toestemming van de leerling.`}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#fbbf24' }}>
                      <Lock size={16} />
                      <span>Gesprek is momenteel versleuteld</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0.4rem 0 0.75rem' }}>
                      Als beëdigd vertrouwenspersoon kun je dit gesprek direct ontgrendelen indien er sprake is van een zorg- of veiligheidssituatie. De leerling ontvangt direct een officiële e-mailnotificatie met jouw naam en opgegeven reden.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        rows={2}
                        placeholder="Opgegeven zorgreden (minimaal 10 tekens)..."
                        value={confidantReason}
                        onChange={e => setConfidantReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          fontSize: '0.82rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          disabled={unlocking || !smtpVerified || confidantReason.trim().length < 10}
                          onClick={() => handleConfidantUnlock(detailedConv.id)}
                          style={{
                            padding: '0.5rem 1.15rem',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                            border: 'none',
                            color: '#000',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: (unlocking || !smtpVerified || confidantReason.trim().length < 10) ? 'not-allowed' : 'pointer',
                            opacity: (unlocking || !smtpVerified || confidantReason.trim().length < 10) ? 0.6 : 1
                          }}
                        >
                          {unlocking ? 'Ontgrendelen...' : '🛡️ Ontgrendelen & Leerling Informeren'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message Stream */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Berichten laden...
                </div>
              ) : !detailedConv || detailedConv.messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Geen berichten gevonden.
                </div>
              ) : (
                detailedConv.messages.map((m: any, idx: number) => {
                  const isUser = m.role === 'user';
                  const time = new Date(m.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={m.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.25rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: isUser ? '#818cf8' : '#38bdf8' }}>
                          {isUser ? (detailedConv.user?.displayName || 'Leerling') : 'Locra'}
                        </span>
                        <span>•</span>
                        <span>{time}</span>
                        {m.isDecrypted && (
                          <span style={{ padding: '1px 5px', borderRadius: '4px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.65rem' }}>
                            🔓 Ontsleuteld
                          </span>
                        )}
                      </div>

                      <div style={{
                        maxWidth: '85%',
                        padding: '0.85rem 1.15rem',
                        borderRadius: '12px',
                        background: m.content === '[Versleuteld Bericht]' ? 'rgba(0,0,0,0.3)' : isUser ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        border: m.content === '[Versleuteld Bericht]' ? '1px dashed rgba(255,255,255,0.15)' : isUser ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.88rem',
                        lineHeight: 1.5
                      }}>
                        {m.content === '[Versleuteld Bericht]' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            <Lock size={15} color="#fbbf24" />
                            <span>[Versleuteld Bericht]</span>
                          </div>
                        ) : m.role === 'assistant' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

