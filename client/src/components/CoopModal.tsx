import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface CoopModalProps {
  conversationId: string;
  onClose: () => void;
}

export default function CoopModal({ conversationId, onClose }: CoopModalProps) {
  const token = useAuthStore(s => s.token);
  const [participants, setParticipants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchParticipants();
  }, [conversationId]);

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError('Voer minimaal 2 tekens in');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: any[] = await res.json();
        // Filter out existing participants
        const filtered = data.filter((u: any) => 
          !participants.some(p => p.userId === u.id)
        );
        setSearchResults(filtered);
        if (filtered.length === 0) setError('Geen gebruikers gevonden');
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Fout bij zoeken');
      }
    } catch (e) {
      setError('Netwerkfout');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, role: 'editor' })
      });
      
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        fetchParticipants();
      } else {
        const data = await res.json();
        setError(data.error || 'Fout bij toevoegen');
      }
    } catch (e) {
      setError('Netwerkfout');
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/participants/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchParticipants();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px' }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>👥 Co-op Groepschat</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Voeg groepsleden toe om samen in dit gesprek te werken. Iedereen kan berichten sturen en de AI aanroepen door @Locra of de naam van de school AI te typen.
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Huidige leden</h3>
          {participants.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alleen jij bevindt je in deze chat.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {participants.map(p => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.9rem' }}>{p.user?.displayName || 'Gebruiker'}</span>
                  {p.role !== 'owner' && (
                    <button 
                      onClick={() => handleRemoveParticipant(p.userId)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Verwijderen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam of email..."
            className="input"
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Zoeken
          </button>
        </form>

        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

        {searchResults.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.5rem', maxHeight: '150px', overflowY: 'auto', marginBottom: '1rem' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {searchResults.map(u => (
                <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem' }}>{u.displayName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</span>
                  </div>
                  <button 
                    onClick={() => handleAddParticipant(u.id)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                  >
                    Toevoegen
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={onClose} className="btn" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px' }}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
