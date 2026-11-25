import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Loader2, Check, AlertCircle, XCircle, ArrowRight,
  Cpu, Database, FileText, Image as ImageIcon, Layers, Clock, RefreshCw, Moon, Play
} from 'lucide-react';
import type { SlideType } from './LiveDashboard';

export type JobStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export interface LiveGenerationStep {
  key: 'sources' | 'draft' | 'critic' | 'images' | 'finalize';
  icon: string;
  label: string;
  detail: string;
  status: JobStepStatus;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface LiveGenerationLog {
  id: string;
  ts: number;
  icon: string;
  message: string;
}

export interface LiveGenerationPreviewSlide {
  id: string;
  type: SlideType;
  rtti?: string;
  title: string;
  imageUrl?: string;
}

export interface LiveGenerationJob {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduleMode?: 'immediate' | 'offpeak';
  scheduledFor?: number;
  savedLessonId?: string;
  topic: string;
  subject: string;
  targetGrade: string;
  mode: string;
  questionQualityMode: string;
  progressPercent: number;
  activeStepKey: string;
  steps: LiveGenerationStep[];
  logs: LiveGenerationLog[];
  stats: {
    sourcesUsed: string[];
    sourceCharCount: number;
    ragPassagesCount: number;
    modelUsed?: string;
    provider?: string;
    qualityUpgraded?: boolean;
    generatedChars: number;
    slidesDrafted: number;
    imagesFound: number;
    imagesTotal: number;
  };
  previewSlides: LiveGenerationPreviewSlide[];
  result?: {
    title: string;
    topic: string;
    subject: string;
    targetGrade: string;
    slides: any[];
    metadata?: any;
  };
  error?: string;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
}

interface LiveAiProgressViewProps {
  activeJob: LiveGenerationJob | null;
  recentJobs: LiveGenerationJob[];
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onStartJobNow?: (jobId: string) => void;
  onOpenInBuilder: (job: LiveGenerationJob) => void;
  onOpenGeneratorModal: () => void;
  onBackToLessons: () => void;
  onQueueGeneratedLesson?: (job: LiveGenerationJob) => Promise<{ ok: boolean; message: string }>;
}

const SLIDE_TYPE_BADGE: Record<SlideType, { label: string; color: string; bg: string }> = {
  content: { label: '📖 Theorie', color: '#93c5fd', bg: 'rgba(59, 130, 246, 0.16)' },
  multiple_choice: { label: '✅ Meerkeuze', color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.16)' },
  true_false: { label: '⚖️ Waar/Niet Waar', color: '#fde68a', bg: 'rgba(245, 158, 11, 0.16)' },
  open: { label: '📝 Open Vraag', color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.16)' },
  wordcloud: { label: '☁️ Gedachtenwolk', color: '#d8b4fe', bg: 'rgba(168, 85, 247, 0.16)' },
  poll: { label: '📊 Peiling', color: '#67e8f9', bg: 'rgba(6, 182, 212, 0.16)' }
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDurationBadge(ms?: number): string | null {
  if (typeof ms !== 'number' || ms <= 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function LiveAiProgressView({
  activeJob,
  recentJobs,
  onSelectJob,
  onCancelJob,
  onStartJobNow,
  onOpenInBuilder,
  onOpenGeneratorModal,
  onBackToLessons,
  onQueueGeneratedLesson
}: LiveAiProgressViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQueuedMessage(null);
  }, [activeJob?.jobId]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'queued')) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [activeJob?.jobId, activeJob?.status]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeJob?.logs?.length]);

  if (!activeJob) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.85), rgba(11, 16, 32, 0.92))',
        border: '1px solid rgba(124, 92, 252, 0.25)',
        borderRadius: '24px',
        padding: '4rem 2rem',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          margin: '0 auto 1.25rem auto',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.25), rgba(6, 182, 212, 0.2))',
          border: '1px solid rgba(124, 92, 252, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Sparkles size={32} color="#c4b5fd" />
        </div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.45rem', fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
          Locra AI Les-Atelier
        </h2>
        <p style={{ margin: '0 auto 1.8rem auto', maxWidth: '520px', color: 'rgba(255,255,255,0.68)', fontSize: '0.94rem', lineHeight: 1.55 }}>
          Er loopt op dit moment geen actieve AI-generatie. Start een nieuwe generatie om hier stap voor stap live mee te kijken hoe de AI bronnen analyseert, toetsvragen schrijft en controleert.
        </p>
        <div style={{ display: 'flex', gap: '0.9rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpenGeneratorModal}
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
              border: 'none',
              borderRadius: '14px',
              padding: '12px 24px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 25px rgba(124, 92, 252, 0.4)'
            }}
          >
            <Sparkles size={18} />
            <span>Nieuwe AI-Les & Quiz Genereren</span>
          </button>
          <button
            type="button"
            onClick={onBackToLessons}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '14px',
              padding: '12px 20px',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            ← Terug naar Mijn Lessen
          </button>
        </div>
      </div>
    );
  }

  const isQueued = activeJob.status === 'queued';
  const isRunning = activeJob.status === 'running';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed' || activeJob.status === 'cancelled';

  const elapsedMs = isRunning || isQueued
    ? nowMs - activeJob.startedAt
    : (activeJob.finishedAt || activeJob.updatedAt) - activeJob.startedAt;

  const activeStep = activeJob.steps.find(s => s.status === 'active') || activeJob.steps[activeJob.steps.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Recente taken switcher als er meerdere taken in sessie zijn */}
      {recentJobs.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            Recente generaties:
          </span>
          {recentJobs.map(j => {
            const selected = j.jobId === activeJob.jobId;
            return (
              <button
                key={j.jobId}
                type="button"
                onClick={() => onSelectJob(j.jobId)}
                style={{
                  background: selected ? 'rgba(124, 92, 252, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${selected ? 'rgba(124, 92, 252, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '999px',
                  padding: '5px 12px',
                  color: selected ? '#e0e7ff' : 'rgba(255,255,255,0.7)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {j.status === 'running' && <Loader2 size={12} className="spin" color="#38bdf8" />}
                {j.status === 'queued' && <span>🌙</span>}
                {j.status === 'completed' && <span>✅</span>}
                {(j.status === 'failed' || j.status === 'cancelled') && <span>⚠️</span>}
                <span>{j.topic.slice(0, 28)}{j.topic.length > 28 ? '…' : ''}</span>
                <span style={{ opacity: 0.6 }}>{j.status === 'queued' ? '· wachtrij' : `· ${j.progressPercent}%`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bovenste Status Hero Banner */}
      <div style={{
        background: isCompleted
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(6, 182, 212, 0.1))'
          : isFailed
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(30, 20, 40, 0.85))'
          : 'linear-gradient(135deg, rgba(124, 92, 252, 0.18), rgba(6, 182, 212, 0.1))',
        border: `1px solid ${
          isCompleted ? 'rgba(16, 185, 129, 0.45)' : isFailed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(124, 92, 252, 0.4)'
        }`,
        borderRadius: '24px',
        padding: '1.75rem 2rem',
        boxShadow: '0 14px 45px rgba(0,0,0,0.38)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Geanimeerde Engine Orb */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: isCompleted
                ? 'rgba(16, 185, 129, 0.2)'
                : isFailed
                ? 'rgba(239, 68, 68, 0.2)'
                : 'radial-gradient(circle, rgba(124, 92, 252, 0.35), rgba(6, 182, 212, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0
            }}>
              {isRunning && (
                <>
                  <div
                    className="spin"
                    style={{
                      position: 'absolute',
                      inset: '-3px',
                      borderRadius: '50%',
                      border: '2.5px solid transparent',
                      borderTopColor: '#7c5cfc',
                      borderRightColor: '#06b6d4'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-9px',
                      borderRadius: '50%',
                      border: '2px solid transparent',
                      borderBottomColor: 'rgba(168, 85, 247, 0.45)',
                      borderLeftColor: 'rgba(56, 189, 248, 0.3)',
                      animation: 'locraSpin 2.6s linear infinite reverse'
                    }}
                  />
                </>
              )}
              <span style={{ fontSize: '2.1rem' }}>
                {isCompleted ? '🎉' : isFailed ? '🛑' : isQueued ? '🌙' : (activeStep?.icon || '🧠')}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
                  {isCompleted
                    ? `Les klaar: "${activeJob.topic}"`
                    : isFailed
                    ? `Generatie gestopt: "${activeJob.topic}"`
                    : isQueued
                    ? `In daluren-wachtrij: "${activeJob.topic}"`
                    : `AI werkt live aan: "${activeJob.topic}"`}
                </h2>
                <span style={{
                  background: isCompleted
                    ? 'rgba(16, 185, 129, 0.22)'
                    : isFailed
                    ? 'rgba(239, 68, 68, 0.22)'
                    : isQueued
                    ? 'rgba(139, 92, 246, 0.25)'
                    : 'rgba(56, 189, 248, 0.2)',
                  color: isCompleted ? '#6ee7b7' : isFailed ? '#fca5a5' : isQueued ? '#ddd6fe' : '#67e8f9',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  {isRunning && <Loader2 size={12} className="spin" />}
                  {isQueued && <Moon size={12} />}
                  {isCompleted
                    ? '100% Voltooid'
                    : isFailed
                    ? (activeJob.status === 'cancelled' ? 'Geannuleerd' : 'Mislukt')
                    : isQueued
                    ? 'Wacht op daluren'
                    : `${activeJob.progressPercent}%`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.84rem', color: 'rgba(255,255,255,0.72)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={14} color="#a5b4fc" />
                  <strong>{formatElapsed(elapsedMs)}</strong> verstreken
                </span>
                <span>·</span>
                <span>{activeJob.subject} ({activeJob.targetGrade})</span>
                {activeJob.stats.modelUsed && (
                  <>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#c4b5fd', fontWeight: 600 }}>
                      <Cpu size={14} />
                      {activeJob.stats.modelUsed}
                    </span>
                  </>
                )}
                {activeJob.stats.generatedChars > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ color: '#67e8f9', fontWeight: 600 }}>
                      {activeJob.stats.generatedChars.toLocaleString('nl-NL')} AI-tekens
                    </span>
                  </>
                )}
                {activeJob.stats.ragPassagesCount > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#6ee7b7', fontWeight: 600 }}>
                      <Database size={14} />
                      {activeJob.stats.ragPassagesCount} bronpassages ({activeJob.stats.sourceCharCount.toLocaleString('nl-NL')} tekens)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actieknoppen rechts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isQueued && (
              <>
                {onStartJobNow && (
                  <button
                    type="button"
                    onClick={() => onStartJobNow(activeJob.jobId)}
                    style={{
                      background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '12px',
                      padding: '10px 18px',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Play size={14} fill="#fff" />
                    <span>Nu direct starten</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onCancelJob(activeJob.jobId)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <XCircle size={15} />
                  <span>Annuleren</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToLessons}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Terug naar Mijn Lessen
                </button>
              </>
            )}

            {isRunning && (
              <>
                <button
                  type="button"
                  onClick={() => onCancelJob(activeJob.jobId)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <XCircle size={15} />
                  <span>Annuleren</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToLessons}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Bekijk Mijn Lessen (loopt door)
                </button>
              </>
            )}

            {isCompleted && (
              <>
                <button
                  type="button"
                  onClick={onOpenGeneratorModal}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={15} />
                  <span>Nieuwe AI-Les</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInBuilder(activeJob)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '14px',
                    padding: '12px 22px',
                    fontSize: '0.96rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 26px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <Sparkles size={18} />
                  <span>Open Les in Lesbouwer</span>
                  <ArrowRight size={17} />
                </button>
                {onQueueGeneratedLesson && activeJob.result && (
                  <>
                    <button
                      type="button"
                      disabled={queueBusy}
                      onClick={async () => {
                        setQueueBusy(true);
                        try {
                          const res = await onQueueGeneratedLesson(activeJob);
                          setQueuedMessage(res.message);
                        } finally {
                          setQueueBusy(false);
                        }
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2))',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        color: '#ddd6fe',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: queueBusy ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px'
                      }}
                      title="Sla deze les op en zet hem in de daluren-wachtrij (22:00–07:00 / weekend) voor extra kwaliteitscontrole."
                    >
                      {queueBusy ? <Loader2 size={15} className="spin" /> : <Moon size={15} />}
                      <span>Opslaan &amp; in daluren laten nakijken</span>
                    </button>
                    {queuedMessage && (
                      <div style={{
                        background: queuedMessage.startsWith('Fout') ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                        border: `1px solid ${queuedMessage.startsWith('Fout') ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: queuedMessage.startsWith('Fout') ? '#fca5a5' : '#6ee7b7',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Check size={14} />
                        <span>{queuedMessage}</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {isFailed && (
              <button
                type="button"
                onClick={onOpenGeneratorModal}
                style={{
                  background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px'
                }}
              >
                <RefreshCw size={16} />
                <span>Opnieuw Proberen / Instellingen</span>
              </button>
            )}
          </div>
        </div>

        {/* Realtime Voortgangsbalk */}
        <div style={{
          marginTop: '1.4rem',
          height: '10px',
          background: 'rgba(10, 14, 26, 0.65)',
          borderRadius: '999px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{
            height: '100%',
            width: `${activeJob.progressPercent}%`,
            borderRadius: '999px',
            background: isCompleted
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : isFailed
              ? '#ef4444'
              : 'linear-gradient(90deg, #7c5cfc, #06b6d4, #34d399)',
            transition: 'width 0.5s ease-out',
            boxShadow: isRunning ? '0 0 14px rgba(6, 182, 212, 0.65)' : 'none'
          }} />
        </div>

        {activeJob.error && (
          <div style={{
            marginTop: '1rem',
            background: 'rgba(239, 68, 68, 0.16)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            color: '#fecaca',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={17} />
            <span>{activeJob.error}</span>
          </div>
        )}
      </div>

      {/* 2-Koloms Studio Layout: Links Pipeline + Logs, Rechts Live Slide Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Linkerkolom: Echte Stappen & Live Logboek */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Pipeline Stappen */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(18, 24, 43, 0.85), rgba(11, 16, 30, 0.92))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '1.35rem 1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.96rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span>
              <span>Live AI-Pijplijn (Realtime van Server)</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {activeJob.steps.map((step, idx) => {
                const stepActive = step.status === 'active';
                const stepDone = step.status === 'done';
                const stepSkipped = step.status === 'skipped';
                const stepError = step.status === 'error';

                const liveStepMs = stepActive && step.startedAt
                  ? nowMs - step.startedAt
                  : step.durationMs;
                const durationBadge = formatDurationBadge(liveStepMs);

                return (
                  <div
                    key={step.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '11px 14px',
                      borderRadius: '14px',
                      background: stepActive
                        ? 'rgba(124, 92, 252, 0.14)'
                        : stepDone
                        ? 'rgba(16, 185, 129, 0.06)'
                        : stepError
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${
                        stepActive
                          ? 'rgba(124, 92, 252, 0.45)'
                          : stepDone
                          ? 'rgba(16, 185, 129, 0.22)'
                          : stepError
                          ? 'rgba(239, 68, 68, 0.35)'
                          : 'rgba(255, 255, 255, 0.05)'
                      }`,
                      opacity: step.status === 'pending' ? 0.5 : 1,
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: stepDone
                        ? 'linear-gradient(135deg, #10b981, #34d399)'
                        : stepActive
                        ? 'linear-gradient(135deg, #7c5cfc, #06b6d4)'
                        : stepError
                        ? '#ef4444'
                        : 'rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontWeight: 800
                    }}>
                      {stepDone ? (
                        <Check size={15} strokeWidth={3} />
                      ) : stepActive ? (
                        <Loader2 size={15} className="spin" />
                      ) : stepSkipped ? (
                        <span>–</span>
                      ) : stepError ? (
                        <span>!</span>
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.9rem',
                          fontWeight: stepActive || stepDone ? 700 : 600,
                          color: stepDone ? '#6ee7b7' : stepActive ? '#f1f5f9' : stepError ? '#fca5a5' : 'rgba(255,255,255,0.65)'
                        }}>
                          {step.icon} {step.label}
                        </span>
                        {durationBadge && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: stepActive ? '#67e8f9' : '#94a3b8',
                            background: 'rgba(0,0,0,0.28)',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            flexShrink: 0
                          }}>
                            {durationBadge}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.78rem',
                        color: stepActive ? '#c4b5fd' : 'rgba(255,255,255,0.52)',
                        marginTop: '3px',
                        lineHeight: 1.4,
                        wordBreak: 'break-word'
                      }}>
                        {step.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Activiteitenlogboek */}
          <div style={{
            background: 'rgba(9, 13, 24, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '1.25rem 1.4rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} color="#38bdf8" />
                <span>Live Server-Logboek</span>
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                {activeJob.logs.length} meldingen
              </span>
            </div>

            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.77rem'
            }}>
              {activeJob.logs.map(log => {
                const timeStr = new Date(log.ts).toLocaleTimeString('nl-NL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.025)',
                      color: 'rgba(226, 232, 240, 0.88)'
                    }}
                  >
                    <span style={{ color: 'rgba(148, 163, 184, 0.7)', flexShrink: 0 }}>{timeStr}</span>
                    <span style={{ flexShrink: 0 }}>{log.icon}</span>
                    <span style={{ lineHeight: 1.4 }}>{log.message}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Rechterkolom: Live Slide Blueprint Preview */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(18, 24, 43, 0.85), rgba(11, 16, 30, 0.92))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '1.35rem 1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="#a855f7" />
              <span>Live Les-Blauwdruk</span>
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              {activeJob.previewSlides.length > 0
                ? `${activeJob.previewSlides.length} dia's ontworpen`
                : 'Ontwerp wordt geschreven...'}
            </span>
          </div>

          {activeJob.previewSlides.length === 0 ? (
            <div style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              borderRadius: '16px',
              border: '1px dashed rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.015)'
            }}>
              {isRunning ? (
                <>
                  <Loader2 size={30} className="spin" color="#7c5cfc" />
                  <p style={{ margin: '0.9rem 0 0 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.65)' }}>
                    Zodra het AI-model de eerste dia-opbouw heeft gegenereerd, verschijnen hier direct de dia-kaarten en gevonden afbeeldingen.
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(255,255,255,0.5)' }}>
                  Geen dia-voorbeeld beschikbaar.
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '520px', overflowY: 'auto' }}>
              {activeJob.previewSlides.map((sl, idx) => {
                const badge = SLIDE_TYPE_BADGE[sl.type] || SLIDE_TYPE_BADGE.multiple_choice;
                return (
                  <div
                    key={sl.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      animation: 'fadeIn 0.25s ease-out'
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.07)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.75)',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <span style={{
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: '6px',
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: 700
                        }}>
                          {badge.label}
                        </span>
                        {sl.rtti && (
                          <span style={{
                            background: 'rgba(124, 92, 252, 0.2)',
                            color: '#ddd6fe',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '0.66rem',
                            fontWeight: 800
                          }}>
                            {sl.rtti}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: '#f1f5f9',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {sl.title}
                      </div>
                    </div>

                    {sl.imageUrl ? (
                      <img
                        src={sl.imageUrl}
                        alt=""
                        style={{
                          width: '48px',
                          height: '36px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          flexShrink: 0
                        }}
                      />
                    ) : activeJob.activeStepKey === 'images' && sl.type === 'content' ? (
                      <div style={{
                        width: '48px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <ImageIcon size={14} color="rgba(255,255,255,0.35)" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {activeJob.stats.sourcesUsed.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>
                GEKOPPELDE BRONNEN:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeJob.stats.sourcesUsed.map((src, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#6ee7b7',
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
