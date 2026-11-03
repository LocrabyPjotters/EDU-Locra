import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Shield,
  Users,
  Clock,
  Filter,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Lock,
  Unlock,
  Key
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Participant {
  id: string;
  userId: string;
  role: string;
}

interface UserInfo {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  role: string;
}

interface ConversationItem {
  id: string;
  title: string;
  orgId: string;
  userId: string;
  user?: UserInfo;
  isCollab: boolean;
  modelId?: string;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  accessRequests?: {
    id: string;
    status: string;
    scope: string;
    reason?: string;
    createdAt: string;
    expiresAt: string;
  }[];
  _count: {
    messages: number;
  };
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  createdAt: string;
  watermarkKey?: string;
  isDecrypted?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
}

interface DetailedConversation extends ConversationItem {
  messages: MessageItem[];
  smtpVerified?: boolean;
  accessStatus?: {
    isUnlocked: boolean;
    status: string;
    scope: string;
    reason: string | null;
    expiresAt: string | null;
    latestRequest?: any;
  };
}

export default function ChatsPanel() {
  const token = useAuthStore(state => state.token);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'collab'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Modal / Inspection state
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [detailedConv, setDetailedConv] = useState<DetailedConversation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Deletion confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Access & Confidant unlock state
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [requestingAccessId, setRequestingAccessId] = useState<string | null>(null);
  const [confidantUnlockId, setConfidantUnlockId] = useState<string | null>(null);
  const [confidantReason, setConfidantReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConversations = async (currentPage = page, currentSearch = search) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: currentSearch
      });
      const res = await fetch(`/api/admin/chats?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Kon gesprekken niet laden');
      }
      const data = await res.json();
      setConversations(data.data || []);
      setSmtpVerified(Boolean(data.smtpVerified));
      if (data.pagination) {
        setTotalPages(data.pagination.pages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Onbekende fout bij ophalen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations(page, search);
  }, [page, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchConversations(1, search);
  };

  // Open inspection modal
  const handleInspect = async (id: string) => {
    setInspectingId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/chats/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Kon details van gesprek niet ophalen');
      const data = await res.json();
      setDetailedConv(data);
    } catch (err: any) {
      alert(err.message);
      setInspectingId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Delete conversation
  const handleDelete = async (id: string) => {
    if (!token) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/chats/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Kon gesprek niet verwijderen');
      setSuccessMsg('Gesprek is succesvol verwijderd en gelogd in het audit logboek.');
      setTimeout(() => setSuccessMsg(null), 4000);
      setDeletingId(null);
      if (inspectingId === id) {
        setInspectingId(null);
        setDetailedConv(null);
      }
      fetchConversations(page, search);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestAccess = async (id: string) => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/chats/${id}/request-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanvraag mislukt');
      setActionMsg({ type: 'success', text: '✅ ' + (data.message || 'Inzageverzoek verzonden naar de leerling!') });
      handleInspect(id);
      fetchConversations(page, search);
    } catch (e: any) {
      setActionMsg({ type: 'error', text: '❌ ' + e.message });
    } finally {
      setActionLoading(false);
      setRequestingAccessId(null);
    }
  };

  const handleConfidantUnlock = async (id: string) => {
    if (!confidantReason.trim() || confidantReason.trim().length < 10) {
      alert('Vul een duidelijke zorgreden in van minimaal 10 tekens.');
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/chats/${id}/confidant-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: confidantReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ontgrendeling mislukt');
      setActionMsg({ type: 'success', text: '🛡️ ' + (data.message || 'Gesprek ontgrendeld. De leerling is per e-mail geïnformeerd.') });
      setConfidantReason('');
      setConfidantUnlockId(null);
      handleInspect(id);
      fetchConversations(page, search);
    } catch (e: any) {
      setActionMsg({ type: 'error', text: '❌ ' + e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Export conversations as JSON
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(conversations, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locra-gesprekken-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered in-memory list (combines server-side search with client-side type/role filter)
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (typeFilter === 'collab' && !conv.isCollab) return false;
      if (typeFilter === 'individual' && conv.isCollab) return false;
      if (roleFilter !== 'all') {
        const userRole = conv.user?.role || 'student';
        if (userRole !== roleFilter) return false;
      }
      return true;
    });
  }, [conversations, typeFilter, roleFilter]);

  // Summary counts
  const collabCount = useMemo(() => conversations.filter(c => c.isCollab).length, [conversations]);
  const totalMessagesInView = useMemo(() => conversations.reduce((acc, c) => acc + (c._count?.messages || 0), 0), [conversations]);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>💬</span> Gesprekken & Moderatie
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '750px' }}>
            Overzicht en toezicht op actieve en historische chats en CO-OP groepssessies binnen de schoolorganisatie. Conform AVG- en SIVON-richtlijnen.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={handleExportJSON}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1rem',
              borderRadius: '10px'
            }}
            title="Download selectie als JSON voor rapportage"
          >
            <Download size={15} />
            <span>Export (JSON)</span>
          </button>

          <button
            className="btn"
            onClick={() => fetchConversations(page, search)}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.1))',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1rem',
              borderRadius: '10px'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Vernieuwen</span>
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMsg && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem'
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Totaal Gesprekken</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Berichten in Selectie</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalMessagesInView}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CO-OP Groepskamers</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{collabCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Moderatie Status</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>Actief & Veilig</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 300px', maxWidth: '450px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Zoek op titel, bericht of gebruikersnaam..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.55rem 1rem', borderRadius: '10px', fontSize: '0.85rem', flexShrink: 0 }}
          >
            Zoeken
          </button>
        </form>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Type filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="all">Alle types</option>
              <option value="individual">Individuele chat</option>
              <option value="collab">CO-OP Samenwerking</option>
            </select>
          </div>

          {/* Role filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Rol:</span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="all">Alle rollen</option>
              <option value="student">Leerlingen</option>
              <option value="teacher">Docenten</option>
              <option value="admin">Beheerders</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONVERSATIONS TABLE */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table className="markdown-body table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>Gesprek & Onderwerp</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>Eigenaar</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>Type</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>Berichten</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>Laatst Actief</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {loading && filteredConversations.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.6 }} />
                  Gesprekken worden opgehaald...
                </td>
              </tr>
            ) : filteredConversations.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
                  Geen gesprekken gevonden die voldoen aan de zoekcriteria.
                </td>
              </tr>
            ) : (
              filteredConversations.map(conv => {
                const ownerName = conv.user?.displayName || conv.user?.username || 'Onbekende gebruiker';
                const ownerRole = conv.user?.role || 'student';
                const dateStr = new Date(conv.updatedAt || conv.createdAt).toLocaleString('nl-NL', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                return (
                  <tr key={conv.id} style={{ transition: 'background 0.15s ease' }}>
                    {/* Titel */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: conv.isCollab ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: conv.isCollab ? '#34d399' : '#818cf8',
                          flexShrink: 0
                        }}>
                          {conv.isCollab ? <Users size={16} /> : <MessageSquare size={16} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                              {conv.title || 'Gesprek zonder titel'}
                            </span>
                            {(() => {
                              const req = conv.accessRequests?.[0];
                              if (req?.status === 'approved') {
                                return (
                                  <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.65rem' }}>
                                    ✅ Vrijgegeven
                                  </span>
                                );
                              }
                              if (req?.status === 'confidant_unlocked') {
                                return (
                                  <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', fontSize: '0.65rem' }}>
                                    🛡️ VP Inzage
                                  </span>
                                );
                              }
                              if (req?.status === 'pending') {
                                return (
                                  <span className="badge" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '0.65rem' }}>
                                    ⏳ In Aanvraag
                                  </span>
                                );
                              }
                              return (
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                  🔒 Versleuteld
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ID: {conv.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Eigenaar */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.78rem'
                        }}>
                          {ownerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {ownerName}
                          </div>
                          <span className="badge" style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            background: ownerRole === 'admin' || ownerRole === 'superadmin' ? 'rgba(239, 68, 68, 0.15)' : ownerRole === 'teacher' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: ownerRole === 'admin' || ownerRole === 'superadmin' ? '#f87171' : ownerRole === 'teacher' ? '#60a5fa' : '#34d399',
                            border: '1px solid currentColor'
                          }}>
                            {ownerRole}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                      {conv.isCollab ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          CO-OP ({conv.participants?.length || 1})
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          Individueel
                        </span>
                      )}
                    </td>

                    {/* Berichten */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', fontWeight: 600 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-primary)'
                      }}>
                        {conv._count?.messages || 0}
                      </span>
                    </td>

                    {/* Laatst actief */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} color="var(--text-muted)" />
                        <span>{dateStr}</span>
                      </div>
                    </td>

                    {/* Acties */}
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleInspect(conv.id)}
                          className="btn"
                          title="Volledig gesprek inzien"
                          style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Eye size={14} />
                          <span>Inzien</span>
                        </button>

                        <button
                          onClick={() => setDeletingId(conv.id)}
                          className="btn"
                          title="Gesprek verwijderen (moderatie)"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Pagina <strong>{page}</strong> van <strong>{totalPages}</strong> (totaal {totalCount} gesprekken)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Vorige
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Volgende
            </button>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL / DRAWER */}
      {inspectingId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-base, #0f172a)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>💬</span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {detailedConv?.title || 'Gespreksinspectie'}
                  </h3>
                  {detailedConv?.isCollab && (
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem' }}>
                      CO-OP Kamer
                    </span>
                  )}
                </div>
                {detailedConv?.user && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Gestart door: <strong>{detailedConv.user.displayName || detailedConv.user.username}</strong> ({detailedConv.user.role}) • ID: {detailedConv.id}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    if (detailedConv) {
                      const transcript = detailedConv.messages.map(m => `[${new Date(m.createdAt).toLocaleString('nl-NL')}] ${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
                      const blob = new Blob([transcript], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `transcript-${detailedConv.id}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="btn"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Download size={13} />
                  <span>Transcript (.txt)</span>
                </button>

                <button
                  onClick={() => {
                    setInspectingId(null);
                    setDetailedConv(null);
                    setActionMsg(null);
                    setConfidantUnlockId(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    display: 'flex'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Action notification message */}
            {actionMsg && (
              <div style={{
                margin: '1rem 1.5rem 0',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                background: actionMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: actionMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: actionMsg.type === 'success' ? '#4ade80' : '#f87171',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{actionMsg.text}</span>
                <button
                  onClick={() => setActionMsg(null)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Moderation / Privacy Status Card */}
            {detailedConv && (
              <div style={{
                margin: '1rem 1.5rem 0',
                padding: '1.1rem 1.25rem',
                borderRadius: '14px',
                background: detailedConv.accessStatus?.isUnlocked
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05))'
                  : 'linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(99, 102, 241, 0.05))',
                border: detailedConv.accessStatus?.isUnlocked
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(234, 179, 8, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {detailedConv.accessStatus?.isUnlocked ? (
                      <Unlock size={20} color="#4ade80" />
                    ) : (
                      <Lock size={20} color="#fbbf24" />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: detailedConv.accessStatus?.isUnlocked ? '#4ade80' : '#fbbf24' }}>
                        {detailedConv.accessStatus?.isUnlocked
                          ? (detailedConv.accessStatus.status === 'confidant_unlocked'
                              ? '🛡️ Ontgrendeld door Vertrouwenspersoon'
                              : '✅ Vrijgegeven door Leerling')
                          : '🔒 Versleuteld Gesprek (Privacy by Design)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {detailedConv.accessStatus?.isUnlocked
                          ? (detailedConv.accessStatus.status === 'confidant_unlocked'
                              ? `Zorgreden: "${detailedConv.accessStatus.reason}" • Leerling is per mail geïnformeerd.`
                              : `Vrijgegeven omvang: ${detailedConv.accessStatus.scope === 'full' ? 'Volledig gesprek' : detailedConv.accessStatus.scope === 'selection' ? 'Selectie van berichten' : 'Alleen titel en metadata'}.`)
                          : (detailedConv.accessStatus?.status === 'pending'
                              ? '⏳ Er is al een inzageverzoek verzonden naar de leerling. Wachten op reactie...'
                              : 'Inhoud is end-to-end beveiligd. Toegang vereist toestemming van de leerling of een geregistreerde vertrouwenspersoon.')}
                      </div>
                    </div>
                  </div>

                  {!detailedConv.accessStatus?.isUnlocked && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleRequestAccess(detailedConv.id)}
                        disabled={actionLoading || !detailedConv.smtpVerified || detailedConv.accessStatus?.status === 'pending'}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          background: detailedConv.accessStatus?.status === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: (actionLoading || !detailedConv.smtpVerified || detailedConv.accessStatus?.status === 'pending') ? 'not-allowed' : 'pointer',
                          opacity: (actionLoading || !detailedConv.smtpVerified || detailedConv.accessStatus?.status === 'pending') ? 0.6 : 1
                        }}
                      >
                        {detailedConv.accessStatus?.status === 'pending' ? '⏳ In Aanvraag' : '📩 Inzage Aanvragen'}
                      </button>

                      <button
                        onClick={() => setConfidantUnlockId(detailedConv.id)}
                        disabled={actionLoading || !detailedConv.smtpVerified}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.35)',
                          color: '#fbbf24',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: (actionLoading || !detailedConv.smtpVerified) ? 'not-allowed' : 'pointer',
                          opacity: (actionLoading || !detailedConv.smtpVerified) ? 0.6 : 1
                        }}
                      >
                        🛡️ Vertrouwenspersoon Inzage
                      </button>
                    </div>
                  )}
                </div>

                {!detailedConv.smtpVerified && !detailedConv.accessStatus?.isUnlocked && (
                  <div style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '0.78rem',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Mailing server (SMTP) niet geverifieerd:</strong> Inzage is geblokkeerd totdat de mailserver met een 6-cijferige code is geverifieerd in Instellingen &gt; E-mail.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confidant Unlock Dialog */}
            {confidantUnlockId && (
              <div style={{
                margin: '1rem 1.5rem 0',
                padding: '1.25rem',
                borderRadius: '14px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fbbf24' }}>
                  🛡️ Nood-inzage door Vertrouwenspersoon
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Geef de zorg- of veiligheidsreden op voor deze ontgrendeling. De leerling ontvangt direct een e-mailnotificatie met jouw naam en deze reden conform de AVG- en schoolveiligheidsprocedures.
                </div>
                <textarea
                  rows={3}
                  placeholder="Bijvoorbeeld: Zorgsignaal ontvangen over leerlingveiligheid / welzijn..."
                  value={confidantReason}
                  onChange={e => setConfidantReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfidantUnlockId(null);
                      setConfidantReason('');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading || confidantReason.trim().length < 10}
                    onClick={() => handleConfidantUnlock(confidantUnlockId)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                      border: 'none',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: (actionLoading || confidantReason.trim().length < 10) ? 'not-allowed' : 'pointer',
                      opacity: (actionLoading || confidantReason.trim().length < 10) ? 0.6 : 1
                    }}
                  >
                    {actionLoading ? 'Ontgrendelen...' : 'Ontgrendelen & Notificatie Versturen'}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body: Messages stream */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                  Berichten laden...
                </div>
              ) : !detailedConv || detailedConv.messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Geen berichten in dit gesprek aangetroffen.
                </div>
              ) : (
                detailedConv.messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isAssistant = msg.role === 'assistant';
                  const time = new Date(msg.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      {/* Sender Meta */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        marginBottom: '0.3rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {isUser ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#818cf8' }}>
                              {msg.user?.displayName || msg.user?.username || detailedConv.user?.displayName || 'Gebruiker'}
                            </span>
                            <span>•</span>
                            <span>{time}</span>
                            {msg.isDecrypted && (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.65rem', padding: '0 4px' }}>
                                🔓 Ontsleuteld
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{
                              fontWeight: 700,
                              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent'
                            }}>
                              Locra {msg.modelUsed ? `(${msg.modelUsed})` : ''}
                            </span>
                            <span>•</span>
                            <span>{time}</span>
                            {msg.isDecrypted && (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.65rem', padding: '0 4px' }}>
                                🔓 Ontsleuteld
                              </span>
                            )}
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.65rem', padding: '0 4px' }}>
                              💧 Watermerk
                            </span>
                          </>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div style={{
                        maxWidth: '85%',
                        padding: '1rem 1.25rem',
                        borderRadius: '14px',
                        background: msg.content === '[Versleuteld Bericht]' ? 'rgba(0,0,0,0.3)' : isUser ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        border: msg.content === '[Versleuteld Bericht]' ? '1px dashed rgba(255,255,255,0.15)' : isUser ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        lineHeight: 1.6
                      }}>
                        {msg.content === '[Versleuteld Bericht]' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            <Lock size={15} color="#fbbf24" />
                            <span>[Versleuteld Bericht — Niet vrijgegeven door leerling]</span>
                          </div>
                        ) : isAssistant ? (
                          <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Totaal {detailedConv?.messages?.length || 0} berichten vastgelegd
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    if (detailedConv) setDeletingId(detailedConv.id);
                  }}
                  className="btn"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Gesprek Verwijderen</span>
                </button>

                <button
                  onClick={() => {
                    setInspectingId(null);
                    setDetailedConv(null);
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    fontSize: '0.82rem'
                  }}
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-base, #0f172a)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
              <AlertCircle size={28} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Gesprek Verwijderen?</h3>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Weet je zeker dat je dit gesprek definitief wilt verwijderen? Alle bijbehorende berichten en bijdragen worden gewist. Deze actie wordt gelogd in het Audit Logboek.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-primary)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}
              >
                Annuleren
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={isDeleting}
                className="btn"
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {isDeleting ? 'Verwijderen...' : 'Definitief Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

