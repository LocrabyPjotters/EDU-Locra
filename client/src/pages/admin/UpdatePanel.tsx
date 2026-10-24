import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

interface ChangelogItem {
  version: string;
  title: string;
  date: string;
  badge?: string;
  isCurrent?: boolean;
  highlights: string[];
}

interface UpdateJob {
  id: string;
  status: 'idle' | 'running' | 'success' | 'error';
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  logs: string[];
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

interface UpdateStatus {
  currentVersion: string;
  currentCommit: string;
  currentBranch: string;
  latestCommit: string;
  hasUpdate: boolean;
  behindCount: number;
  lastChecked: string;
  platform: string;
  nodeVersion: string;
  uptimeSeconds: number;
  changelog: ChangelogItem[];
  job?: UpdateJob;
}

const UPDATE_STEPS = [
  { index: 1, label: 'Code ophalen', icon: '📥', desc: 'Git synchronisatie van origin/main' },
  { index: 2, label: 'Packages bijwerken', icon: '📦', desc: 'npm install (root, server, client)' },
  { index: 3, label: 'Database & Prisma', icon: '🗄️', desc: 'Schema controleren en migreren' },
  { index: 4, label: 'Compilatie (Build)', icon: '⚡', desc: 'Server (tsc) & Client (Vite) bouwen' },
  { index: 5, label: 'Herstarten & Afronden', icon: '🔄', desc: 'Locra herstarten en reload' }
];

export default function UpdatePanel() {
  const token = useAuthStore(state => state.token);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [job, setJob] = useState<UpdateJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'changelog' | 'manual'>('overview');

  const logBottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<any>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system/update-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.job) {
          setJob(data.job);
          if (data.job.status === 'running') {
            setIsUpdating(true);
          }
        }
      }
    } catch (e) {
      console.error('Kon update-status niet ophalen:', e);
    } finally {
      setLoading(false);
    }
  };

  const pollJob = async () => {
    try {
      const res = await fetch('/api/admin/system/update-job', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: UpdateJob = await res.json();
        setJob(data);

        if (data.status === 'running') {
          setIsUpdating(true);
          setUpdateMessage(data.currentStep);
        } else if (data.status === 'success') {
          setIsUpdating(false);
          setUpdateMessage('Update succesvol voltooid! Server is bijgewerkt.');
          if (pollingRef.current) clearInterval(pollingRef.current);

          // Initiate automatic page refresh
          if (reloadCountdown === null) {
            let sec = 4;
            setReloadCountdown(sec);
            const timer = setInterval(() => {
              sec--;
              setReloadCountdown(sec);
              if (sec <= 0) {
                clearInterval(timer);
                window.location.reload();
              }
            }, 1000);
          }
        } else if (data.status === 'error') {
          setIsUpdating(false);
          setUpdateMessage(`Fout tijdens update: ${data.error || 'Onbekende fout'}`);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }
    } catch {
      // Server might be temporarily restarting in step 5
      if (job && job.stepIndex >= 4) {
        setUpdateMessage('Server wordt op dit moment herstart met de nieuwe versie...');
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    pollJob();
  }, [token]);

  useEffect(() => {
    if (isUpdating) {
      pollingRef.current = setInterval(pollJob, 1200);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isUpdating]);

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (showTerminal && logBottomRef.current) {
      logBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [job?.logs?.length, showTerminal]);

  const handleTriggerUpdate = async () => {
    if (!window.confirm('Weet je zeker dat je de update nu wilt starten? Alle bestanden, database en client worden automatisch gecompileerd en bijgewerkt.')) {
      return;
    }

    setIsUpdating(true);
    setShowTerminal(true);
    setUpdateMessage('Update wordt geïnitialiseerd op de server...');

    try {
      const res = await fetch('/api/admin/system/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.started !== false) {
        setUpdateMessage(data.message || 'Updateproces is gestart. Volg de live voortgang hieronder...');
        pollJob();
      } else {
        setIsUpdating(false);
        setUpdateMessage(`Melding: ${data.message || data.error || 'Kon update niet starten'}`);
      }
    } catch (e: any) {
      setIsUpdating(false);
      setUpdateMessage(`Fout bij verbinden met server: ${e.message}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const copyLogsToClipboard = () => {
    if (!job?.logs) return;
    navigator.clipboard.writeText(job.logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2500);
  };

  const formatUptime = (totalSeconds: number) => {
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}u ${m}m`;
    if (h > 0) return `${h}u ${m}m`;
    return `${m}m`;
  };

  const windowsCmd = 'git fetch origin main && git reset --hard origin/main && npm run install:all && npm run build';
  const linuxCmd = 'git fetch origin main && git reset --hard origin/main && npm run install:all && npm run build && pm2 restart all';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
              Systeem Updates
            </h2>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              {status?.currentVersion || 'v2.5.3'}
            </span>
          </div>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Beheer Locra updates, bekijk actuele release notes en werk de software bij met één klik.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => { fetchStatus(); pollJob(); }}
            disabled={loading || isUpdating}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {loading ? 'Controleren...' : 'Controleer Updates'}
          </button>

          <a
            href="https://github.com/LocrabyPjotters/EDU-Locra"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <span>🐙</span> GitHub Repo ↗
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: activeTab === 'overview' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'overview' ? '#818cf8' : 'var(--text-secondary)',
            border: activeTab === 'overview' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🚀 Status & Bijwerken
        </button>

        <button
          onClick={() => setActiveTab('changelog')}
          style={{
            background: activeTab === 'changelog' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'changelog' ? '#818cf8' : 'var(--text-secondary)',
            border: activeTab === 'changelog' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📋 Changelog & Versiegeschiedenis
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          style={{
            background: activeTab === 'manual' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'manual' ? '#818cf8' : 'var(--text-secondary)',
            border: activeTab === 'manual' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          💻 Handmatige Terminal Instructies
        </button>
      </div>

      {/* ACTIVE UPDATE / PROGRESS TRACKER CARD */}
      {(isUpdating || job?.status === 'running' || job?.status === 'success' || job?.status === 'error') && (
        <div style={{
          background: job?.status === 'error'
            ? 'rgba(239, 68, 68, 0.1)'
            : job?.status === 'success'
            ? 'rgba(16, 185, 129, 0.12)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: `1px solid ${job?.status === 'error' ? 'rgba(239, 68, 68, 0.4)' : job?.status === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
          borderRadius: '20px',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: '0 12px 30px rgba(0,0,0,0.3)'
        }}>
          {/* Status Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2rem' }}>
                {job?.status === 'error' ? '❌' : job?.status === 'success' ? '🎉' : '⚙️'}
              </span>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  {job?.status === 'error'
                    ? 'Update Mislukt'
                    : job?.status === 'success'
                    ? 'Update Succesvol Voltooid!'
                    : 'Locra Systeem Update Wordt Uitgevoerd...'}
                </h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {job?.currentStep || updateMessage}
                </div>
              </div>
            </div>

            {/* Countdown / Status Tag */}
            <div>
              {reloadCountdown !== null ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.25)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  color: '#6ee7b7',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}>
                  Pagina vernieuwt over {reloadCountdown}s...
                </div>
              ) : job?.status === 'running' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontSize: '0.85rem' }}>
                  <span className="pulse-dot"></span> Live Bezig ({job.stepIndex}/{job.totalSteps})
                </div>
              ) : null}
            </div>
          </div>

          {/* 5-Step Visual Progress Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {UPDATE_STEPS.map((step) => {
              const isCurrent = job?.stepIndex === step.index && job?.status === 'running';
              const isDone = (job?.stepIndex || 0) > step.index || job?.status === 'success';
              const isFailed = job?.stepIndex === step.index && job?.status === 'error';

              return (
                <div
                  key={step.index}
                  style={{
                    background: isCurrent
                      ? 'rgba(99, 102, 241, 0.25)'
                      : isDone
                      ? 'rgba(16, 185, 129, 0.15)'
                      : isFailed
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${
                      isCurrent
                        ? 'rgba(99, 102, 241, 0.6)'
                        : isDone
                        ? 'rgba(16, 185, 129, 0.4)'
                        : isFailed
                        ? 'rgba(239, 68, 68, 0.5)'
                        : 'rgba(255,255,255,0.06)'
                    }`,
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>
                    {isDone ? '✓' : isFailed ? '✕' : step.icon}
                  </span>
                  <div>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: isDone ? '#6ee7b7' : isCurrent ? '#c7d2fe' : isFailed ? '#fca5a5' : 'var(--text-muted)'
                    }}>
                      Stap {step.index}: {step.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Terminal Logs Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setShowTerminal(prev => !prev)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#cbd5e1',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{showTerminal ? '🔽' : '▶️'}</span>
              <span>{showTerminal ? 'Verberg Console Logs' : 'Toon Live Console Logs'} ({job?.logs?.length || 0} regels)</span>
            </button>

            {job?.logs && job.logs.length > 0 && (
              <button
                onClick={copyLogsToClipboard}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#818cf8',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {copiedLogs ? '✓ Logs Gekopieerd!' : '📋 Kopieer Logboek'}
              </button>
            )}
          </div>

          {/* Terminal Box */}
          {showTerminal && (
            <div style={{
              background: '#090d16',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '1rem',
              maxHeight: '260px',
              overflowY: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.78rem',
              color: '#94a3b8',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              {(!job?.logs || job.logs.length === 0) ? (
                <div style={{ color: 'var(--text-muted)' }}>Wachten op eerste uitvoer van server...</div>
              ) : (
                job.logs.map((logLine, idx) => {
                  const isError = logLine.includes('[FOUT]') || logLine.includes('❌') || logLine.includes('Error:');
                  const isStep = logLine.includes('=== STAP') || logLine.includes('Start Locra');
                  const isCmd = logLine.startsWith('$ ');

                  return (
                    <div
                      key={idx}
                      style={{
                        color: isError
                          ? '#f87171'
                          : isStep
                          ? '#38bdf8'
                          : isCmd
                          ? '#a78bfa'
                          : logLine.includes('✓')
                          ? '#34d399'
                          : '#cbd5e1',
                        fontWeight: isStep || isCmd ? 700 : 400,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {logLine}
                    </div>
                  );
                })
              )}
              <div ref={logBottomRef} />
            </div>
          )}
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main Hero Card */}
          <div style={{
            background: status?.hasUpdate
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(236, 72, 153, 0.12) 50%, rgba(15, 23, 42, 0.8) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: `1px solid ${status?.hasUpdate ? 'rgba(99, 102, 241, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '24px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ maxWidth: '640px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: status?.hasUpdate ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: status?.hasUpdate ? '#fda4af' : '#6ee7b7',
                    border: `1px solid ${status?.hasUpdate ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {status?.hasUpdate ? '🚀 Nieuwe Update Beschikbaar' : '✓ Systeem is Helemaal Up-to-date'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Tak: <strong>{status?.currentBranch || 'main'}</strong>
                  </span>
                </div>

                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                  {status?.hasUpdate
                    ? 'Er staat een nieuwe versie klaar om te installeren!'
                    : `Je draait op de nieuwste versie (${status?.currentVersion || 'v2.5.3'})`}
                </h3>

                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {status?.hasUpdate
                    ? 'Er zijn nieuwe updates gepusht naar de GitHub main branch. Klik op de knop hiernaast om alle wijzigingen, database-migraties en builds automatisch uit te voeren.'
                    : 'Alle leertools, AI-verbindingen, database-tabellen en beveiligingsfuncties zijn gesynchroniseerd met de officiële EDU repository.'}
                </p>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div>Huidige Commit: <code style={{ color: '#818cf8' }}>{status?.currentCommit || '...'}</code></div>
                  <div>Laatste Remote Commit: <code style={{ color: '#38bdf8' }}>{status?.latestCommit || '...'}</code></div>
                  <div>Laatst Gecontroleerd: {status?.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'Zojuist'}</div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
                <button
                  onClick={handleTriggerUpdate}
                  disabled={isUpdating}
                  className="btn btn-primary"
                  style={{
                    padding: '0.85rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '14px',
                    background: status?.hasUpdate
                      ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: status?.hasUpdate ? '0 10px 25px rgba(99, 102, 241, 0.4)' : 'none'
                  }}
                >
                  <span>{isUpdating ? '⚙️' : status?.hasUpdate ? '🚀' : '🔄'}</span>
                  {isUpdating ? 'Bezig met bijwerken...' : status?.hasUpdate ? 'Nu Update Installeren' : 'Systeem Opnieuw Bouwen'}
                </button>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {status?.hasUpdate ? 'Duurt circa 1 tot 2 minuten' : 'Optioneel: forceer herinstallatie'}
                </div>
              </div>
            </div>
          </div>

          {/* Diagnostics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Besturingssysteem</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                {status?.platform === 'Windows' ? '🪟 Windows' : status?.platform === 'macOS' ? '🍎 macOS' : '🐧 Linux'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Host Environment</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Node.js Runtime</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                🟢 {status?.nodeVersion || 'v20.x'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>JavaScript Engine</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Database Status</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                🗄️ SQLite + Prisma
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Lokaal & Versleuteld</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Server Uptime</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                ⏱️ {status ? formatUptime(status.uptimeSeconds) : '...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Actieve sessieduur</div>
            </div>
          </div>

          {/* Latest Highlights Teaser */}
          {status?.changelog?.[0] && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  ✨ Wat is er nieuw in {status.changelog[0].version}?
                </h4>
                <button
                  onClick={() => setActiveTab('changelog')}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', color: '#818cf8', padding: '4px 8px' }}
                >
                  Volledige Changelog Bekijken →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
                {status.changelog[0].highlights.slice(0, 6).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.slice(0, 2)}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {item.slice(2).trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHANGELOG */}
      {activeTab === 'changelog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {status?.changelog?.map((release) => (
            <div
              key={release.version}
              style={{
                background: release.isCurrent ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${release.isCurrent ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '20px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: release.isCurrent ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'rgba(255,255,255,0.1)',
                    color: '#fff'
                  }}>
                    {release.version}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                    {release.title}
                  </h3>
                  {release.badge && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      {release.badge}
                    </span>
                  )}
                  {release.isCurrent && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      Huidige Versie
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  📅 {release.date}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {release.highlights.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{h.slice(0, 2)}</span>
                    <span style={{ lineHeight: 1.5 }}>{h.slice(2).trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: MANUAL INSTRUCTIONS */}
      {activeTab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              🪟 Windows Server Handmatig Bijwerken
            </h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Open een Opdrachtprompt (cmd) of PowerShell in je Locra installatiemap en voer het volgende commando uit:
            </p>

            <div style={{
              background: '#090d16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <code style={{ color: '#38bdf8', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                {windowsCmd}
              </code>
              <button
                onClick={() => copyToClipboard(windowsCmd, 'win')}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', flexShrink: 0 }}
              >
                {copiedCmd === 'win' ? '✓ Gekopieerd!' : '📋 Kopiëren'}
              </button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              💡 <em>Tip: Dit commando haalt automatisch de nieuwste commits binnen, voert Prisma schema-synchronisatie uit en compileert de client & server.</em>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              🐧 Linux / macOS Server Bijwerken
            </h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Voor Linux VPS of macOS servers in de terminal:
            </p>

            <div style={{
              background: '#090d16',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <code style={{ color: '#34d399', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                {linuxCmd}
              </code>
              <button
                onClick={() => copyToClipboard(linuxCmd, 'lin')}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', flexShrink: 0 }}
              >
                {copiedCmd === 'lin' ? '✓ Gekopieerd!' : '📋 Kopiëren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
