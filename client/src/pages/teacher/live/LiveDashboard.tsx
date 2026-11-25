import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import {
  Sparkles, Plus, Play, Edit3, Trash2, BarChart2,
  Users, Clock, Layers, HelpCircle, MessageSquare,
  Cloud, CheckCircle, Search, RefreshCw, Loader2, Cpu, ArrowRight, Moon, X
} from 'lucide-react';
import LiveAiGeneratorModal from './LiveAiGeneratorModal';
import LiveAiProgressView, { type LiveGenerationJob } from './LiveAiProgressView';
import LiveLessonBuilder from './LiveLessonBuilder';
import LiveResultsModal from './LiveResultsModal';

export type SlideType = 'content' | 'multiple_choice' | 'true_false' | 'open' | 'wordcloud' | 'poll';

export interface LiveSlide {
  id: string;
  type: SlideType;
  rtti?: string;
  title: string;
  content?: string;
  imageUrl?: string;
  imageCaption?: string;
  videoUrl?: string;
  options?: string[];
  correctOptionIndex?: number;
  timeLimitSeconds?: number;
  points?: number;
  explanation?: string;
  clusterSummary?: string;
}

export interface LiveLessonItem {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  targetGrade?: string;
  modeDefault: string;
  slidesJson: string;
  createdAt: string;
  updatedAt: string;
  teacher?: {
    id: string;
    displayName: string;
  };
  _count?: {
    sessions: number;
  };
}

export default function LiveDashboard() {
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<LiveLessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Tabs & Modals & Sub-views
  const [activeTab, setActiveTab] = useState<'lessons' | 'ai-studio'>('lessons');
  const [aiJobs, setAiJobs] = useState<LiveGenerationJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [activeBuilderLesson, setActiveBuilderLesson] = useState<any | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [resultsSessionId, setResultsSessionId] = useState<string | null>(null);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  // Daluren-wachtrij voor lescontroles
  const [queuedReviews, setQueuedReviews] = useState<any[]>([]);
  const [offPeakStatus, setOffPeakStatus] = useState<{
    isOffPeak: boolean;
    trafficLevel: string;
    nextOffPeakAt: string;
    windowLabel: string;
  } | null>(null);
  const [queueToast, setQueueToast] = useState<string | null>(null);
  const [queueingLessonId, setQueueingLessonId] = useState<string | null>(null);

  const loadQueuedReviews = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/live/queued-reviews', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.reviews)) {
        setQueuedReviews(data.reviews);
      } else if (Array.isArray(data)) {
        setQueuedReviews(data);
      }
      if (data.offPeakStatus) setOffPeakStatus(data.offPeakStatus);
    } catch {}
  };

  const loadJobs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/live/generate-jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        setAiJobs(data.jobs);
        setSelectedJobId(prev => prev || data.jobs[0].jobId);
      }
    } catch {}
  };

  const loadLessons = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/live/lessons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.lessons) {
        setLessons(data.lessons);
      }
    } catch (err) {
      console.error('Kon lessen niet laden:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
    loadJobs();
    loadQueuedReviews();
  }, [token]);

  // Poll daluren-wachtrij elke 8s zolang er wachtende/lopende controles zijn
  const hasActiveQueuedReviews = queuedReviews.some(r => r.status === 'queued' || r.status === 'running');
  useEffect(() => {
    if (!token || !hasActiveQueuedReviews) return;
    const id = setInterval(() => {
      loadQueuedReviews();
      loadLessons();
    }, 8000);
    return () => clearInterval(id);
  }, [token, hasActiveQueuedReviews]);

  // Realtime polling voor actieve of in daluren ingeplande AI-generatietaak
  const runningJobId = aiJobs.find(j => j.status === 'running' || j.status === 'queued')?.jobId || null;

  useEffect(() => {
    if (!token || !runningJobId) return;

    let cancelled = false;
    let consecutiveFailures = 0;

    const pollOnce = async () => {
      try {
        const res = await fetch(`/api/live/generate-jobs/${runningJobId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 404) {
          if (!cancelled) {
            setAiJobs(prev =>
              prev.map(j =>
                j.jobId === runningJobId
                  ? {
                      ...j,
                      status: 'failed',
                      finishedAt: Date.now(),
                      error: 'De generatietaak is afgebroken omdat de server tussentijds is herstart. Klik op "Opnieuw Proberen".'
                    }
                  : j
              )
            );
          }
          return;
        }

        if (!res.ok) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 18 && !cancelled) {
            setAiJobs(prev =>
              prev.map(j =>
                j.jobId === runningJobId
                  ? {
                      ...j,
                      status: 'failed',
                      finishedAt: Date.now(),
                      error: `Server tijdelijk onbereikbaar (HTTP ${res.status}). Controleer of de backend draait en probeer opnieuw.`
                    }
                  : j
              )
            );
          }
          return;
        }

        consecutiveFailures = 0;
        const data = await res.json();
        if (!cancelled && data.job) {
          setAiJobs(prev => {
            const exists = prev.some(j => j.jobId === data.job.jobId);
            if (!exists) return [data.job, ...prev];
            return prev.map(j => (j.jobId === data.job.jobId ? data.job : j));
          });
        }
      } catch {
        consecutiveFailures += 1;
      }
    };

    const interval = setInterval(pollOnce, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, runningJobId]);

  // Start direct een live sessie op het digibord
  const handleStartLive = async (lessonId: string) => {
    setStartingSessionId(lessonId);
    try {
      const res = await fetch('/api/live/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lessonId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kon sessie niet starten');

      // Open het presentatorscherm op het digibord
      navigate(`/live/host/${data.session.id}`);
    } catch (err: any) {
      alert(err.message || 'Fout bij starten van livesessie');
    } finally {
      setStartingSessionId(null);
    }
  };

  // Verwijder een les
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Weet je zeker dat je "${title}" wilt verwijderen?`)) return;
    try {
      const res = await fetch(`/api/live/lessons/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLessons(prev => prev.filter(l => l.id !== id));
      }
    } catch (e) {
      alert('Fout bij verwijderen');
    }
  };

  // Zodra AI-taak gestart is: schakel direct door naar de AI Studio & Voortgang tab
  const handleJobStarted = (job: LiveGenerationJob) => {
    setAiJobs(prev => [job, ...prev.filter(j => j.jobId !== job.jobId)].slice(0, 10));
    setSelectedJobId(job.jobId);
    setActiveTab('ai-studio');
  };

  const handleOpenJobInBuilder = (job: LiveGenerationJob) => {
    if (!job.result) return;
    setActiveBuilderLesson({
      title: job.result.title || job.topic || 'Nieuwe AI-Les',
      subject: job.result.subject || job.subject || 'Algemeen',
      targetGrade: job.result.targetGrade || job.targetGrade || 'Voortgezet Onderwijs',
      modeDefault: job.mode || 'hybrid',
      slides: job.result.slides || [],
      generationMeta: job.result.metadata
    });
    setIsBuilding(true);
  };

  const handleCancelJob = async (jobId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/live/generate-jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setAiJobs(prev => prev.map(j => (j.jobId === jobId ? data.job : j)));
        }
      }
    } catch {}
  };

  const handleStartJobNow = async (jobId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/live/generate-jobs/${jobId}/start-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setAiJobs(prev => prev.map(j => (j.jobId === jobId ? data.job : j)));
        }
      }
    } catch {}
  };

  const showQueueToastMsg = (msg: string) => {
    setQueueToast(msg);
    setTimeout(() => setQueueToast(null), 5500);
  };

  const handleQueueLessonReview = async (lessonId: string, scheduleMode: 'offpeak' | 'night' | 'now' = 'offpeak') => {
    if (!token) return;
    setQueueingLessonId(lessonId);
    try {
      const res = await fetch(`/api/live/lessons/${lessonId}/queue-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ scheduleMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inplannen mislukt');
      showQueueToastMsg(`🌙 ${data.message}`);
      await loadQueuedReviews();
    } catch (err: any) {
      showQueueToastMsg(`Fout: ${err.message}`);
    } finally {
      setQueueingLessonId(null);
    }
  };

  const handleQueueGeneratedLesson = async (job: LiveGenerationJob): Promise<{ ok: boolean; message: string }> => {
    if (!token || !job.result) return { ok: false, message: 'Fout: geen resultaat om op te slaan.' };
    try {
      let targetLessonId = job.savedLessonId;
      if (!targetLessonId) {
        const saveRes = await fetch('/api/live/lessons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: job.result.title || job.topic,
            subject: job.result.subject || job.subject,
            targetGrade: job.result.targetGrade || job.targetGrade,
            modeDefault: job.mode || 'hybrid',
            slides: job.result.slides || []
          })
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok || !saveData?.lesson?.id) {
          throw new Error(saveData?.error || 'Kon les niet opslaan');
        }
        targetLessonId = saveData.lesson.id;
        setAiJobs(prev => prev.map(j => (j.jobId === job.jobId ? { ...j, savedLessonId: targetLessonId } : j)));
        await loadLessons();
      }

      const queueRes = await fetch(`/api/live/lessons/${targetLessonId}/queue-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ scheduleMode: 'offpeak' })
      });
      const queueData = await queueRes.json();
      if (!queueRes.ok) throw new Error(queueData?.error || 'Inplannen mislukt');
      await loadQueuedReviews();
      return { ok: true, message: queueData.message || 'Opgeslagen en ingepland in de daluren-wachtrij!' };
    } catch (err: any) {
      return { ok: false, message: `Fout: ${err.message}` };
    }
  };

  const handleRunQueuedReviewNow = async (reviewId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/live/queued-reviews/${reviewId}/run-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.message) showQueueToastMsg(`⚡ ${data.message}`);
      await loadQueuedReviews();
    } catch {}
  };

  const handleDeleteQueuedReview = async (reviewId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/live/queued-reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueuedReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch {}
  };

  const currentAiJob = aiJobs.find(j => j.jobId === selectedJobId) || aiJobs[0] || null;
  const activeRunningJob = aiJobs.find(j => j.status === 'running') || null;
  const activeQueuedJob = aiJobs.find(j => j.status === 'queued') || null;
  const latestCompletedJob = aiJobs.find(j => j.status === 'completed') || null;

  if (isBuilding) {
    return (
      <LiveLessonBuilder
        initialLesson={activeBuilderLesson}
        onBack={() => {
          setIsBuilding(false);
          setActiveBuilderLesson(null);
          loadLessons();
        }}
        onSaved={() => {
          loadLessons();
        }}
        onStartSession={(id) => {
          handleStartLive(id);
        }}
      />
    );
  }

  const filteredLessons = lessons.filter(l => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      (l.subject && l.subject.toLowerCase().includes(term)) ||
      (l.targetGrade && l.targetGrade.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem',
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(6, 182, 212, 0.08))',
        border: '1px solid rgba(124, 92, 252, 0.25)',
        borderRadius: '24px',
        padding: '2rem 2.5rem',
        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.4)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.8rem' }}>🎯</span>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', background: 'linear-gradient(135deg, #fff, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Locra Live
            </h1>
            <span style={{ background: 'rgba(124, 92, 252, 0.25)', color: '#c4b5fd', border: '1px solid rgba(124, 92, 252, 0.4)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              INTERACTIEVE LESSEN & ARENA QUIZZEN
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '640px', lineHeight: 1.5 }}>
            Geef interactieve lessen op het digibord of start een gamified quiz. Genereer lespresentaties direct vanuit je lesboeken, PDF-readers of leerdoelen met Locra AI.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => {
              setActiveBuilderLesson(null);
              setIsBuilding(true);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              padding: '12px 20px',
              color: '#fff',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={18} />
            <span>Handmatig Maken</span>
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
              border: 'none',
              borderRadius: '14px',
              padding: '12px 24px',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 6px 25px rgba(124, 92, 252, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            <Sparkles size={18} />
            <span>AI Les & Quiz Genereren</span>
          </button>
        </div>
      </div>

      {/* Locra Live Navigatie-Tabs (Mijn Lessen vs AI Studio & Voortgang) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '0.85rem',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('lessons')}
          style={{
            background: activeTab === 'lessons' ? 'rgba(124, 92, 252, 0.22)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${activeTab === 'lessons' ? 'rgba(124, 92, 252, 0.55)' : 'rgba(255, 255, 255, 0.09)'}`,
            borderRadius: '12px',
            padding: '10px 18px',
            color: activeTab === 'lessons' ? '#e9d5ff' : 'rgba(255,255,255,0.7)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Layers size={16} />
          <span>Mijn Lessen ({lessons.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai-studio')}
          style={{
            background: activeTab === 'ai-studio'
              ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.28), rgba(6, 182, 212, 0.22))'
              : activeRunningJob
              ? 'rgba(56, 189, 248, 0.14)'
              : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${
              activeTab === 'ai-studio'
                ? 'rgba(56, 189, 248, 0.6)'
                : activeRunningJob
                ? 'rgba(56, 189, 248, 0.45)'
                : 'rgba(255, 255, 255, 0.09)'
            }`,
            borderRadius: '12px',
            padding: '10px 18px',
            color: activeTab === 'ai-studio' || activeRunningJob ? '#fff' : 'rgba(255,255,255,0.7)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          {activeRunningJob ? (
            <Loader2 size={16} className="spin" color="#38bdf8" />
          ) : (
            <Cpu size={16} color={activeTab === 'ai-studio' ? '#67e8f9' : undefined} />
          )}
          <span>AI Studio &amp; Voortgang</span>

          {activeRunningJob && (
            <span style={{
              background: 'rgba(56, 189, 248, 0.25)',
              color: '#67e8f9',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Bezig · {activeRunningJob.progressPercent}%
            </span>
          )}
          {!activeRunningJob && activeQueuedJob && (
            <span style={{
              background: 'rgba(139, 92, 246, 0.25)',
              color: '#ddd6fe',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              🌙 Wachtrij
            </span>
          )}
          {!activeRunningJob && !activeQueuedJob && latestCompletedJob && (
            <span style={{
              background: 'rgba(16, 185, 129, 0.22)',
              color: '#6ee7b7',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Klaar
            </span>
          )}
        </button>
      </div>

      {/* Live Voortgangsbanner als docent terugklikt naar Mijn Lessen terwijl AI bezig, in wachtrij of klaar is */}
      {activeTab === 'lessons' && (activeRunningJob || activeQueuedJob || latestCompletedJob) && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.95rem 1.3rem',
          borderRadius: '16px',
          background: activeRunningJob
            ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.16), rgba(6, 182, 212, 0.12))'
            : activeQueuedJob
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(139, 92, 246, 0.1))'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(6, 182, 212, 0.1))',
          border: `1px solid ${
            activeRunningJob
              ? 'rgba(56, 189, 248, 0.45)'
              : activeQueuedJob
              ? 'rgba(139, 92, 246, 0.45)'
              : 'rgba(16, 185, 129, 0.45)'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeRunningJob ? (
              <Loader2 size={18} className="spin" color="#38bdf8" />
            ) : activeQueuedJob ? (
              <Moon size={18} color="#c4b5fd" />
            ) : (
              <CheckCircle size={18} color="#34d399" />
            )}
            <div style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>
              {activeRunningJob ? (
                <>
                  <strong>Locra AI bouwt "{activeRunningJob.topic}"</strong> ({activeRunningJob.progressPercent}%) —{' '}
                  <span style={{ color: 'rgba(255,255,255,0.72)' }}>
                    {activeRunningJob.steps.find(s => s.status === 'active')?.detail || 'Bezig...'}
                  </span>
                </>
              ) : activeQueuedJob ? (
                <>
                  <strong>In daluren-wachtrij: "{activeQueuedJob.topic}"</strong> —{' '}
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                    Wordt automatisch gegenereerd en nagekeken in minder drukke uren
                  </span>
                </>
              ) : latestCompletedJob ? (
                <>
                  <strong>AI-les klaar: "{latestCompletedJob.topic}"</strong> —{' '}
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {latestCompletedJob.result?.slides?.length || latestCompletedJob.previewSlides.length} dia's opgebouwd
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedJobId((activeRunningJob || activeQueuedJob || latestCompletedJob)!.jobId);
                setActiveTab('ai-studio');
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                borderRadius: '10px',
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{activeRunningJob ? 'Bekijk Live Voortgang' : activeQueuedJob ? 'Bekijk Wachtrij' : 'Bekijk Overzicht'}</span>
              <ArrowRight size={14} />
            </button>
            {!activeRunningJob && !activeQueuedJob && latestCompletedJob?.result && (
              <button
                type="button"
                onClick={() => handleOpenJobInBuilder(latestCompletedJob)}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Open in Lesbouwer
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai-studio' ? (
        <LiveAiProgressView
          activeJob={currentAiJob}
          recentJobs={aiJobs}
          onSelectJob={(jobId) => setSelectedJobId(jobId)}
          onCancelJob={handleCancelJob}
          onStartJobNow={handleStartJobNow}
          onOpenInBuilder={handleOpenJobInBuilder}
          onOpenGeneratorModal={() => setIsAiModalOpen(true)}
          onBackToLessons={() => setActiveTab('lessons')}
          onQueueGeneratedLesson={handleQueueGeneratedLesson}
        />
      ) : (
        <>
      {queueToast && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1.2rem',
          borderRadius: '14px',
          background: queueToast.startsWith('Fout') ? 'rgba(239, 68, 68, 0.16)' : 'rgba(139, 92, 246, 0.18)',
          border: `1px solid ${queueToast.startsWith('Fout') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(139, 92, 246, 0.45)'}`,
          color: queueToast.startsWith('Fout') ? '#fca5a5' : '#e9d5ff',
          fontSize: '0.86rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <span>{queueToast}</span>
          <button
            type="button"
            onClick={() => setQueueToast(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Daluren-Wachtrij Overzicht (indien er lessen zijn ingepland / nagekeken) */}
      {queuedReviews.length > 0 && (
        <div style={{
          marginBottom: '1.75rem',
          background: 'linear-gradient(135deg, rgba(15, 20, 40, 0.85), rgba(20, 16, 42, 0.85))',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '18px',
          padding: '1.1rem 1.35rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Moon size={17} color="#c4b5fd" />
              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#e9d5ff' }}>
                Daluren-wachtrij: Automatische Kwaliteitscontrole ({queuedReviews.length})
              </span>
              {offPeakStatus && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: offPeakStatus.isOffPeak ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.16)',
                  color: offPeakStatus.isOffPeak ? '#6ee7b7' : '#fde68a',
                  border: `1px solid ${offPeakStatus.isOffPeak ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  {offPeakStatus.isOffPeak ? 'Daluren actief' : 'Piekuren'} · Server: {offPeakStatus.trafficLevel}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)' }}>
              {offPeakStatus?.windowLabel || 'Dagelijks 22:00–07:00 & weekend 24/7'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {queuedReviews.slice(0, 6).map(rev => (
              <div
                key={rev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '0.6rem 0.9rem',
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  {rev.status === 'running' ? (
                    <Loader2 size={14} className="spin" color="#38bdf8" />
                  ) : rev.status === 'completed' ? (
                    <span>✨</span>
                  ) : rev.status === 'failed' ? (
                    <span>⚠️</span>
                  ) : (
                    <span>⏳</span>
                  )}
                  <strong style={{ color: '#f8fafc' }}>{rev.lessonTitle}</strong>
                  {typeof rev.aiPriority === 'number' && (
                    <span style={{ background: 'rgba(124, 92, 252, 0.2)', color: '#ddd6fe', padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                      AI-prio {rev.aiPriority}/10
                    </span>
                  )}
                  {rev.escalatedToUrgent && (
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                      🚨 Deadline-escalatie
                    </span>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                    {rev.status === 'queued' && `Gepland voor ${new Date(rev.scheduledAfter).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    {rev.status === 'running' && 'Bezig met Cito/RTTI kwaliteitscontrole...'}
                    {rev.status === 'completed' && `Afgerond: ${rev.improvementCount} vragen aangescherpt${rev.imagesAddedCount > 0 ? ` · ${rev.imagesAddedCount} foto's toegevoegd` : ''}`}
                    {rev.status === 'failed' && (rev.error || 'Mislukt')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {rev.status === 'queued' && (
                    <button
                      type="button"
                      onClick={() => handleRunQueuedReviewNow(rev.id)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.16)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#7dd3fc',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ▶ Nu nakijken
                    </button>
                  )}
                  {rev.status !== 'running' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteQueuedReview(rev.id)}
                      title="Uit wachtrij verwijderen"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: 'rgba(255,255,255,0.55)',
                        borderRadius: '8px',
                        padding: '4px 7px',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Zoekbalk & Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek les op titel of vak..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(10, 14, 26, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '10px 14px 10px 38px',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </div>

        <button
          onClick={loadLessons}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Vernieuwen</span>
        </button>
      </div>

      {/* Lessen Grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0' }}>
          <Loader2 size={36} className="spin" color="#7c5cfc" />
          <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Lessen laden...</p>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '4rem 2rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💡</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
            {search ? 'Geen lessen gevonden die voldoen aan je zoekterm' : 'Nog geen interactieve lessen aangemaakt'}
          </h3>
          <p style={{ margin: '0 auto 1.5rem auto', maxWidth: '480px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
            {search
              ? 'Probeer een andere zoekterm of wis het filter.'
              : 'Laat Locra AI binnen 30 seconden een interactieve presentatie en quiz genereren op basis van jouw lesmateriaal.'}
          </p>
          <button
            onClick={() => setIsAiModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={16} />
            <span>Genereer je eerste les</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {filteredLessons.map(lesson => {
            let parsedSlides: LiveSlide[] = [];
            try {
              parsedSlides = JSON.parse(lesson.slidesJson || '[]');
            } catch (_) {}

            const numTheory = parsedSlides.filter(s => s.type === 'content').length;
            const numMC = parsedSlides.filter(s => s.type === 'multiple_choice').length;
            const numOpen = parsedSlides.filter(s => s.type === 'open').length;
            const numWordcloud = parsedSlides.filter(s => s.type === 'wordcloud').length;
            const lessonQueueInfo = queuedReviews.find(r => r.lessonId === lesson.id);

            return (
              <div
                key={lesson.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.7), rgba(12, 17, 33, 0.85))',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '20px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'rgba(124, 92, 252, 0.15)',
                      border: '1px solid rgba(124, 92, 252, 0.3)',
                      color: '#c4b5fd',
                      borderRadius: '8px',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600
                    }}>
                      {lesson.subject || 'Algemeen'}
                    </span>
                    {lesson.targetGrade && (
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255,255,255,0.7)',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 500
                      }}>
                        {lesson.targetGrade}
                      </span>
                    )}
                    <span style={{
                      background: lesson.modeDefault === 'arcade' ? 'rgba(239, 68, 68, 0.15)' : lesson.modeDefault === 'formative' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                      color: lesson.modeDefault === 'arcade' ? '#fca5a5' : lesson.modeDefault === 'formative' ? '#a7f3d0' : '#a5f3fc',
                      borderRadius: '8px',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600
                    }}>
                      {lesson.modeDefault === 'arcade' ? '🎮 Locra Arena' : lesson.modeDefault === 'formative' ? '📖 Locra Presentor' : '⚡ Locra Hybride'}
                    </span>
                    {lessonQueueInfo && (
                      <span style={{
                        background: lessonQueueInfo.status === 'completed'
                          ? 'rgba(16, 185, 129, 0.16)'
                          : lessonQueueInfo.status === 'running'
                          ? 'rgba(56, 189, 248, 0.18)'
                          : 'rgba(139, 92, 246, 0.2)',
                        border: `1px solid ${
                          lessonQueueInfo.status === 'completed'
                            ? 'rgba(16, 185, 129, 0.35)'
                            : lessonQueueInfo.status === 'running'
                            ? 'rgba(56, 189, 248, 0.4)'
                            : 'rgba(139, 92, 246, 0.4)'
                        }`,
                        color: lessonQueueInfo.status === 'completed'
                          ? '#6ee7b7'
                          : lessonQueueInfo.status === 'running'
                          ? '#7dd3fc'
                          : '#ddd6fe',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}>
                        {lessonQueueInfo.status === 'queued' && '🌙 In wachtrij'}
                        {lessonQueueInfo.status === 'running' && '⚙️ Nakijken...'}
                        {lessonQueueInfo.status === 'completed' && `✨ Nagekeken (${lessonQueueInfo.improvementCount})`}
                        {lessonQueueInfo.status === 'failed' && '⚠️ Controle mislukt'}
                      </span>
                    )}
                  </div>

                  {/* Title & Stats */}
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                    {lesson.title}
                  </h3>

                  {/* Slide composition chips */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                      {parsedSlides.length} dia's:
                    </span>
                    {numTheory > 0 && <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>{numTheory} theorie</span>}
                    {numMC > 0 && <span style={{ fontSize: '0.72rem', color: '#fca5a5' }}>{numMC} quizvragen</span>}
                    {numOpen > 0 && <span style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>{numOpen} open</span>}
                    {numWordcloud > 0 && <span style={{ fontSize: '0.72rem', color: '#d8b4fe' }}>{numWordcloud} woordwolk</span>}
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setActiveBuilderLesson({
                          id: lesson.id,
                          title: lesson.title,
                          subject: lesson.subject || 'Algemeen',
                          targetGrade: lesson.targetGrade || '3 HAVO',
                          modeDefault: lesson.modeDefault,
                          slides: parsedSlides
                        });
                        setIsBuilding(true);
                      }}
                      title="Bewerken"
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.75)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <Edit3 size={14} />
                      <span>Bewerk</span>
                    </button>

                    <button
                      onClick={() => handleQueueLessonReview(lesson.id, 'offpeak')}
                      disabled={queueingLessonId === lesson.id || lessonQueueInfo?.status === 'queued' || lessonQueueInfo?.status === 'running'}
                      title="Zet les in daluren-wachtrij om automatisch na te laten kijken in minder drukke uren"
                      style={{
                        background: lessonQueueInfo?.status === 'queued' || lessonQueueInfo?.status === 'running'
                          ? 'rgba(139, 92, 246, 0.22)'
                          : 'rgba(139, 92, 246, 0.12)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        color: '#ddd6fe',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        cursor: queueingLessonId === lesson.id || lessonQueueInfo?.status === 'queued' || lessonQueueInfo?.status === 'running' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      {queueingLessonId === lesson.id ? (
                        <Loader2 size={13} className="spin" />
                      ) : (
                        <Moon size={13} />
                      )}
                      <span>{lessonQueueInfo?.status === 'queued' ? 'In rij' : 'Queue'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(lesson.id, lesson.title)}
                      title="Verwijderen"
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: 'none',
                        color: '#f87171',
                        padding: '8px',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => handleStartLive(lesson.id)}
                    disabled={startingSessionId === lesson.id}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    {startingSessionId === lesson.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Play size={14} fill="#fff" />
                    )}
                    <span>Start Digibord</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* AI Generator Modal */}
      <LiveAiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onJobStarted={handleJobStarted}
      />

      {/* Results Modal */}
      {resultsSessionId && (
        <LiveResultsModal
          sessionId={resultsSessionId}
          onClose={() => setResultsSessionId(null)}
        />
      )}
    </div>
  );
}
