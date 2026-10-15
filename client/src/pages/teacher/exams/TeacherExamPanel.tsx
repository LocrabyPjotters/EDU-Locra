import { useState, useEffect } from 'react';
import {
  Plus, Search, Clock, Lock, ShieldAlert,
  Trash2, Edit3, Eye, Users, ExternalLink
} from 'lucide-react';
import ExamBuilderModal from './ExamBuilderModal';
import ExamReviewModal from './ExamReviewModal';

interface Props {
  token: string;
  classes: any[];
}

export default function TeacherExamPanel({ token, classes }: Props) {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [editingExam, setEditingExam] = useState<any | null>(null);
  const [reviewingExam, setReviewingExam] = useState<any | null>(null);

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      }
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [token]);

  // Toggle examen status (concept <-> actief <-> gesloten)
  const handleToggleStatus = async (exam: any, newStatus: string) => {
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        loadExams();
      }
    } catch (e) {
      alert('Fout bij wijzigen status');
    }
  };

  // Verwijderen
  const handleDeleteExam = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze toets en alle bijbehorende resultaten wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setExams(prev => prev.filter(e => e.id !== id));
      }
    } catch (e) {
      alert('Verwijderen mislukt');
    }
  };

  // Filteren
  const filteredExams = exams.filter(e => {
    const matchesClass = selectedClassId === 'all' || e.classId === selectedClassId;
    const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || (e.subject && e.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClass && matchesSearch;
  });

  const activeCount = exams.filter(e => e.status === 'active').length;
  const totalSubmissions = exams.reduce((sum, e) => sum + (e.submissionCount || 0), 0);
  const pendingGradingCount = exams.reduce((sum, e) => sum + ((e.completedCount || 0) - (e.reviewedCount || 0)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* BOVENBALK & STATISTIEKEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Actieve Toetsen</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{activeCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>van {exams.length} totaal</div>
        </div>

        <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Totaal Inzendingen</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>{totalSubmissions}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ingeleverde toetsen</div>
        </div>

        <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Te Nakijken</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{pendingGradingCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>open vragen wachtend</div>
        </div>
      </div>

      {/* FILTERBALK & ACTIEKNOP */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '640px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Zoek toets op titel of vak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.88rem' }}
            />
          </div>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.88rem' }}
          >
            <option value="all">Alle Klassen</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => { setEditingExam(null); setShowBuilderModal(true); }}
          style={{
            background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
            color: '#fff',
            border: 'none',
            padding: '11px 22px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(124,92,252,0.4)'
          }}
        >
          <Plus size={18} /> Nieuwe Toets Maken
        </button>
      </div>

      {/* TOETSEN LIJST */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Toetsen laden...</div>
      ) : filteredExams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(17,24,39,0.5)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Geen toetsen gevonden</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
            Er zijn nog geen online toetsen aangemaakt voor deze selectie.
          </p>
          <button
            onClick={() => { setEditingExam(null); setShowBuilderModal(true); }}
            style={{ background: '#7c5cfc', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
          >
            Maak de eerste toets aan met AI →
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredExams.map(exam => {
            const hasPassword = exam.hasPassword;
            const statusColor = exam.status === 'active' ? '#10b981' : exam.status === 'draft' ? '#f59e0b' : '#64748b';
            const statusLabel = exam.status === 'active' ? '🟢 Actief' : exam.status === 'draft' ? '🟡 Concept' : '⚪ Gesloten';

            let qCount = 0;
            try {
              qCount = JSON.parse(exam.questionsJson || '[]').length;
            } catch (e) {}

            return (
              <div
                key={exam.id}
                style={{
                  background: 'rgba(17,24,39,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* STATUS & VAK BADGES */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {exam.subject && (
                      <span style={{ background: 'rgba(124,92,252,0.18)', border: '1px solid rgba(124,92,252,0.3)', color: '#c4b5fd', fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
                        {exam.subject}
                      </span>
                    )}
                    <span style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${statusColor}`, color: statusColor, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', fontWeight: 700 }}>
                      {statusLabel}
                    </span>
                  </div>

                  {exam.class?.name ? (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={13} /> {exam.class.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alle klassen</span>
                  )}
                </div>

                {/* TITEL & BESCHRIJVING */}
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {exam.description}
                    </p>
                  )}
                </div>

                {/* BEVEILIGINGS & TOETS BADGES */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.74rem' }}>
                  {hasPassword && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (exam.accessCode) {
                          navigator.clipboard.writeText(exam.accessCode);
                          alert(`Toegangscode gekopieerd naar klembord: ${exam.accessCode}`);
                        }
                      }}
                      title="Klik om toegangscode te kopiëren"
                      style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Lock size={11} /> Code: <strong>{exam.accessCode || 'Actief'}</strong>
                    </span>
                  )}

                  {!exam.allowTabSwitch && (
                    <span title="Tabblad verlaten is verboden" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <ShieldAlert size={11} /> Anti-tabwissel
                    </span>
                  )}

                  {exam.forceFullscreen && (
                    <span style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      Fullscreen
                    </span>
                  )}

                  {exam.timeLimitMinutes && (
                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {exam.timeLimitMinutes} min
                    </span>
                  )}

                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                    {qCount} vragen • {exam.totalPoints} pt
                  </span>

                  <span style={{ background: exam.aiAssistanceMode === 'disabled' ? 'rgba(255,255,255,0.05)' : 'rgba(124,92,252,0.15)', color: exam.aiAssistanceMode === 'disabled' ? 'var(--text-muted)' : '#c4b5fd', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    🤖 {exam.aiAssistanceMode === 'disabled' ? 'AI Uit' : exam.aiAssistanceMode === 'hints' ? 'AI Hints' : 'AI Volledig'}
                  </span>
                </div>

                {/* INZENDINGEN VOORTGANG */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inzendingen:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                    {exam.completedCount || 0} ingeleverd ({exam.reviewedCount || 0} nagekeken)
                  </span>
                </div>

                {/* ACTIES */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => setReviewingExam(exam)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Eye size={14} /> Inzendingen ({exam.submissionCount || 0})
                  </button>

                  <button
                    onClick={() => window.open(`/toets/${exam.id}`, '_blank')}
                    title="Open de toets zoals leerlingen hem ervaren"
                    style={{
                      background: 'rgba(56,189,248,0.12)',
                      border: '1px solid rgba(56,189,248,0.3)',
                      color: '#38bdf8',
                      padding: '8px 11px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={13} /> Testen
                  </button>

                  <button
                    onClick={() => handleToggleStatus(exam, exam.status === 'active' ? 'closed' : 'active')}
                    title={exam.status === 'active' ? 'Toets sluiten' : 'Toets activeren'}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: exam.status === 'active' ? '#f59e0b' : '#34d399',
                      padding: '8px 11px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    {exam.status === 'active' ? 'Sluiten' : 'Activeren'}
                  </button>

                  <button
                    onClick={() => { setEditingExam(exam); setShowBuilderModal(true); }}
                    title="Bewerken"
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer' }}
                  >
                    <Edit3 size={15} />
                  </button>

                  <button
                    onClick={() => handleDeleteExam(exam.id)}
                    title="Verwijderen"
                    style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#f87171', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      {showBuilderModal && (
        <ExamBuilderModal
          token={token}
          classes={classes}
          editExam={editingExam}
          onClose={() => { setShowBuilderModal(false); setEditingExam(null); }}
          onSaved={loadExams}
        />
      )}

      {reviewingExam && (
        <ExamReviewModal
          token={token}
          exam={reviewingExam}
          onClose={() => setReviewingExam(null)}
          onUpdated={loadExams}
        />
      )}

    </div>
  );
}
