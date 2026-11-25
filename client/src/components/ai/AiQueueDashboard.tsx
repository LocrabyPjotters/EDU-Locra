import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  Clock, Cpu, Moon, Zap, RefreshCw, Plus, Play, Trash2,
  AlertTriangle, CheckCircle, Loader2, Sparkles, Calendar, Sliders, X, Brain
} from 'lucide-react';

interface HourlyLoadCell {
  dayOfWeek: number;
  dayLabel: string;
  hour: number;
  avgPrompts: number;
  avgTokens: number;
  avgLatencyMs: number;
  backgroundTasksCount: number;
  historicalLoadScore: number;
  classification: 'dal' | 'normaal' | 'piek';
}

interface OffPeakAnalysis {
  orgId: string;
  generatedAt: string;
  lookbackDays: number;
  dataPointsUsed: number;
  analysisConfidence: 'laag_koudestart' | 'gemiddeld' | 'hoog';
  matrix: HourlyLoadCell[][];
  peakHoursSummary: string[];
  offPeakHoursSummary: string[];
  quietestSlot: { dayLabel: string; hour: number; label: string; score: number };
  busiestSlot: { dayLabel: string; hour: number; label: string; score: number };
  live: {
    state: 'rustig' | 'normaal' | 'druk';
    isOffPeakNow: boolean;
    loadScore: number;
    chatActiveStreams: number;
    chatQueuedCount: number;
    recentMessages10m: number;
    activeScheduleRuleName: string | null;
    currentClassification: 'dal' | 'normaal' | 'piek';
  };
}

interface AiQueueTask {
  id: string;
  taskType: 'live_generate' | 'live_review' | 'slimcheck_grade' | 'custom_ai';
  title: string;
  description: string;
  userPriority: number | null;
  aiPriority: number;
  effectivePriority: number;
  aiEstimatedDurationSec: number;
  aiComplexity: 'light' | 'medium' | 'heavy';
  aiRecommendedWindow: string;
  aiReasoning?: string;
  schedulePreference: string;
  deadlineAt?: string | null;
  plannedStartAt?: string | null;
  plannedFinishAt?: string | null;
  escalatedToUrgent: boolean;
  status: 'queued' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number;
  progressMessage?: string;
  resultSummary?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string | null;
  user?: { id: string; displayName: string; role: string };
}

interface AiQueueDashboardProps {
  mode: 'teacher' | 'admin';
}

const TASK_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  live_generate: { label: '🎯 Locra Live Les', color: '#c4b5fd', bg: 'rgba(124, 92, 252, 0.18)' },
  live_review: { label: '🔎 Cito Kwaliteitscheck', color: '#7dd3fc', bg: 'rgba(56, 189, 248, 0.16)' },
  slimcheck_grade: { label: '🧠 SlimCheck Nakijken', color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.16)' },
  custom_ai: { label: '✨ Achtergrond AI-Taak', color: '#fde68a', bg: 'rgba(245, 158, 11, 0.16)' }
};

function formatDurationMin(sec: number): string {
  if (!sec || sec < 60) return `${Math.max(15, sec || 30)}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `~${hrs}u ${rem}m` : `~${hrs}u`;
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AiQueueDashboard({ mode }: AiQueueDashboardProps) {
  const token = useAuthStore(s => s.token);
  const [loading, setLoading] = useState(true);
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
  const [shortQueue, setShortQueue] = useState<any>(null);
  const [analysis, setAnalysis] = useState<OffPeakAnalysis | null>(null);
  const [tasks, setTasks] = useState<AiQueueTask[]>([]);

  // Nieuwe taak formulier
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAutoPrio, setNewAutoPrio] = useState(false);
  const [newPriority, setNewPriority] = useState<number>(6);
  const [newDeadline, setNewDeadline] = useState('');
  const [newSchedPref, setNewSchedPref] = useState<'smart_offpeak' | 'immediate'>('smart_offpeak');
  const [triagePreview, setTriagePreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bewerk modal voor prioriteit & deadline van bestaande taak
  const [editingTask, setEditingTask] = useState<AiQueueTask | null>(null);
  const [editAutoPrio, setEditAutoPrio] = useState(false);
  const [editPriority, setEditPriority] = useState(5);
  const [editDeadline, setEditDeadline] = useState('');
  const [expandedResultTask, setExpandedResultTask] = useState<AiQueueTask | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const loadOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/ai-queue/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setShortQueue(data.shortQueue);
      setAnalysis(data.offPeakAnalysis);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    const id = setInterval(loadOverview, 10000);
    return () => clearInterval(id);
  }, [token]);

  const handleRefreshAnalysis = async () => {
    if (!token) return;
    setRefreshingAnalysis(true);
    try {
      const res = await fetch('/api/ai-queue/analyze-refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.offPeakAnalysis) {
        setAnalysis(data.offPeakAnalysis);
        showToast('7×24 daluren-analyse herberekend op basis van recente schoolstatistieken.');
      }
    } catch {
      showToast('Kon analyse niet verversen');
    } finally {
      setRefreshingAnalysis(false);
    }
  };

  const handleTriagePreview = async () => {
    if (!newTitle.trim() && !newDescription.trim()) {
      showToast('Vul eerst een titel of korte omschrijving in.');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/ai-queue/tasks/triage-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          taskType: 'custom_ai',
          title: newTitle.trim() || newDescription.trim().slice(0, 60),
          description: newDescription.trim() || newTitle.trim(),
          userPriority: newAutoPrio ? null : newPriority,
          deadlineAt: newDeadline ? new Date(newDeadline).toISOString() : null,
          schedulePreference: newSchedPref
        })
      });
      const data = await res.json();
      if (res.ok && data.preview) setTriagePreview(data.preview);
    } catch {
      showToast('Kon geen AI-inschatting ophalen');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newDescription.trim()) {
      showToast('Vul eerst in wat de taak is.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai-queue/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          taskType: 'custom_ai',
          title: newTitle.trim() || newDescription.trim().slice(0, 60),
          description: newDescription.trim() || newTitle.trim(),
          userPriority: newAutoPrio ? null : newPriority,
          deadlineAt: newDeadline ? new Date(newDeadline).toISOString() : null,
          schedulePreference: newSchedPref
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inplannen mislukt');

      setShowNewForm(false);
      setNewTitle('');
      setNewDescription('');
      setNewDeadline('');
      setTriagePreview(null);
      showToast(`Taak ingepland (AI-prioriteit ${data.task.aiPriority}/10)!`);
      await loadOverview();
    } catch (err: any) {
      showToast(`Fout: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNow = async (taskId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/ai-queue/tasks/${taskId}/run-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Taak krijgt directe voorrang en start zodra het slot vrijkomt.');
        await loadOverview();
      }
    } catch {}
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/ai-queue/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {}
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !token) return;
    try {
      const res = await fetch(`/api/ai-queue/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userPriority: editAutoPrio ? null : editPriority,
          deadlineAt: editDeadline ? new Date(editDeadline).toISOString() : null
        })
      });
      if (res.ok) {
        setEditingTask(null);
        showToast('Prioriteit & deadline bijgewerkt en tijdslot herberekend!');
        await loadOverview();
      }
    } catch {}
  };

  const applyDeadlinePreset = (hoursFromNow: number | null, targetSetter: (v: string) => void) => {
    if (hoursFromNow === null) {
      targetSetter('');
      return;
    }
    const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    targetSetter(toDatetimeLocalValue(d));
  };

  const activeBgTasks = tasks.filter(t => ['running', 'queued', 'scheduled'].includes(t.status));
  const completedBgTasks = tasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem', color: 'rgba(255,255,255,0.65)' }}>
        <Loader2 size={34} className="spin" color="#7c5cfc" />
        <p style={{ marginTop: '1rem' }}>AI Wachtrij &amp; Daluren-analyse laden...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f8fafc', maxWidth: '1380px', margin: '0 auto', width: '100%' }}>
      {toast && (
        <div style={{
          padding: '0.85rem 1.2rem',
          borderRadius: '14px',
          background: toast.startsWith('Fout') ? 'rgba(239, 68, 68, 0.16)' : 'rgba(124, 92, 252, 0.2)',
          border: `1px solid ${toast.startsWith('Fout') ? 'rgba(239, 68, 68, 0.45)' : 'rgba(124, 92, 252, 0.45)'}`,
          color: toast.startsWith('Fout') ? '#fca5a5' : '#e9d5ff',
          fontSize: '0.88rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={15} /></button>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.14), rgba(6, 182, 212, 0.08))',
        border: '1px solid rgba(124, 92, 252, 0.3)',
        borderRadius: '22px',
        padding: '1.6rem 2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.6rem' }}>⏳</span>
            <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              AI Wachtrij &amp; Slimme Daluren-Planner
            </h2>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#67e8f9',
              border: '1px solid rgba(6, 182, 212, 0.35)'
            }}>
              {mode === 'admin' ? 'ORGANISATIE OVERZICHT' : 'MIJN AI-TAKEN & ANALYSE'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.68)', maxWidth: '720px' }}>
            Twee-laagse AI-wachtrij: de directe chat-rij behoudt altijd voorrang tijdens spitsuren, terwijl achtergrondtaken op basis van echte 7×24 gebruiksdata, AI-triage, prioriteit (1–10) en deadlines slim worden ingepland.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={loadOverview}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} />
            <span>Vernieuwen</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewForm(v => !v)}
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
              border: 'none',
              color: '#fff',
              borderRadius: '12px',
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 6px 20px rgba(124, 92, 252, 0.38)'
            }}
          >
            <Plus size={16} />
            <span>Nieuwe Taak Inplannen</span>
          </button>
        </div>
      </div>

      {/* Nieuwe taak formulier */}
      {showNewForm && (
        <form
          onSubmit={handleCreateTask}
          style={{
            background: 'linear-gradient(135deg, rgba(18, 24, 44, 0.96), rgba(11, 15, 29, 0.98))',
            border: '1px solid rgba(124, 92, 252, 0.45)',
            borderRadius: '20px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>✨ Nieuwe Achtergrondtaak Inplannen</h3>
            <button type="button" onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: '5px' }}>
                Titel / Onderwerp *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Bijv. Samenvatting & oefentoets H4 maken"
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: '10px 12px', color: '#fff', fontSize: '0.88rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: '5px' }}>
                Uitvoer-voorkeur
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setNewSchedPref('smart_offpeak')}
                  style={{
                    padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                    background: newSchedPref === 'smart_offpeak' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(0,0,0,0.3)',
                    border: newSchedPref === 'smart_offpeak' ? '1.5px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                    color: newSchedPref === 'smart_offpeak' ? '#e9d5ff' : 'rgba(255,255,255,0.65)'
                  }}
                >
                  🌙 Slim in daluren
                </button>
                <button
                  type="button"
                  onClick={() => setNewSchedPref('immediate')}
                  style={{
                    padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                    background: newSchedPref === 'immediate' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(0,0,0,0.3)',
                    border: newSchedPref === 'immediate' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    color: newSchedPref === 'immediate' ? '#bae6fd' : 'rgba(255,255,255,0.65)'
                  }}
                >
                  ⚡ Direct starten
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: '5px' }}>
              Wat is de taak? (AI gebruikt dit voor prioriteit &amp; duur-inschatting)
            </label>
            <textarea
              rows={3}
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Beschrijf wat de AI moet doen, voor welke klas/niveau, en eventuele details..."
              style={{
                width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: '10px 12px', color: '#fff', fontSize: '0.86rem', resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Prioriteit 1-10 of Auto */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={14} color="#c4b5fd" /> Prioriteit (1–10)
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#7dd3fc', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={newAutoPrio} onChange={e => setNewAutoPrio(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                  <span>Auto (AI bepaalt)</span>
                </label>
              </div>
              {!newAutoPrio ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNewPriority(n)}
                      style={{
                        padding: '6px 0', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                        background: newPriority === n ? (n >= 8 ? '#ef4444' : n >= 5 ? '#7c5cfc' : '#06b6d4') : 'rgba(0,0,0,0.35)',
                        border: newPriority === n ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        color: '#fff'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.58)' }}>
                  Snelle AI-triage kiest automatisch een passende prioriteit op basis van je taakomschrijving en deadline.
                </div>
              )}
            </div>

            {/* Deadline */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="#6ee7b7" /> Deadline (voor wanneer af?)
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { l: '2u', h: 2 },
                    { l: '12u', h: 12 },
                    { l: '24u', h: 24 },
                    { l: 'Geen', h: null }
                  ].map(p => (
                    <button
                      key={p.l}
                      type="button"
                      onClick={() => applyDeadlinePreset(p.h, setNewDeadline)}
                      style={{
                        background: 'rgba(255,255,255,0.07)', border: 'none', color: '#cbd5e1',
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', cursor: 'pointer'
                      }}
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '7px 10px', color: '#fff', fontSize: '0.82rem'
                }}
              />
            </div>
          </div>

          {/* Triage Preview resultaat */}
          {triagePreview && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ fontWeight: 800, color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>🤖 AI-Triage:</span>
                <span>AI-prioriteit {triagePreview.triage.aiPriority}/10</span>
                <span>·</span>
                <span>Geschatte duur: {formatDurationMin(triagePreview.triage.estimatedDurationSec)}</span>
                <span>·</span>
                <span>Starttijd: {new Date(triagePreview.plannedStartAt).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {triagePreview.mustEscalate && <span style={{ color: '#fca5a5' }}>· 🚨 Urgent geëscaleerd!</span>}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>{triagePreview.triage.reasoning} {triagePreview.windowReason}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleTriagePreview}
              disabled={previewLoading}
              style={{
                background: 'rgba(56, 189, 248, 0.14)', border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#7dd3fc', borderRadius: '10px', padding: '9px 15px', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              {previewLoading ? <Loader2 size={14} className="spin" /> : <Brain size={14} />}
              <span>AI-inschatting opvragen</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)', border: 'none', color: '#fff',
                borderRadius: '10px', padding: '9px 20px', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              {submitting ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>Inplannen in AI-Wachtrij</span>
            </button>
          </div>
        </form>
      )}

      {/* Twee-Wachtrijen Status Kaarten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {/* 1. Korte Directe Chat-wachtrij */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 24, 43, 0.88), rgba(10, 15, 28, 0.94))',
          border: `1px solid ${(shortQueue?.queuedCount || 0) > 0 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: '20px',
          padding: '1.35rem 1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Zap size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>1. Korte Directe Wachtrij (Chat)</h3>
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '999px',
              background: (shortQueue?.queuedCount || 0) > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.18)',
              color: (shortQueue?.queuedCount || 0) > 0 ? '#fde68a' : '#6ee7b7'
            }}>
              {(shortQueue?.queuedCount || 0) > 0 ? `${shortQueue.queuedCount} wachtend` : 'Direct beschikbaar'}
            </span>
          </div>
          <p style={{ margin: '0 0 0.9rem 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
            {shortQueue?.description || 'Directe chat-verzoeken behouden altijd voorrang op de GPU.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>
            <div>Actieve streams: <strong>{shortQueue?.activeStreams ?? 0}</strong></div>
            <div>Wachtenden nu: <strong>{shortQueue?.queuedCount ?? 0}</strong></div>
            <div>Piek-wacht events: <strong>{shortQueue?.totalQueuedEvents ?? 0}</strong></div>
          </div>
        </div>

        {/* 2. Lange Daluren-Wachtrij */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(22, 20, 48, 0.88), rgba(11, 15, 29, 0.94))',
          border: `1px solid ${analysis?.live?.isOffPeakNow ? 'rgba(139, 92, 246, 0.45)' : 'rgba(56, 189, 248, 0.3)'}`,
          borderRadius: '20px',
          padding: '1.35rem 1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Moon size={18} color="#c4b5fd" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>2. Lange Daluren-Wachtrij (Planner)</h3>
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '999px',
              background: analysis?.live?.isOffPeakNow ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',
              color: analysis?.live?.isOffPeakNow ? '#6ee7b7' : '#fde68a'
            }}>
              {analysis?.live?.isOffPeakNow ? '🌙 Daluur actief' : `⚡ ${analysis?.live?.state === 'druk' ? 'Piek / Druk' : 'Daguren'}`} · {Math.round((analysis?.live?.loadScore || 0) * 100)}% load
            </span>
          </div>
          <p style={{ margin: '0 0 0.9rem 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
            {analysis?.offPeakHoursSummary?.length
              ? `Gemeten daluren uit historie: ${analysis.offPeakHoursSummary.join(', ')}. Rustigste uur: ${analysis.quietestSlot.dayLabel} ${analysis.quietestSlot.label}.`
              : 'Analyseert schoolactiviteit voor optimale daluur-planning.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', flexWrap: 'wrap' }}>
            <div>Openstaand: <strong>{activeBgTasks.length}</strong></div>
            <div>Afgerond: <strong>{completedBgTasks.length}</strong></div>
            <div>Piek-slot: <strong>{analysis?.busiestSlot?.dayLabel} {analysis?.busiestSlot?.hour}:00</strong></div>
          </div>
        </div>
      </div>

      {/* Echte 7x24 Daluren Heatmap */}
      {analysis && (
        <div style={{
          background: 'rgba(13, 18, 34, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '1.35rem 1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} color="#38bdf8" />
                <span>Echte 7×24 Schoolbelasting &amp; Daluren-Analyse</span>
              </h3>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', marginTop: '3px' }}>
                Gebaseerd op {analysis.dataPointsUsed} historische prompts/taken ({analysis.lookbackDays} dagen · betrouwbaarheid: <strong>{analysis.analysisConfidence.replace('_', ' ')}</strong>)
                {analysis.peakHoursSummary.length > 0 && ` · Piekuren: ${analysis.peakHoursSummary.join(', ')}`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.68)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.5)' }} /> Daluur
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.45)' }} /> Normaal
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.6)' }} /> Piekuur
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshAnalysis}
                disabled={refreshingAnalysis}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#cbd5e1', borderRadius: '8px', padding: '5px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '5px'
                }}
              >
                <RefreshCw size={12} className={refreshingAnalysis ? 'spin' : ''} />
                <span>Herberekenen</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '680px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Uren header */}
              <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(24, 1fr)', gap: '3px', fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h}>{String(h).padStart(2, '0')}</div>
                ))}
              </div>
              {analysis.matrix.map((row, dIdx) => (
                <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '38px repeat(24, 1fr)', gap: '3px', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{row[0]?.dayLabel}</div>
                  {row.map(cell => {
                    const bg =
                      cell.classification === 'piek'
                        ? `rgba(239, 68, 68, ${0.32 + cell.historicalLoadScore * 0.5})`
                        : cell.classification === 'normaal'
                        ? `rgba(56, 189, 248, ${0.22 + cell.historicalLoadScore * 0.4})`
                        : `rgba(16, 185, 129, ${0.18 + (1 - cell.historicalLoadScore) * 0.32})`;
                    const now = new Date();
                    const isCurrentCell = ((now.getDay() + 6) % 7) === cell.dayOfWeek && now.getHours() === cell.hour;

                    return (
                      <div
                        key={cell.hour}
                        title={`${cell.dayLabel} ${String(cell.hour).padStart(2, '0')}:00 — ${cell.classification.toUpperCase()} (${Math.round(cell.historicalLoadScore * 100)}% belasting, gem. ${cell.avgPrompts} prompts/week)`}
                        style={{
                          height: '20px',
                          borderRadius: '4px',
                          background: bg,
                          border: isCurrentCell ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.04)'
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ingeplande & Lopende Taken */}
      <div style={{
        background: 'rgba(13, 18, 34, 0.88)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '1.35rem 1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color="#a78bfa" />
          <span>Ingeplande &amp; Lopende Taken ({activeBgTasks.length})</span>
        </h3>

        {activeBgTasks.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.86rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '14px' }}>
            Geen openstaande taken in de daluren-wachtrij. Plan een taak in of queue een les/toets vanuit Locra Live of SlimCheck.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeBgTasks.map(task => {
              const meta = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.custom_ai;
              return (
                <div
                  key={task.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${task.status === 'running' ? 'rgba(56, 189, 248, 0.45)' : task.escalatedToUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '14px',
                    padding: '1rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ background: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                        {meta.label}
                      </span>
                      <strong style={{ fontSize: '0.96rem', color: '#fff' }}>{task.title}</strong>
                      {task.escalatedToUrgent && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={11} /> Deadline-escalatie
                        </span>
                      )}
                      {task.status === 'running' && (
                        <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#7dd3fc', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={11} className="spin" /> Bezig · {task.progressPercent}%
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {task.status !== 'running' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(task);
                              setEditAutoPrio(task.userPriority === null);
                              setEditPriority(task.userPriority ?? task.aiPriority);
                              setEditDeadline(task.deadlineAt ? toDatetimeLocalValue(new Date(task.deadlineAt)) : '');
                            }}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: '8px', padding: '5px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Prio / Deadline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunNow(task.id)}
                            style={{ background: 'rgba(56, 189, 248, 0.16)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#7dd3fc', borderRadius: '8px', padding: '5px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Play size={11} /> Nu starten
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        title="Annuleren"
                        style={{ background: 'rgba(239, 68, 68, 0.12)', border: 'none', color: '#fca5a5', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'rgba(255,255,255,0.72)' }}>
                    <span>Jouw prio: <strong>{task.userPriority ? `${task.userPriority}/10` : 'Auto'}</strong></span>
                    <span>AI-prio: <strong style={{ color: '#c4b5fd' }}>{task.aiPriority}/10</strong></span>
                    <span>Geschatte duur: <strong>{formatDurationMin(task.aiEstimatedDurationSec)}</strong></span>
                    <span>Gepland start: <strong>{task.plannedStartAt ? new Date(task.plannedStartAt).toLocaleString('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Z.s.m.'}</strong></span>
                    {task.deadlineAt && (
                      <span style={{ color: '#fde68a' }}>
                        Deadline: <strong>{new Date(task.deadlineAt).toLocaleString('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                      </span>
                    )}
                  </div>

                  {task.aiReasoning && (
                    <div style={{ fontSize: '0.76rem', color: 'rgba(203, 213, 225, 0.78)', background: 'rgba(0,0,0,0.22)', padding: '6px 10px', borderRadius: '8px' }}>
                      🤖 {task.aiReasoning}
                    </div>
                  )}

                  {task.status === 'running' && (
                    <div style={{ fontSize: '0.76rem', color: '#7dd3fc' }}>
                      {task.progressMessage || 'Bezig met verwerking...'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historie / Afgerond */}
      {completedBgTasks.length > 0 && (
        <div style={{
          background: 'rgba(13, 18, 34, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '20px',
          padding: '1.25rem 1.5rem'
        }}>
          <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.94rem', fontWeight: 800, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <CheckCircle size={15} color="#34d399" />
            <span>Afgerond &amp; Historie ({completedBgTasks.length})</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {completedBgTasks.slice(0, 12).map(task => {
              const meta = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.custom_ai;
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem',
                    padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: meta.color, fontWeight: 700, fontSize: '0.72rem' }}>{meta.label}</span>
                    <strong style={{ color: '#f1f5f9' }}>{task.title}</strong>
                    <span style={{ color: task.status === 'completed' ? '#6ee7b7' : '#fca5a5', fontSize: '0.74rem' }}>
                      {task.status === 'completed' ? (task.resultSummary?.slice(0, 90) || 'Voltooid') : (task.errorMessage || task.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {task.resultSummary && task.resultSummary.length > 90 && (
                      <button
                        type="button"
                        onClick={() => setExpandedResultTask(task)}
                        style={{ background: 'rgba(124, 92, 252, 0.2)', border: 'none', color: '#ddd6fe', borderRadius: '6px', padding: '4px 9px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Bekijk resultaat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '3px' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Prioriteit / Deadline aanpassen */}
      {editingTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(124, 92, 252, 0.4)', borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Herplannen: {editingTask.title}</h3>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>Gebruikersprioriteit (1–10)</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#7dd3fc', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editAutoPrio} onChange={e => setEditAutoPrio(e.target.checked)} />
                  <span>Auto</span>
                </label>
              </label>
              {!editAutoPrio && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEditPriority(n)}
                      style={{
                        padding: '6px 0', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                        background: editPriority === n ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                        border: editPriority === n ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        color: '#fff'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Deadline</label>
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={e => setEditDeadline(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setEditingTask(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', borderRadius: '9px', padding: '8px 14px', cursor: 'pointer' }}>Annuleren</button>
              <button type="button" onClick={handleSaveEdit} style={{ background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)', border: 'none', color: '#fff', borderRadius: '9px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>Opslaan &amp; Herplannen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Volledig taakresultaat bekijken */}
      {expandedResultTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '20px', maxWidth: '720px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Resultaat: {expandedResultTask.title}</h3>
              <button type="button" onClick={() => setExpandedResultTask(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.6, color: '#e2e8f0', margin: 0 }}>
              {expandedResultTask.resultSummary}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
