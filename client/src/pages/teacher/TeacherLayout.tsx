import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import UserSettingsModal from '../chat/UserSettingsModal';
import WatermarkDetector from '../chat/WatermarkDetector';
import { useAcademyName } from '../../store/orgStore';

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

export default function TeacherLayout() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const academyName = useAcademyName();
  const { addToast } = useToast();

  if (!user || user.role === 'student') {
    return (
      <div className="center-container">
        <div className="glass-panel text-center">
          <h2>Geen Toegang</h2>
          <p style={{ marginTop: '1rem' }}>Je moet docent of beheerder zijn om deze pagina te bekijken.</p>
          <button onClick={() => navigate('/chat')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            Ga naar Chat
          </button>
        </div>
      </div>
    );
  }
  type Tab = 'dashboard' | 'assignments' | 'submissions' | 'analytics' | 'classes' | 'ai_scanner';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quotaSettings, setQuotaSettings] = useState<{allowTeachersToOverrideQuota: boolean; maxTeacherOverrideQuota: number | null}>({allowTeachersToOverrideQuota: false, maxTeacherOverrideQuota: null});

  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('Begeleid de leerling stap voor stap door socratische vragen te stellen. Geef nooit direct het antwoord voor, maar stimuleer kritisch denken.');
  const [newDueDate, setNewDueDate] = useState('');
  const [newMaxAttempts, setNewMaxAttempts] = useState('0');
  const [newClassId, setNewClassId] = useState('');
  const [newAiRules, setNewAiRules] = useState('');
  const [editAssignment, setEditAssignment] = useState<any | null>(null);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassCustomQuota, setNewClassCustomQuota] = useState(false);
  const [newClassMaxDay, setNewClassMaxDay] = useState('');
  const [newClassMaxMonth, setNewClassMaxMonth] = useState('');
  const [manageClass, setManageClass] = useState<any | null>(null);
  const [classMembers, setClassMembers] = useState<{ studentMembers: any[], teacherMembers: any[] }>({ studentMembers: [], teacherMembers: [] });
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [manageClassCustomQuota, setManageClassCustomQuota] = useState(false);
  const [manageClassMaxDay, setManageClassMaxDay] = useState('');
  const [manageClassMaxMonth, setManageClassMaxMonth] = useState('');
  const [reviewSubmission, setReviewSubmission] = useState<any | null>(null);
  const [submissionChat, setSubmissionChat] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [gradeInput, setGradeInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [reviewFullscreen, setReviewFullscreen] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackMsgIdx, setFeedbackMsgIdx] = useState<number | null>(null);
  const [submissionFilterClass, setSubmissionFilterClass] = useState<string>('');
  const [submissionSearchText, setSubmissionSearchText] = useState<string>('');

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const [assRes, clsRes, quotaRes] = await Promise.all([
        fetch('/api/assignments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes/quota-settings', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (assRes.ok) setAssignments(await assRes.json());
      if (clsRes.ok) setClasses(await clsRes.json());
      if (quotaRes.ok) setQuotaSettings(await quotaRes.json());
    } catch (e) { addToast('Fout bij ophalen van gegevens', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!token) { navigate('/login'); return; } loadAssignments(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim() || !newInstructions.trim()) { addToast('Vul alle verplichte velden in', 'info'); return; }
    try {
      const res = await fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: newTitle, subject: newSubject, description: newDescription, instructions: newInstructions, dueDate: newDueDate || null, maxAttempts: parseInt(newMaxAttempts, 10) || 0, classId: newClassId || null, aiRules: newAiRules || null }) });
      if (res.ok) { addToast('Opdracht succesvol aangemaakt!', 'success'); setShowCreateModal(false); setNewTitle(''); setNewAiRules(''); setNewSubject(''); setNewDescription(''); loadAssignments(); }
      else { const err = await res.json(); addToast(err.error || 'Aanmaken mislukt', 'error'); }
    } catch (e) { addToast('Netwerkfout bij aanmaken', 'error'); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAssignment || !editAssignment.title.trim() || !editAssignment.description.trim() || !editAssignment.instructions.trim()) { addToast('Vul alle verplichte velden in', 'info'); return; }
    try {
      const res = await fetch(`/api/assignments/${editAssignment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: editAssignment.title, description: editAssignment.description, instructions: editAssignment.instructions, subject: editAssignment.subject, dueDate: editAssignment.dueDate || null, maxAttempts: editAssignment.maxAttempts, classId: editAssignment.classId || null, aiRules: editAssignment.aiRules || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      addToast('Opdracht succesvol bijgewerkt', 'success'); setEditAssignment(null); loadAssignments();
    } catch (err: any) { addToast(err.message, 'error'); }
  };

  const toggleAssignmentActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive: !currentStatus }) });
      if (!res.ok) throw new Error('Kon status niet updaten');
      addToast(`Opdracht ${!currentStatus ? 'geactiveerd' : 'gearchiveerd'}`, 'success'); loadAssignments();
    } catch (e) { addToast('Fout bij wijzigen status', 'error'); }
  };

  const handleResetSubmission = async (submissionId: string) => {
    if (!confirm('Weet je zeker dat je deze inzending wilt herstarten?')) return;
    try {
      const res = await fetch(`/api/assignments/submissions/${submissionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Herstarten mislukt');
      addToast('Inzending herstart en verwijderd.', 'success'); loadAssignments();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) { addToast('Naam is verplicht', 'info'); return; }
    try {
      const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newClassName, description: newClassDesc, customQuotaEnabled: newClassCustomQuota, maxPromptsPerDay: newClassMaxDay, maxPromptsPerMonth: newClassMaxMonth }) });
      if (res.ok) { addToast('Klas succesvol aangemaakt!', 'success'); setShowCreateClassModal(false); setNewClassName(''); setNewClassDesc(''); setNewClassCustomQuota(false); setNewClassMaxDay(''); setNewClassMaxMonth(''); loadAssignments(); }
      else { const err = await res.json(); addToast(err.error || 'Aanmaken mislukt', 'error'); }
    } catch (e) { addToast('Netwerkfout bij aanmaken klas', 'error'); }
  };

  const handleOpenManageMembers = async (cls: any) => { setManageClass(cls); setManageClassCustomQuota(cls.customQuotaEnabled || false); setManageClassMaxDay(cls.maxPromptsPerDay || ''); setManageClassMaxMonth(cls.maxPromptsPerMonth || ''); loadClassMembers(cls.id); };
  const handleUpdateClassQuota = async () => {
    if (!manageClass) return;
    try {
      const res = await fetch(`/api/classes/${manageClass.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ customQuotaEnabled: manageClassCustomQuota, maxPromptsPerDay: manageClassMaxDay, maxPromptsPerMonth: manageClassMaxMonth }) });
      if (res.ok) { addToast('Quota instellingen succesvol opgeslagen', 'success'); loadAssignments(); }
      else { const err = await res.json(); addToast(err.error || 'Fout bij opslaan quota', 'error'); }
    } catch (e) { addToast('Netwerkfout', 'error'); }
  };

  const loadClassMembers = async (classId: string) => { try { const res = await fetch(`/api/classes/${classId}/members`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setClassMembers(await res.json()); } catch (e) { addToast('Fout bij ophalen van leden', 'error'); } };
  const handleSearchMembers = async (q: string) => { setMemberSearch(q); if (q.length < 2) { setMemberSearchResults([]); return; } setIsSearchingMembers(true); try { const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setMemberSearchResults(await res.json()); } catch (e) {} finally { setIsSearchingMembers(false); } };
  const handleAddMember = async (userId: string) => { if (!manageClass) return; try { const res = await fetch(`/api/classes/${manageClass.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId }) }); if (res.ok) { addToast('Lid succesvol toegevoegd', 'success'); setMemberSearch(''); setMemberSearchResults([]); loadClassMembers(manageClass.id); loadAssignments(); } else { const err = await res.json(); addToast(err.error || 'Fout bij toevoegen', 'error'); } } catch (e) { addToast('Netwerkfout bij toevoegen lid', 'error'); } };
  const handleRemoveMember = async (userId: string) => { if (!manageClass) return; if (!confirm('Weet je zeker dat je dit lid wilt verwijderen?')) return; try { const res = await fetch(`/api/classes/${manageClass.id}/members/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { addToast('Lid succesvol verwijderd', 'success'); loadClassMembers(manageClass.id); loadAssignments(); } else { const err = await res.json(); addToast(err.error || 'Fout bij verwijderen', 'error'); } } catch (e) { addToast('Netwerkfout bij verwijderen lid', 'error'); } };

  const openReview = async (sub: any) => { setReviewSubmission(sub); setGradeInput(sub.grade || ''); setNotesInput(sub.teacherNotes || ''); setLoadingChat(true); try { const res = await fetch(`/api/assignments/submissions/${sub.id}/chat`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { const data = await res.json(); setSubmissionChat(data.messages || []); } } catch (e) { addToast('Fout bij ophalen van leerling chat', 'error'); } finally { setLoadingChat(false); } };
  const handleSaveReview = async () => { if (!reviewSubmission) return; try { const res = await fetch(`/api/assignments/submissions/${reviewSubmission.id}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ grade: gradeInput, teacherNotes: notesInput }) }); if (res.ok) { addToast('Beoordeling succesvol opgeslagen!', 'success'); setReviewSubmission(null); loadAssignments(); } } catch (e) { addToast('Fout bij opslaan beoordeling', 'error'); } };

  const allSubmissions = assignments.flatMap(a => (a.submissions || []).map((s: any) => ({ ...s, assignmentTitle: a.title, assignmentSubject: a.subject, classId: a.classId, className: a.class?.name, studentName: s.student?.displayName || s.studentId?.substring(0, 10), studentEmail: s.student?.email || '' }))).filter(sub => { if (submissionFilterClass && sub.classId !== submissionFilterClass) return false; if (submissionSearchText) { const sL = submissionSearchText.toLowerCase(); if (!sub.studentName?.toLowerCase().includes(sL) && !sub.studentEmail?.toLowerCase().includes(sL) && !sub.assignmentTitle?.toLowerCase().includes(sL)) return false; } return true; });
  const pendingSubmissions = allSubmissions.filter(s => s.status === 'submitted' || s.status === 'ai_graded');
  const activeAssignments = assignments.filter(a => a.isActive);
  const totalStudents = classes.reduce((acc, c) => acc + (c._count?.studentMembers || 0), 0);

  const navItems: { id: Tab; icon: string; label: string; count?: number }[] = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'assignments', icon: '📋', label: 'Opdrachten', count: assignments.length },
    { id: 'classes', icon: '👥', label: 'Mijn Klassen', count: classes.length },
    { id: 'submissions', icon: '📥', label: 'Inzendingen', count: pendingSubmissions.length },
    { id: 'analytics', icon: '📊', label: 'Voortgang & Inzichten' },
    { id: 'ai_scanner', icon: '🔍', label: 'AI Detectie' },
  ];

  const F: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontFamily: 'inherit' };


  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{ width: sidebarCollapsed ? '64px' : '230px', background: 'rgba(10,14,26,0.97)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', padding: sidebarCollapsed ? '16px 8px' : '16px 12px', gap: '4px', transition: 'width 0.25s ease', overflow: 'hidden', flexShrink: 0, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #c4b5fd, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Locra</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>DOCENTENPORTAAL</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {navItems.map(item => (
            sidebarCollapsed ? (
              <button key={item.id} title={item.label} onClick={() => setActiveTab(item.id)} style={{ background: activeTab === item.id ? 'rgba(124,92,252,0.18)' : 'transparent', border: activeTab === item.id ? '1px solid rgba(124,92,252,0.35)' : '1px solid transparent', borderRadius: '10px', color: activeTab === item.id ? '#c4b5fd' : 'var(--text-secondary)', width: '100%', height: '40px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.icon}
                {item.count !== undefined && item.count > 0 && <span style={{ position: 'absolute', top: 3, right: 3, background: '#7c5cfc', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '0.58rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{item.count}</span>}
              </button>
            ) : <NavItem key={item.id} icon={item.icon} label={item.label} active={activeTab === item.id} count={item.count} onClick={() => setActiveTab(item.id)} />
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{user?.displayName?.[0]?.toUpperCase() || 'D'}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || 'Docent'}</div>
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
              <button onClick={() => navigate('/chat')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', fontSize: '0.82rem' }}>← Terug naar Chat</button>
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
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>{navItems.find(n => n.id === activeTab)?.icon} {navItems.find(n => n.id === activeTab)?.label}</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {activeTab === 'dashboard' && 'Jouw persoonlijk overzicht van vandaag'}
              {activeTab === 'assignments' && 'Maak en beheer opdrachten voor jouw leerlingen'}
              {activeTab === 'classes' && 'Beheer klassen en klasleden'}
              {activeTab === 'submissions' && 'Beoordeel inzendingen en geef feedback'}
              {activeTab === 'analytics' && 'Inzichten in leerlingvoortgang per klas'}
              {activeTab === 'ai_scanner' && 'Detecteer AI-gegenereerd werkstukmateriaal met watermerken'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/academy')} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>🏛️ {academyName}</button>
            {activeTab === 'assignments' && <button onClick={() => setShowCreateModal(true)} style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(124,92,252,0.4)' }}>+ Nieuwe Opdracht</button>}
            {activeTab === 'classes' && <button onClick={() => setShowCreateClassModal(true)} style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(124,92,252,0.4)' }}>+ Nieuwe Klas</button>}
            {activeTab === 'ai_scanner' && <button onClick={() => setShowWatermarkModal(true)} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>🔍 Scanner Openen</button>}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard icon="📋" label="Actieve Opdrachten" value={activeAssignments.length} color="var(--primary)" sub={`van ${assignments.length} totaal`} />
                <StatCard icon="👥" label="Totaal Leerlingen" value={totalStudents} color="#38bdf8" sub={`in ${classes.length} klassen`} />
                <StatCard icon="📥" label="Te Beoordelen" value={pendingSubmissions.length} color="#f59e0b" sub="nieuwe inzendingen" />
                <StatCard icon="✅" label="Beoordeeld" value={allSubmissions.filter(s => s.status === 'reviewed').length} color="#34d399" sub="afgeronde beoordelingen" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(124,92,252,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📢</div>
                    <div><div style={{ fontWeight: 600 }}>Snel Starten</div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Meest gebruikte acties</div></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: '+ Nieuwe Opdracht aanmaken', action: () => { setActiveTab('assignments'); setShowCreateModal(true); }, color: '#7c5cfc' },
                      { label: '+ Nieuwe Klas aanmaken', action: () => { setActiveTab('classes'); setShowCreateClassModal(true); }, color: '#38bdf8' },
                      { label: '🔍 AI Detectie Scanner openen', action: () => setShowWatermarkModal(true), color: '#f59e0b' },
                      { label: '📥 Inzendingen bekijken', action: () => setActiveTab('submissions'), color: '#34d399' },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: item.color, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem', fontWeight: 500 }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📥</div>
                    <div><div style={{ fontWeight: 600 }}>Recente Inzendingen</div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Wachten op beoordeling</div></div>
                  </div>
                  {pendingSubmissions.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0', textAlign: 'center' }}><div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>Alles beoordeeld!</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pendingSubmissions.slice(0, 5).map(sub => (
                        <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px' }}>
                          <div><div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{sub.studentName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub.assignmentTitle}</div></div>
                          <button onClick={() => openReview(sub)} style={{ background: 'rgba(124,92,252,0.2)', border: 'none', color: '#c4b5fd', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Bekijken</button>
                        </div>
                      ))}
                      {pendingSubmissions.length > 5 && <button onClick={() => setActiveTab('submissions')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '6px' }}>+{pendingSubmissions.length - 5} meer →</button>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Recente Opdrachten</h3>
                  <button onClick={() => setActiveTab('assignments')} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}>Alle bekijken →</button>
                </div>
                {assignments.slice(0, 4).length === 0 ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nog geen opdrachten aangemaakt.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assignments.slice(0, 4).map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.isActive ? '#34d399' : '#6b7280', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{a.title}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.subject || 'Geen vak'} • {a._count?.submissions || 0} inzendingen</div></div>
                        <div style={{ fontSize: '0.75rem', color: a.dueDate && new Date(a.dueDate) < new Date() ? '#ef4444' : 'var(--text-muted)' }}>{a.dueDate ? new Date(a.dueDate).toLocaleDateString('nl-NL') : 'Geen deadline'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* OPDRACHTEN */}
          {activeTab === 'assignments' && (
            loading ? <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Opdrachten laden...</div>
            : assignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
                <h3 style={{ margin: '0 0 8px 0' }}>Nog geen opdrachten</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Maak je eerste opdracht aan.</p>
                <button onClick={() => setShowCreateModal(true)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Nieuwe Opdracht Aanmaken</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {a.subject && <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>{a.subject}</span>}
                          {a.class && <span style={{ background: 'rgba(124,92,252,0.15)', color: '#c4b5fd', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>🎓 {a.class.name}</span>}
                        </div>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', background: a.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(107,114,128,0.15)', color: a.isActive ? '#34d399' : '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.isActive ? '● Actief' : '○ Gearchiveerd'}</span>
                      </div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 600 }}>{a.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.5, margin: '0 0 16px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</p>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>📥 {a._count?.submissions || 0} inzendingen</span>
                        <span>{a.dueDate ? `⏰ ${new Date(a.dueDate).toLocaleDateString('nl-NL')}` : 'Geen deadline'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button onClick={() => toggleAssignmentActive(a.id, a.isActive)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '7px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>{a.isActive ? 'Archiveren' : 'Activeren'}</button>
                        <button onClick={() => setEditAssignment({...a, dueDate: a.dueDate ? new Date(a.dueDate).toISOString().split('T')[0] : ''})} style={{ flex: 1, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', padding: '7px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>✏️ Bewerk</button>
                        <button onClick={() => setActiveTab('submissions')} style={{ flex: 1, background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)', color: '#c4b5fd', padding: '7px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>📥 Inzendingen</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* INZENDINGEN */}
          {activeTab === 'submissions' && (
            <>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="text" placeholder="Zoek op naam of opdracht..." value={submissionSearchText} onChange={e => setSubmissionSearchText(e.target.value)} style={{ ...F, flex: 1 }} />
                <select value={submissionFilterClass} onChange={e => setSubmissionFilterClass(e.target.value)} style={{ ...F, width: 'auto' }}>
                  <option value="">Alle Klassen</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ background: 'rgba(17,24,39,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                {allSubmissions.length === 0 ? <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Nog geen inzendingen gevonden.</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead><tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '14px 20px' }}>Opdracht</th><th style={{ padding: '14px 20px' }}>Klas</th><th style={{ padding: '14px 20px' }}>Leerling</th>
                      <th style={{ padding: '14px 20px' }}>Status</th><th style={{ padding: '14px 20px' }}>Berichten</th><th style={{ padding: '14px 20px' }}>Cijfer</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actie</th>
                    </tr></thead>
                    <tbody>
                      {allSubmissions.map((sub, i) => (
                        <tr key={sub.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '13px 20px', fontWeight: 500 }}>{sub.assignmentTitle}</td>
                          <td style={{ padding: '13px 20px', color: 'var(--text-secondary)' }}>{sub.className || '—'}</td>
                          <td style={{ padding: '13px 20px', color: 'var(--text-secondary)' }}>{sub.studentName}</td>
                          <td style={{ padding: '13px 20px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: sub.status === 'reviewed' ? 'rgba(52,211,153,0.15)' : sub.status === 'submitted' ? 'rgba(56,189,248,0.15)' : 'rgba(251,191,36,0.15)', color: sub.status === 'reviewed' ? '#34d399' : sub.status === 'submitted' ? '#38bdf8' : '#fbbf24' }}>
                              {sub.status === 'reviewed' ? '✓ Beoordeeld' : sub.status === 'submitted' ? '● Ingeleverd' : '○ Bezig'}
                            </span>
                          </td>
                          <td style={{ padding: '13px 20px' }}>{sub.messageCount || '—'}</td>
                          <td style={{ padding: '13px 20px', fontWeight: 600 }}>{sub.grade || '—'}</td>
                          <td style={{ padding: '13px 20px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openReview(sub)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Beoordelen</button>
                            <button onClick={() => handleResetSubmission(sub.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem' }} title="Reset">↺</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ANALYTICS */}
          {activeTab === 'analytics' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard icon="📋" label="Totaal Opdrachten" value={assignments.length} color="var(--primary)" />
                <StatCard icon="✅" label="Actieve Opdrachten" value={activeAssignments.length} color="#34d399" />
                <StatCard icon="📥" label="Inleveringen Totaal" value={allSubmissions.length} color="#38bdf8" />
                <StatCard icon="⏳" label="Nog te Beoordelen" value={pendingSubmissions.length} color="#fbbf24" />
              </div>
              <div style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>📊 Statistieken per Klas</h3>
                {classes.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Nog geen klassen beschikbaar.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {classes.map(cls => {
                      const classAssignments = assignments.filter(a => a.classId === cls.id);
                      const classSubs = allSubmissions.filter(s => s.classId === cls.id);
                      const pct = classSubs.length > 0 ? Math.round((classSubs.filter(s => s.status === 'reviewed').length / classSubs.length) * 100) : 0;
                      return (
                        <div key={cls.id} style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#c4b5fd' }}>🎓 {cls.name}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{cls._count?.studentMembers || 0} Leerlingen • {classAssignments.length} Opdrachten • {classSubs.length} Inleveringen</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171' }}>{pct}%</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Beoordeeld</div>
                            </div>
                          </div>
                          <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* KLASSEN */}
          {activeTab === 'classes' && (
            classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👥</div>
                <h3 style={{ margin: '0 0 8px 0' }}>Nog geen klassen</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Maak een klas aan om leerlingen te groeperen.</p>
                <button onClick={() => setShowCreateClassModal(true)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Eerste Klas Aanmaken</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {classes.map(cls => (
                  <div key={cls.id} style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(124,92,252,0.3), rgba(56,189,248,0.3))', border: '1px solid rgba(124,92,252,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🎓</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{cls.name}</h3>
                        {cls.description && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>{cls.description}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      <span>👤 {cls._count?.studentMembers || 0} Leerlingen</span>
                      <span>👨‍🏫 {cls._count?.teacherMembers || 0} Docenten</span>
                      <span>📋 {assignments.filter(a => a.classId === cls.id).length} Opdrachten</span>
                    </div>
                    <button onClick={() => handleOpenManageMembers(cls)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '9px', borderRadius: '9px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>Beheer Leden & Quota</button>
                  </div>
                ))}
              </div>
            )
          )}

          {/* AI SCANNER */}
          {activeTab === 'ai_scanner' && (
            <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(56,189,248,0.12))', border: '1px solid rgba(124,92,252,0.25)', borderRadius: '20px', padding: '32px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ fontSize: '3rem', flexShrink: 0 }}>🕵️</div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Locra AI Detectie Scanner</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Detecteer steganografische watermerken in tekst of geüploade bestanden (.pdf, .docx). Dezelfde krachtige engine als in de chat.</p>
                </div>
                <button onClick={() => setShowWatermarkModal(true)} style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 4px 20px rgba(124,92,252,0.4)' }}>🔍 Scanner Openen</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { icon: '💧', title: 'Steganografische Watermerken', desc: 'Detecteert onzichtbare Unicode watermerken ingebed door Locra AI.' },
                  { icon: '🔬', title: 'Röntgen Inspectie', desc: 'Visualiseer precies welke zinnen een watermerk bevatten.' },
                  { icon: '📄', title: 'Bestands Upload', desc: 'Upload een PDF of .docx voor directe analyse zonder kopiëren.' },
                  { icon: '🏫', title: 'School Herkomst', desc: 'Ontdek van welke instelling een AI-gegenereerde tekst afkomstig is.' },
                ].map(item => (
                  <div key={item.title} style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALS */}
      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
      {showWatermarkModal && <WatermarkDetector onClose={() => setShowWatermarkModal(false)} />}

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem' }}>📋 Nieuwe Opdracht Klaarzetten</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Titel *</label><input type="text" required placeholder="Bijv. Essay Schrijfvaardigheid" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={F} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Vak / Categorie</label><input type="text" placeholder="Bijv. Nederlands, Wiskunde B" value={newSubject} onChange={e => setNewSubject(e.target.value)} style={F} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Opdracht omschrijving (ziet de leerling) *</label><textarea required rows={3} placeholder="Leg uit wat de leerling moet doen..." value={newDescription} onChange={e => setNewDescription(e.target.value)} style={{ ...F, resize: 'vertical' as const }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>AI-instructies (verborgen voor leerling) *</label><textarea required rows={4} value={newInstructions} onChange={e => setNewInstructions(e.target.value)} style={{ ...F, resize: 'vertical' as const, fontSize: '0.85rem' }} /><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⚠️ Dit ziet de leerling NIET, alleen de AI.</span></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Extra AI Gedragsregels (optioneel)</label><textarea rows={2} placeholder="Bijv. 'Praat alleen in het Frans'" value={newAiRules} onChange={e => setNewAiRules(e.target.value)} style={{ ...F, resize: 'vertical' as const }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Inleverdeadline</label><input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} style={F} /></div>
                <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Max pogingen (0 = onbeperkt)</label><input type="number" min="0" value={newMaxAttempts} onChange={e => setNewMaxAttempts(e.target.value)} style={F} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Selecteer een Klas (optioneel)</label><select value={newClassId} onChange={e => setNewClassId(e.target.value)} style={{ ...F, fontSize: '0.9rem' }}><option value="">-- Zichtbaar voor alle groepen --</option>{classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', borderRadius: '10px', cursor: 'pointer' }}>Annuleren</button>
                <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Opdracht Publiceren</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editAssignment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem' }}>✏️ Opdracht Bewerken</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Titel *</label><input type="text" required value={editAssignment.title || ''} onChange={e => setEditAssignment({...editAssignment, title: e.target.value})} style={F} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Vak / Categorie</label><input type="text" value={editAssignment.subject || ''} onChange={e => setEditAssignment({...editAssignment, subject: e.target.value})} style={F} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Omschrijving voor leerlingen *</label><textarea required rows={3} value={editAssignment.description || ''} onChange={e => setEditAssignment({...editAssignment, description: e.target.value})} style={{ ...F, resize: 'vertical' as const }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>AI-gedragsinstructies *</label><textarea required rows={4} value={editAssignment.instructions || ''} onChange={e => setEditAssignment({...editAssignment, instructions: e.target.value})} style={{ ...F, resize: 'vertical' as const, fontSize: '0.85rem' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Extra AI Gedragsregels</label><textarea rows={2} value={editAssignment.aiRules || ''} onChange={e => setEditAssignment({...editAssignment, aiRules: e.target.value})} style={{ ...F, resize: 'vertical' as const }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Inleverdeadline</label><input type="date" value={editAssignment.dueDate || ''} onChange={e => setEditAssignment({...editAssignment, dueDate: e.target.value})} style={F} /></div>
                <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Max pogingen</label><input type="number" min="0" value={editAssignment.maxAttempts || 0} onChange={e => setEditAssignment({...editAssignment, maxAttempts: parseInt(e.target.value, 10)})} style={F} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setEditAssignment(null)} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', borderRadius: '10px', cursor: 'pointer' }}>Annuleren</button>
                <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateClassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem' }}>👥 Nieuwe Klas Aanmaken</h2>
            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Klassennaam *</label><input required type="text" placeholder="Bijv. 4Havo of 6VWO" value={newClassName} onChange={e => setNewClassName(e.target.value)} style={F} /></div>
              <div><label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Beschrijving (optioneel)</label><textarea rows={2} value={newClassDesc} onChange={e => setNewClassDesc(e.target.value)} style={{ ...F, resize: 'vertical' as const }} /></div>
              {quotaSettings.allowTeachersToOverrideQuota && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aangepaste Quota</div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Max {quotaSettings.maxTeacherOverrideQuota || 'onbeperkt'} per dag.</div></div>
                    <input type="checkbox" className="toggle" checked={newClassCustomQuota} onChange={e => setNewClassCustomQuota(e.target.checked)} />
                  </div>
                  {newClassCustomQuota && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Prompts / Dag</label><input type="number" placeholder="10" value={newClassMaxDay} onChange={e => setNewClassMaxDay(e.target.value)} style={F} /></div>
                      <div><label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Prompts / Maand</label><input type="number" placeholder="100" value={newClassMaxMonth} onChange={e => setNewClassMaxMonth(e.target.value)} style={F} /></div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowCreateClassModal(false)} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', borderRadius: '10px', cursor: 'pointer' }}>Annuleren</button>
                <button type="submit" style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Aanmaken</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageClass && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '600px', padding: '28px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>👥 Beheer "{manageClass.name}"</h2>
              <button onClick={() => setManageClass(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', borderRadius: '8px', width: '32px', height: '32px' }}>✕</button>
            </div>
            {quotaSettings.allowTeachersToOverrideQuota && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aangepaste Quota</div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Max {quotaSettings.maxTeacherOverrideQuota || 'onbeperkt'} per dag.</div></div>
                  <input type="checkbox" className="toggle" checked={manageClassCustomQuota} onChange={e => setManageClassCustomQuota(e.target.checked)} />
                </div>
                {manageClassCustomQuota && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Prompts / Dag</label><input type="number" value={manageClassMaxDay} onChange={e => setManageClassMaxDay(e.target.value)} style={F} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Prompts / Maand</label><input type="number" value={manageClassMaxMonth} onChange={e => setManageClassMaxMonth(e.target.value)} style={F} /></div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button onClick={handleUpdateClassQuota} style={{ padding: '8px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Quota Opslaan</button>
                </div>
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Lid Zoeken</label>
              <input type="text" placeholder="Typ minimaal 2 tekens..." value={memberSearch} onChange={e => handleSearchMembers(e.target.value)} style={F} />
              {memberSearch.length >= 2 && (
                <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {isSearchingMembers ? <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Zoeken...</div>
                  : memberSearchResults.length === 0 ? <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Geen gebruikers gevonden.</div>
                  : memberSearchResults.map(u => {
                    const isMember = classMembers.studentMembers.some(sm => sm.student.id === u.id) || classMembers.teacherMembers.some(tm => tm.teacher.id === u.id);
                    return (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.displayName}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</div></div>
                        <button disabled={isMember} onClick={() => handleAddMember(u.id)} style={{ padding: '5px 12px', background: isMember ? 'rgba(255,255,255,0.05)' : 'var(--primary)', color: isMember ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: '8px', cursor: isMember ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                          {isMember ? 'Al Lid' : 'Toevoegen'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>👨‍🏫 Docenten ({classMembers.teacherMembers.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {classMembers.teacherMembers.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen docenten gekoppeld.</span>}
                {classMembers.teacherMembers.map(tm => (
                  <div key={tm.teacher.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>{tm.teacher.displayName[0]?.toUpperCase()}</div>
                      <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tm.teacher.displayName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{tm.teacher.email}</div></div>
                    </div>
                    <button onClick={() => handleRemoveMember(tm.teacher.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>Verwijder</button>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>👤 Leerlingen ({classMembers.studentMembers.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {classMembers.studentMembers.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Geen leerlingen gekoppeld.</span>}
                {classMembers.studentMembers.map(sm => (
                  <div key={sm.student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>{sm.student.displayName[0]?.toUpperCase()}</div>
                      <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sm.student.displayName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sm.student.email}</div></div>
                    </div>
                    <button onClick={() => handleRemoveMember(sm.student.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>Verwijder</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewSubmission && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: reviewFullscreen ? '0' : '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: reviewFullscreen ? '0' : '20px', width: '100%', maxWidth: reviewFullscreen ? '100%' : '960px', height: reviewFullscreen ? '100vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s ease' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>💬 Beoordeling — {reviewSubmission.studentName}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opdracht: {reviewSubmission.assignmentTitle}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setReviewFullscreen(!reviewFullscreen)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px' }}>{reviewFullscreen ? '⛌' : '⛶'}</button>
                <button onClick={() => setReviewSubmission(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px' }}>✕</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: reviewSubmission.googleDocUrl ? '1.5fr 1.2fr 1fr' : '1.6fr 1fr', flex: 1, overflow: 'hidden' }}>
              {reviewSubmission.googleDocUrl && (
                <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', background: '#fff' }}>
                  <iframe src={reviewSubmission.googleDocUrl.replace(/\/edit.*$/, '/edit?rm=minimal')} style={{ width: '100%', height: '100%', border: 'none' }} title="Google Doc" />
                </div>
              )}
              <div style={{ overflowY: 'auto', padding: '20px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loadingChat ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chat laden...</div>
                : submissionChat.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Geen berichten gevonden.</div>
                : submissionChat.map((m, idx) => {
                  const isFeedbackActive = feedbackMsgIdx === idx;
                  return (
                    <div key={m.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ background: m.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.07)', color: '#fff', padding: '10px 14px', borderRadius: '12px', fontSize: '0.875rem', lineHeight: 1.5, border: m.teacherFeedback ? '1px dashed #fbbf24' : 'none' }} onDoubleClick={() => setFeedbackMsgIdx(isFeedbackActive ? null : idx)} title="Dubbelklik voor feedback">
                        <div style={{ fontSize: '0.7rem', color: m.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginBottom: '4px' }}>{m.role === 'user' ? 'Leerling' : 'Locra AI'}</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      </div>
                      {(m.teacherFeedback || isFeedbackActive) && (
                        <div style={{ background: 'rgba(251,191,36,0.1)', borderLeft: '3px solid #fbbf24', padding: '8px 12px', borderRadius: '4px 8px 8px 4px', fontSize: '0.82rem', marginTop: '2px' }}>
                          <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>Jouw Feedback:</div>
                          {isFeedbackActive ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input autoFocus type="text" value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} placeholder="Typ feedback..." style={{ flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', fontFamily: 'inherit' }} />
                              <button onClick={async () => { if (!feedbackInput) { setFeedbackMsgIdx(null); return; } try { await fetch(`/api/chat/messages/${m.id}/feedback`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ feedback: feedbackInput }) }); m.teacherFeedback = feedbackInput; setFeedbackInput(''); setFeedbackMsgIdx(null); addToast('Feedback opgeslagen', 'success'); } catch { addToast('Fout bij opslaan feedback', 'error'); }}} style={{ background: '#fbbf24', color: '#000', border: 'none', padding: '0 10px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Opslaan</button>
                            </div>
                          ) : <div style={{ color: '#fff' }}>{m.teacherFeedback}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Beoordeling Invoeren</h4>
                {reviewSubmission.aiGradeReport && (
                  <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '6px' }}>🤖 Locra AI Pre-Beoordeling</div>
                    <div style={{ fontSize: '0.82rem', color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{reviewSubmission.aiGradeReport}</div>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Cijfer of Beoordeling</label>
                  <input type="text" placeholder="Bijv. 7.5 of Voldoende" value={gradeInput} onChange={e => setGradeInput(e.target.value)} style={F} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Feedback / Opmerkingen</label>
                  <textarea rows={5} placeholder="Geef hier je feedback..." value={notesInput} onChange={e => setNotesInput(e.target.value)} style={{ ...F, resize: 'vertical' as const, fontSize: '0.85rem' }} />
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <button onClick={handleSaveReview} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #34d399, #059669)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                    ✓ Opslaan & Afronden
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
