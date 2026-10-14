import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import UserSettingsModal from '../chat/UserSettingsModal';
import { useAcademyName } from '../../store/orgStore';
import SlimCheckStudent from './SlimCheckStudent';

function NavItem({ icon, label, active, count, onClick }: { icon: string; label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: active ? 'rgba(124, 92, 252, 0.18)' : 'transparent', border: active ? '1px solid rgba(124, 92, 252, 0.35)' : '1px solid transparent', color: active ? '#c4b5fd' : 'var(--text-secondary)', fontWeight: active ? 600 : 400, cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.875rem', transition: 'all 0.15s ease' }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ background: active ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.08)', color: active ? '#e9d5ff' : 'var(--text-muted)', padding: '1px 7px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{count}</span>}
    </button>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 14, right: 16, fontSize: '1.8rem', opacity: 0.12 }}>{icon}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '2.2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function StudentLayout() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const academyName = useAcademyName();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [studentExams, setStudentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'materials' | 'slimcheck' | 'exams'>('todo');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [studentClasses, setStudentClasses] = useState<any[]>([]);
  const [classMaterials, setClassMaterials] = useState<Record<string, any[]>>({});
  const [expandedMaterialClass, setExpandedMaterialClass] = useState<string | null>(null);

  const loadStudentAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assignments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignments(await res.json());
    } catch (e) {
      addToast('Fout bij ophalen van opdrachten', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    loadStudentAssignments();
    loadStudentClasses();
    loadStudentExams();
  }, [token]);

  const loadStudentExams = async () => {
    try {
      const res = await fetch('/api/exams', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStudentExams(await res.json());
    } catch (e) { /* silent */ }
  };

  const loadStudentClasses = async () => {
    try {
      const res = await fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStudentClasses(await res.json());
    } catch (e) { /* silent */ }
  };

  const loadMaterialsForClass = async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}/materials`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setClassMaterials(prev => ({ ...prev, [classId]: data }));
      }
    } catch (e) { addToast('Fout bij ophalen lesmateriaal', 'error'); }
  };

  const handleStartAssignment = async (assignment: any) => {
    const sub = assignment.submissions?.[0];
    if (sub && (sub.status === 'submitted' || sub.status === 'reviewed')) {
      navigate(`/chat?conversationId=${sub.conversationId}&assignmentId=${assignment.id}&readonly=true`);
      return;
    }
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        addToast(data.resuming ? 'Opdracht hervat' : 'Opdracht gestart!', 'success');
        navigate(`/chat?conversationId=${data.conversationId}&assignmentId=${assignment.id}`);
      } else {
        const err = await res.json();
        addToast(err.error || 'Kon opdracht niet starten', 'error');
      }
    } catch (e) { addToast('Netwerkfout bij starten opdracht', 'error'); }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    if (!confirm('Weet je zeker dat je deze opdracht wilt inleveren voor beoordeling?')) return;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
      if (res.ok) { addToast('Opdracht succesvol ingeleverd!', 'success'); loadStudentAssignments(); }
      else { const err = await res.json(); addToast(err.error || 'Inleveren mislukt', 'error'); }
    } catch (e) { addToast('Netwerkfout bij inleveren', 'error'); }
  };

  const todoCount = assignments.filter(a => { const s = a.submissions?.[0]; return s?.status !== 'submitted' && s?.status !== 'reviewed'; }).length;
  const doneCount = assignments.length - todoCount;
  const progressPct = assignments.length > 0 ? Math.round((doneCount / assignments.length) * 100) : 0;

  const filteredAssignments = assignments.filter(a => {
    const sub = a.submissions?.[0];
    const isDone = sub?.status === 'submitted' || sub?.status === 'reviewed';
    if (filter === 'todo') return !isDone;
    if (filter === 'done') return isDone;
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{ width: sidebarCollapsed ? '64px' : '230px', background: 'rgba(10,14,26,0.97)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', padding: sidebarCollapsed ? '16px 8px' : '16px 12px', gap: '4px', transition: 'width 0.25s ease', overflow: 'hidden', flexShrink: 0, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #c4b5fd, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Locra</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>LEERLINGPORTAAL</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {[
            { id: 'todo', icon: '⏳', label: 'Nog te doen', count: todoCount },
            { id: 'done', icon: '✅', label: 'Afgerond', count: doneCount },
            { id: 'all', icon: '📋', label: 'Alle Opdrachten', count: assignments.length },
            { id: 'exams', icon: '📝', label: 'Toetsen', count: studentExams.filter(e => !e.mySubmission || e.mySubmission.status === 'in_progress').length },
            { id: 'materials', icon: '📎', label: 'Lesmateriaal' },
            { id: 'slimcheck', icon: '🧠', label: 'SlimCheck' }
          ].map(item => (
            sidebarCollapsed ? (
              <button key={item.id} title={item.label} onClick={() => setFilter(item.id as any)} style={{ background: filter === item.id ? 'rgba(124,92,252,0.18)' : 'transparent', border: filter === item.id ? '1px solid rgba(124,92,252,0.35)' : '1px solid transparent', borderRadius: '10px', color: filter === item.id ? '#c4b5fd' : 'var(--text-secondary)', width: '100%', height: '40px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.icon}
                {(item.count || 0) > 0 && <span style={{ position: 'absolute', top: 3, right: 3, background: '#7c5cfc', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '0.58rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{item.count}</span>}
              </button>
            ) : <NavItem key={item.id} icon={item.icon} label={item.label} active={filter === item.id} count={item.count} onClick={() => setFilter(item.id as any)} />
          ))}

          <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {sidebarCollapsed ? (
              <button title="Vrije Chat" onClick={() => navigate('/chat')} style={{ background: 'transparent', border: '1px solid transparent', borderRadius: '10px', color: 'var(--text-secondary)', width: '100%', height: '40px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬</button>
            ) : (
              <NavItem icon="💬" label="Vrije Chat" active={false} onClick={() => navigate('/chat')} />
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{user?.displayName?.[0]?.toUpperCase() || 'L'}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || 'Leerling'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
              </div>
            </div>
          )}
          {sidebarCollapsed ? (
            <>
              <button title="Instellingen" onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', height: '36px', borderRadius: '8px' }}>⚙️</button>
              <button title="Uitloggen" onClick={() => { if (confirm('Uitloggen?')) { logout(); navigate('/login'); }}} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', height: '36px', borderRadius: '8px' }}>🚪</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', fontSize: '0.82rem' }}>⚙️ Instellingen</button>
              <button onClick={() => { if (confirm('Weet je zeker dat je wilt uitloggen?')) { logout(); navigate('/login'); }}} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', fontSize: '0.82rem' }}>🚪 Uitloggen</button>
            </>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '16px 28px', background: 'rgba(10,14,26,0.6)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              {filter === 'materials' ? '📎 Lesmateriaal' : filter === 'slimcheck' ? '🧠 Formatieve Toetsen (SlimCheck)' : '🎒 Mijn Opdrachten'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filter === 'materials' ? 'Bekijk en download materiaal dat je docenten hebben klaargezet.' : filter === 'slimcheck' ? 'Inzage in nagekeken toetsen, beoordelingen en gerichte feedback.' : 'Hier vind je al jouw opdrachten, klaargezet door je docenten.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/academy')} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              🏛️ {academyName}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* MATERIALS TAB */}
          {filter === 'materials' && (
            <>
              {studentClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📎</div>
                  <h3 style={{ margin: '0 0 8px 0' }}>Nog geen klassen</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Je bent nog niet ingeschreven voor klassen. Neem contact op met je docent.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {studentClasses.map(cls => (
                    <div key={cls.id} style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                      <button onClick={() => { const next = expandedMaterialClass === cls.id ? null : cls.id; setExpandedMaterialClass(next); if (next) loadMaterialsForClass(next); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '20px 24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(124,92,252,0.3), rgba(56,189,248,0.3))', border: '1px solid rgba(124,92,252,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🎓</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{cls.name}</div>
                          {cls.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{cls.description}</div>}
                        </div>
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedMaterialClass === cls.id ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                      </button>

                      {expandedMaterialClass === cls.id && (
                        <div style={{ padding: '0 24px 20px 24px' }}>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                            {(classMaterials[cls.id] || []).length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>Geen lesmateriaal beschikbaar voor deze klas.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(classMaterials[cls.id] || []).map((mat: any) => (
                                  <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{mat.mimeType?.includes('pdf') ? '📄' : mat.mimeType?.includes('presentation') || mat.mimeType?.includes('pptx') ? '📊' : mat.mimeType?.includes('image') ? '🖼️' : mat.mimeType?.includes('word') || mat.mimeType?.includes('docx') ? '🗒️' : '📁'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{mat.title}</div>
                                      {mat.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{mat.description}</div>}
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {mat.filename} • {(mat.fileSize / 1024).toFixed(0)} KB • Gedeeld door {mat.teacher?.displayName || 'Docent'} • {new Date(mat.createdAt).toLocaleDateString('nl-NL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                      <button onClick={() => window.open(`/api/classes/materials/${mat.id}/download?action=view`, '_blank')} style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>👁️ Openen</button>
                                      <button onClick={() => window.open(`/api/classes/materials/${mat.id}/download`, '_blank')} style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(56,189,248,0.2))', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>⬇️ Download</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* SLIMCHECK TAB */}
          {filter === 'slimcheck' && <SlimCheckStudent />}

          {/* EXAMS TAB */}
          {filter === 'exams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                  📝 Online Toetsen ({studentExams.length})
                </h3>
              </div>

              {studentExams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
                  <h3 style={{ margin: '0 0 8px 0' }}>Geen toetsen klaargezet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Er zijn op dit moment geen actieve toetsen voor jouw klassen.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {studentExams.map(ex => {
                    const sub = ex.mySubmission;
                    const isGraded = sub?.grade !== null && sub?.grade !== undefined;
                    const isSubmitted = sub?.status === 'submitted' || sub?.status === 'graded';
                    const isInProgress = sub?.status === 'in_progress';

                    return (
                      <div
                        key={ex.id}
                        style={{
                          background: 'rgba(17, 24, 39, 0.7)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                          padding: '24px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '24px',
                          flexWrap: 'wrap',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: isGraded ? '#34d399' : isSubmitted ? '#38bdf8' : isInProgress ? '#fbbf24' : '#7c5cfc' }} />

                        <div style={{ flex: 1, minWidth: '280px', paddingLeft: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            {ex.subject && <span style={{ background: 'rgba(124, 92, 252, 0.15)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>{ex.subject}</span>}
                            {ex.className && <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>🎓 {ex.className}</span>}
                            
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: isGraded ? 'rgba(52, 211, 153, 0.15)' : isSubmitted ? 'rgba(56, 189, 248, 0.15)' : isInProgress ? 'rgba(251, 191, 36, 0.15)' : 'rgba(124, 92, 252, 0.15)',
                              color: isGraded ? '#34d399' : isSubmitted ? '#38bdf8' : isInProgress ? '#fbbf24' : '#c4b5fd'
                            }}>
                              {isGraded ? `✓ Cijfer: ${sub.grade}` : isSubmitted ? 'Ingeleverd' : isInProgress ? 'Bezig' : 'Klaargezet'}
                            </span>

                            {ex.hasPassword && (
                              <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '4px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600 }}>
                                🔑 Wachtwoord vereist
                              </span>
                            )}

                            {ex.timeLimitMinutes && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ⏱️ {ex.timeLimitMinutes} min
                              </span>
                            )}
                          </div>

                          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700 }}>{ex.title}</h3>
                          {ex.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>{ex.description}</p>}

                          {isGraded && sub?.teacherNotes && (
                            <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '10px', fontSize: '0.82rem', color: '#e5e7eb' }}>
                              <strong style={{ color: '#34d399' }}>Docent feedback: </strong>{sub.teacherNotes}
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={() => navigate(`/toets/${ex.id}`)}
                            style={{
                              background: isSubmitted ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                              color: '#fff',
                              border: isSubmitted ? '1px solid rgba(255,255,255,0.15)' : 'none',
                              padding: '12px 24px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              boxShadow: isSubmitted ? 'none' : '0 4px 16px rgba(124, 92, 252, 0.35)'
                            }}
                          >
                            {!sub ? 'Start Toets →' : isInProgress ? 'Toets Voortzetten →' : 'Resultaat Inzien →'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ASSIGNMENTS CONTENT */}
          {filter !== 'materials' && filter !== 'slimcheck' && filter !== 'exams' && (
          <>
          {/* Dashboard Stats */}
          {filter === 'all' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard icon="📋" label="Totaal Opdrachten" value={assignments.length} color="var(--primary)" />
                <StatCard icon="⏳" label="Nog Te Doen" value={todoCount} color="#fbbf24" />
                <StatCard icon="✅" label="Afgerond" value={doneCount} color="#34d399" />
              </div>

              {assignments.length > 0 && (
                <div style={{ background: 'rgba(17,24,39,0.7)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Jouw Voortgang</span>
                    <span style={{ color: progressPct === 100 ? '#34d399' : 'var(--primary)' }}>{progressPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: progressPct === 100 ? '#34d399' : 'linear-gradient(90deg, #7c5cfc, #38bdf8)', width: `${progressPct}%`, transition: 'width 0.5s ease-out' }} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Assignments List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {filter === 'todo' ? '⏳ Nog te doen' : filter === 'done' ? '✅ Afgeronde opdrachten' : '📋 Alle opdrachten'}
            </h3>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Opdrachten laden...</div>
          ) : filteredAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
              <h3 style={{ margin: '0 0 8px 0' }}>Geen opdrachten in deze lijst</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Je bent helemaal bij! Zodra er nieuwe opdrachten zijn, verschijnen ze hier.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredAssignments.map(a => {
                const sub = a.submissions?.[0];
                const status = sub?.status || 'not_started';

                return (
                  <div key={a.id} style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
                    {/* Progress visual accent */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: status === 'reviewed' ? '#34d399' : status === 'submitted' ? '#38bdf8' : status === 'in_progress' ? '#fbbf24' : 'transparent' }} />
                    
                    <div style={{ flex: 1, minWidth: '280px', paddingLeft: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {a.subject && <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>{a.subject}</span>}
                        {a.class && <span style={{ background: 'rgba(124, 92, 252, 0.15)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>🎓 {a.class.name}</span>}
                        <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, background: status === 'reviewed' ? 'rgba(52, 211, 153, 0.15)' : status === 'submitted' ? 'rgba(56, 189, 248, 0.15)' : status === 'in_progress' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.07)', color: status === 'reviewed' ? '#34d399' : status === 'submitted' ? '#38bdf8' : status === 'in_progress' ? '#fbbf24' : 'var(--text-secondary)' }}>
                          {status === 'reviewed' ? `✓ Beoordeeld: ${sub.grade || 'Voltooid'}` : status === 'submitted' ? 'Ingeleverd' : status === 'in_progress' ? 'Bezig' : 'Nog niet gestart'}
                        </span>
                        {a.dueDate && <span style={{ fontSize: '0.75rem', color: new Date(a.dueDate) < new Date() && status !== 'submitted' && status !== 'reviewed' ? '#ef4444' : 'var(--text-muted)' }}>⏰ {new Date(a.dueDate).toLocaleDateString('nl-NL')}</span>}
                      </div>

                      <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700 }}>{a.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{a.description}</p>

                      {status === 'reviewed' && sub.teacherNotes && (
                        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', gap: '10px' }}>
                          <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
                          <div>
                            <strong style={{ color: '#34d399', display: 'block', marginBottom: '2px' }}>Docent feedback:</strong>
                            <span style={{ color: '#e5e7eb', lineHeight: 1.5 }}>{sub.teacherNotes}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {status === 'in_progress' && (
                        <button onClick={() => handleSubmitAssignment(a.id)} style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', padding: '12px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                          Inleveren ✓
                        </button>
                      )}

                      <button onClick={() => handleStartAssignment(a)} style={{ background: (status === 'submitted' || status === 'reviewed') ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, var(--primary) 0%, #38bdf8 100%)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: (status === 'submitted' || status === 'reviewed') ? 'none' : '0 4px 16px rgba(124, 92, 252, 0.3)' }}>
                        {status === 'not_started' ? 'Start Opdracht →' : status === 'in_progress' ? 'Verdergaan →' : 'Chat Inzien'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </main>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
