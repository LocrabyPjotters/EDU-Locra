import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  User,
  FileText,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface CareFlag {
  id: string;
  orgId: string;
  userId: string;
  conversationId?: string;
  category: string;
  severity: string;
  snippet?: string;
  status: 'open' | 'in_review' | 'resolved';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    email?: string;
  };
}

interface StatsData {
  openFlags: number;
  inReviewFlags: number;
  resolvedFlags: number;
  criticalFlags: number;
  totalRequests: number;
  smtpVerified: boolean;
}

export default function VPDashboard() {
  const token = useAuthStore(state => state.token);
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [flags, setFlags] = useState<CareFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'resolved'>('open');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsRes, flagsRes] = await Promise.all([
        fetch('/api/vp/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/vp/flags?status=${statusFilter}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const statsData = await statsRes.json();
      const flagsData = await flagsRes.json();
      setStats(statsData);
      setFlags(flagsData.data || []);
    } catch (e) {
      console.error('Failed to load VP data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: 'open' | 'in_review' | 'resolved') => {
    try {
      const res = await fetch(`/api/vp/flags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
        if (stats) {
          loadData();
        }
      }
    } catch (e) {
      alert('Fout bij bijwerken status');
    }
  };

  const handleSaveNotes = async (id: string) => {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/vp/flags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: tempNotes })
      });
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === id ? { ...f, notes: tempNotes } : f));
        setEditingNotesId(null);
      }
    } catch (e) {
      alert('Fout bij opslaan notitie');
    } finally {
      setSavingNote(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'suicide_risk':
        return { label: '🚨 Suïciderisico', bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
      case 'self_harm':
        return { label: '⚠️ Zelfbeschadiging', bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.4)' };
      case 'acute_distress':
        return { label: '🛡️ Acute Onveiligheid', bg: 'rgba(234, 179, 8, 0.2)', text: '#fbbf24', border: 'rgba(234, 179, 8, 0.4)' };
      default:
        return { label: 'Zorgsignaal', bg: 'rgba(99, 102, 241, 0.2)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.4)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
            Vertrouwenspersoon &amp; Zorgsignalering
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Discreet overzicht van automatische zorgsignalen en vertrouwelijke moderatieverzoeken.
          </p>
        </div>

        <button
          onClick={loadData}
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

      {/* SMTP Warning if not verified */}
      {stats && !stats.smtpVerified && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          color: '#f87171'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Mailing server (SMTP) is niet geverifieerd:</strong> Conform het schoolprotocol kunnen chats alleen worden ontgrendeld als de mailing server geverifieerd is met een 6-cijferige testcode, zodat de leerling direct op de hoogte wordt gesteld.
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171' }}>Open Zorgsignalen</span>
            <AlertTriangle size={18} color="#f87171" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '0.5rem' }}>
            {stats?.openFlags ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Waarvan {stats?.criticalFlags ?? 0} acuut risico
          </div>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>In Behandeling</span>
            <Clock size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '0.5rem' }}>
            {stats?.inReviewFlags ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Lopende opvolgingen
          </div>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4ade80' }}>Afgerond</span>
            <CheckCircle size={18} color="#4ade80" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '0.5rem' }}>
            {stats?.resolvedFlags ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Veilig opgeloste dossiers
          </div>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24' }}>Actieve Inzagen</span>
            <Shield size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '0.5rem' }}>
            {stats?.totalRequests ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Goedgekeurd / VP ontgrendeld
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
        {[
          { id: 'open', label: 'Openstaand' },
          { id: 'in_review', label: 'In Behandeling' },
          { id: 'resolved', label: 'Afgerond' },
          { id: 'all', label: 'Alle Signalen' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id as any)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: statusFilter === tab.id ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.06)',
              background: statusFilter === tab.id ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: statusFilter === tab.id ? '#fbbf24' : '#94a3b8',
              fontWeight: statusFilter === tab.id ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Care Flags List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            Signalen laden...
          </div>
        ) : flags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#1e293b', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <Shield size={36} color="#4ade80" style={{ margin: '0 auto 0.75rem', opacity: 0.8 }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Geen openstaande zorgsignalen</div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Er zijn momenteel geen meldingen in deze categorie.
            </p>
          </div>
        ) : (
          flags.map(flag => {
            const badge = getCategoryBadge(flag.category);
            const studentName = flag.user?.displayName || flag.user?.username || 'Onbekende leerling';

            return (
              <div
                key={flag.id}
                style={{
                  background: '#1e293b',
                  borderRadius: '16px',
                  border: `1px solid ${badge.border}`,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: badge.bg, border: `1px solid ${badge.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: badge.text }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                          {studentName}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text, fontSize: '0.72rem', fontWeight: 700 }}>
                          {badge.label}
                        </span>
                        {flag.severity === 'critical' && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '0.7rem', fontWeight: 800 }}>
                            ACUUT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Gedetecteerd op {new Date(flag.createdAt).toLocaleString('nl-NL')} • ID: #{flag.id}
                      </div>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={flag.status}
                      onChange={e => handleUpdateStatus(flag.id, e.target.value as any)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: flag.status === 'open' ? '#f87171' : flag.status === 'in_review' ? '#38bdf8' : '#4ade80',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="open">🔴 Openstaand</option>
                      <option value="in_review">🟡 In Behandeling</option>
                      <option value="resolved">🟢 Afgerond</option>
                    </select>

                    {flag.conversationId && (
                      <button
                        onClick={() => navigate(`/vp/chats?inspect=${flag.conversationId}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
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
                        <MessageSquare size={14} />
                        <span>Gesprek Inzien</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Snippet preview */}
                {flag.snippet && (
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    fontStyle: 'italic',
                    lineHeight: 1.5
                  }}>
                    "{flag.snippet}"
                  </div>
                )}

                {/* Confidential Notes */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem' }}>
                  {editingNotesId === flag.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        rows={2}
                        placeholder="Vertrouwelijke notitie van de vertrouwenspersoon..."
                        value={tempNotes}
                        onChange={e => setTempNotes(e.target.value)}
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Annuleren
                        </button>
                        <button
                          type="button"
                          disabled={savingNote}
                          onClick={() => handleSaveNotes(flag.id)}
                          style={{ padding: '0.35rem 0.85rem', borderRadius: '6px', background: '#eab308', border: 'none', color: '#000', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          {savingNote ? 'Opslaan...' : 'Notitie Opslaan'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        {flag.notes ? (
                          <span><strong>Notitie:</strong> {flag.notes}</span>
                        ) : (
                          <span style={{ fontStyle: 'italic' }}>Geen interne notitie toegevoegd.</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingNotesId(flag.id);
                          setTempNotes(flag.notes || '');
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {flag.notes ? 'Bewerken' : '+ Notitie toevoegen'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

