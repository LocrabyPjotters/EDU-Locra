import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

interface ShareModalProps {
  conversationId: string;
  isShared: boolean;
  shareToken: string | null;
  onClose: () => void;
  onShareToggle: (isShared: boolean) => void;
}

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  email: string;
}

interface Participant {
  id: string;
  userId: string;
  role: string;
  user?: UserResult;
}

export default function ShareModal({ conversationId, isShared, shareToken, onClose, onShareToggle }: ShareModalProps) {
  const token = useAuthStore(s => s.token);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load participants
  const loadParticipants = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setParticipants(await res.json());
    }
  }, [conversationId, token]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  // Search users with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out users already in participants
          const participantIds = participants.map(p => p.userId);
          setSearchResults(data.filter((u: UserResult) => !participantIds.includes(u.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token, participants]);

  const addParticipant = async (userId: string) => {
    const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role: selectedRole })
    });
    if (res.ok) {
      setSearchQuery('');
      setSearchResults([]);
      await loadParticipants();
    }
  };

  const removeParticipant = async (userId: string) => {
    await fetch(`/api/chat/conversations/${conversationId}/participants/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    await loadParticipants();
  };

  const updateParticipantRole = async (userId: string, newRole: string) => {
    await fetch(`/api/chat/conversations/${conversationId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role: newRole })
    });
    await loadParticipants();
  };

  const copyShareLink = async () => {
    if (shareToken) {
      const url = `${window.location.origin}/chat/shared/${shareToken}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px', width: '480px', maxWidth: '95vw', maxHeight: '85vh',
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>🔗 Gesprek Delen</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px',
            transition: 'all 0.15s'
          }}>✕</button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Public Link Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              marginBottom: '0.75rem' 
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🌐 Openbare Link</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {isShared ? 'Actief' : 'Uit'}
                </span>
                <input 
                  type="checkbox" 
                  className="toggle" 
                  checked={isShared} 
                  onChange={() => onShareToggle(!isShared)} 
                />
              </label>
            </div>
            {isShared && shareToken && (
              <div style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                background: 'var(--bg-base)', borderRadius: '12px', padding: '0.5rem 0.75rem',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <input 
                  readOnly 
                  value={`${window.location.origin}/chat/shared/${shareToken}`}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '0.8rem', outline: 'none', fontFamily: 'monospace'
                  }}
                />
                <button onClick={copyShareLink} style={{
                  background: copied ? 'rgba(52,211,153,0.2)' : 'var(--bg-surface-hover)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                  padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
                  color: copied ? 'var(--success)' : 'var(--text-primary)', transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}>
                  {copied ? '✓ Gekopieerd' : '📋 Kopieer'}
                </button>
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Iedereen met de link kan dit gesprek bekijken (alleen lezen).
            </p>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0 1.25rem' }} />

          {/* User-specific sharing */}
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.75rem' }}>
              👥 Deel met Specifieke Gebruikers
            </span>

            {/* Search bar + role selector */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam, email of gebruikersnaam..."
                className="input-field"
                style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}
              />
              <select 
                value={selectedRole} 
                onChange={e => setSelectedRole(e.target.value as 'viewer' | 'editor')}
                className="input-field"
                style={{ width: '120px', padding: '0.6rem 0.5rem', fontSize: '0.8rem' }}
              >
                <option value="viewer">👁️ Kijker</option>
                <option value="editor">✏️ Bewerker</option>
              </select>
            </div>

            {/* Search results */}
            {searching && (
              <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Zoeken...
              </div>
            )}
            {searchResults.length > 0 && (
              <div style={{
                background: 'var(--bg-base)', borderRadius: '12px', marginBottom: '1rem',
                border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
              }}>
                {searchResults.map(user => (
                  <div key={user.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                    </div>
                    <button 
                      onClick={() => addParticipant(user.id)}
                      style={{
                        background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                        color: 'white', border: 'none', borderRadius: '8px',
                        padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
                        fontWeight: 600, transition: 'all 0.15s'
                      }}
                    >
                      + Toevoegen
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Current participants */}
            {participants.length > 0 && (
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                  Huidige deelnemers ({participants.length})
                </span>
                <div style={{
                  background: 'var(--bg-base)', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'
                }}>
                  {participants.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem',
                      borderBottom: '1px solid rgba(255,255,255,0.04)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {p.user?.displayName || p.userId}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          @{p.user?.username || '...'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select 
                          value={p.role}
                          onChange={e => updateParticipantRole(p.userId, e.target.value)}
                          style={{
                            background: 'var(--bg-surface-hover)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px', padding: '0.3rem 0.5rem', color: 'var(--text-primary)',
                            fontSize: '0.75rem', cursor: 'pointer'
                          }}
                        >
                          <option value="viewer">👁️ Kijker</option>
                          <option value="editor">✏️ Bewerker</option>
                        </select>
                        <button 
                          onClick={() => removeParticipant(p.userId)}
                          style={{
                            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                            borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer',
                            color: 'var(--danger)', fontSize: '0.8rem', transition: 'all 0.15s'
                          }}
                          title="Verwijderen"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {participants.length === 0 && searchResults.length === 0 && !searching && (
              <div style={{
                padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)',
                fontSize: '0.85rem', background: 'var(--bg-base)', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                Typ een naam om gebruikers te zoeken en toe te voegen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
