import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  ShieldAlert, Clock, CheckCircle2, AlertTriangle, Maximize2,
  Lock, Sparkles, ChevronLeft, ChevronRight, Flag,
  Send, Check, X, Eye
} from 'lucide-react';

interface Question {
  id: string;
  type: 'multiple_choice' | 'open';
  question: string;
  options?: string[];
  points: number;
  imageUrl?: string;
  imageAlt?: string;
}

interface ExamData {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  status: string;
  timeLimitMinutes?: number;
  hasPassword: boolean;
  allowTabSwitch: boolean;
  maxTabSwitchViolations: number;
  forceFullscreen: boolean;
  disableCopyPaste: boolean;
  aiAssistanceMode: 'disabled' | 'hints' | 'full';
  maxAiHints: number;
  totalPoints: number;
  questions: Question[];
  mySubmission?: any;
}

export default function ExamRoom() {
  const { examId } = useParams<{ examId: string }>();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const isTeacher = ['teacher', 'admin', 'superadmin'].includes(user?.role || '');

  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wachtwoord ontgrendeling
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Toetssessie state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Anti-fraude & timing
  const [tabViolations, setTabViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');
  const [autoLockedMessage, setAutoLockedMessage] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UI Modals
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // AI Hint state
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);

  const heartbeatTimerRef = useRef<any>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // 1. Toetsgegevens ophalen
  const loadExam = async () => {
    if (!token || !examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Onverwacht antwoord van server bij het laden van de toets');
      }
      if (!res.ok) {
        throw new Error(data.error || 'Kon toets niet inladen');
      }
      setExam(data);

      if (data.mySubmission) {
        if (data.mySubmission.status === 'submitted' || data.mySubmission.status === 'graded') {
          setIsSubmitted(true);
          setSubmissionResult(data.mySubmission);
        } else if (data.mySubmission.status === 'in_progress') {
          // Leerling heeft de toets al eerder ontgrendeld en is bezig
          setIsUnlocked(true);
          setAnswers(data.mySubmission.answers || {});
          setTabViolations(data.mySubmission.tabSwitchViolations || 0);
          setHintsUsed(data.mySubmission.aiHintsUsed || 0);
          setStartedAt(data.mySubmission.startedAt);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadExam();
  }, [token, examId]);

  // 2. Toets starten na ontgrendelen (of direct)
  const handleStartExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: passwordInput })
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        setPasswordError('Onverwacht antwoord van de server');
        return;
      }
      if (!res.ok) {
        setPasswordError(data.error || 'Ontgrendelen mislukt');
        return;
      }

      setIsUnlocked(true);
      setStartedAt(data.startedAt || new Date().toISOString());
      if (data.answers) setAnswers(data.answers);
      setTabViolations(data.tabSwitchViolations || 0);

      // Verzoek fullscreen indien vereist
      if (exam?.forceFullscreen) {
        requestFullscreen();
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Verbindingsfout');
    }
  };

  const requestFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // 3. Timer berekening
  useEffect(() => {
    if (!exam?.timeLimitMinutes || !startedAt || isSubmitted) return;

    const limitSeconds = exam.timeLimitMinutes * 60;
    const updateTimer = () => {
      const elapsedSec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const remaining = Math.max(0, limitSeconds - elapsedSec);
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        handleSubmitExam(true); // Automatisch inleveren bij verlopen timer
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [exam?.timeLimitMinutes, startedAt, isSubmitted]);

  // 4. Anti-fraude listeners: Tab switch & blur & fullscreen
  useEffect(() => {
    if (!isUnlocked || isSubmitted || !exam) return;

    const handleViolation = (type: 'tab_blur' | 'fullscreen_exit') => {
      if (exam.allowTabSwitch) return;

      const nextViolations = tabViolations + 1;
      setTabViolations(nextViolations);

      const msg = `Let op! Je hebt het toetsscherm verlaten (${type === 'fullscreen_exit' ? 'Volledig scherm verlaten' : 'Tabblad gewisseld'}). Dit is geregistreerd voor je docent (Overtreding ${nextViolations} van ${exam.maxTabSwitchViolations}).`;
      setViolationMessage(msg);
      setShowViolationModal(true);

      // Stuur direct heartbeat met overtreding naar server
      fetch(`/api/exams/${exam.id}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: answersRef.current,
          violation: { type, timestamp: new Date().toISOString() }
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.autoSubmitted) {
          setAutoLockedMessage(data.reason || 'Toets vergrendeld wegens te veel tabblad-wisselingen.');
          setIsSubmitted(true);
        }
      })
      .catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_blur');
      }
    };

    const onBlur = () => {
      handleViolation('tab_blur');
    };

    const onFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull && exam.forceFullscreen) {
        handleViolation('fullscreen_exit');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Periodieke autosave heartbeat
    heartbeatTimerRef.current = setInterval(() => {
      fetch(`/api/exams/${exam.id}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers: answersRef.current })
      }).catch(() => {});
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isUnlocked, isSubmitted, exam, tabViolations]);

  // 5. Antwoord bijwerken
  const handleAnswerChange = (questionId: string, val: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: val
    }));
  };

  // 6. Toets inleveren
  const handleSubmitExam = async (_isAutoTimeOut = false) => {
    if (!exam || isSubmitted) return;
    try {
      const res = await fetch(`/api/exams/${exam.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Onverwacht antwoord van de server bij het inleveren');
      }
      if (!res.ok) throw new Error(data.error || 'Inleveren mislukt');

      setIsSubmitted(true);
      setShowSubmitConfirm(false);
      setSubmissionResult(data);
    } catch (err: any) {
      alert(`Fout bij inleveren: ${err.message}`);
    }
  };

  // 7. AI Hint opvragen
  const handleRequestHint = async (qId: string) => {
    if (!exam || exam.aiAssistanceMode === 'disabled') return;
    setLoadingHint(true);
    setCurrentHint(null);
    setShowHintModal(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ questionId: qId })
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Kon hint niet verwerken');
      }
      if (!res.ok) throw new Error(data.error || 'Kon hint niet ophalen');

      setCurrentHint(data.hint);
      setHintsUsed(data.hintsUsed);
    } catch (e: any) {
      setCurrentHint(`Fout: ${e.message}`);
    } finally {
      setLoadingHint(false);
    }
  };

  // Copy/Paste en ContextMenu blokkade
  const preventClipboard = (e: React.SyntheticEvent) => {
    if (exam?.disableCopyPaste) {
      e.preventDefault();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📝</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Toets laden...</div>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
        <div style={{ maxWidth: '440px', background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', textAlign: 'center', color: '#fff' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 10px', fontSize: '1.3rem' }}>Toets Niet Beschikbaar</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>{error || 'Deze toets bestaat niet of is niet actief.'}</p>
          <button onClick={() => navigate('/student')} className="btn btn-primary" style={{ width: '100%' }}>
            Terug naar Leerlingenportaal
          </button>
        </div>
      </div>
    );
  }

  // SCHERM: Reeds ingeleverd of afgerond
  if (isSubmitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
        <div style={{ maxWidth: '520px', width: '100%', background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '24px', padding: '40px 32px', textAlign: 'center', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={40} color="#34d399" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontFamily: 'Outfit, sans-serif' }}>Toets Ingediend!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
            {autoLockedMessage || 'Je antwoorden zijn succesvol ontvangen en veilig opgeslagen.'}
          </p>

          {submissionResult?.grade !== null && submissionResult?.grade !== undefined ? (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jouw Behaalde Cijfer</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#34d399', margin: '6px 0' }}>{submissionResult.grade}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Score: {submissionResult.score ?? submissionResult.autoScore} / {submissionResult.maxScore} punten
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '14px', padding: '16px', marginBottom: '24px', fontSize: '0.88rem', color: '#bae6fd' }}>
              📝 Deze toets bevat open vragen. Je docent zal de open vragen beoordelen waarna je definitieve cijfer zichtbaar wordt in je portaal.
            </div>
          )}

          {tabViolations > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginBottom: '20px' }}>
              ⚠️ Er zijn {tabViolations} tabblad-wissel waarschuwingen gelogd voor je docent.
            </div>
          )}

          <button onClick={() => navigate('/student')} style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', width: '100%' }}>
            Terug naar Mijn Portaal
          </button>
        </div>
      </div>
    );
  }

  const requiresPassword = Boolean(exam.hasPassword || (exam as any).accessCode);

  // SCHERM: Niet ontgrendeld (ofwel wachtwoord vereist, ofwel welkomst-/startscherm)
  if (!isUnlocked) {
    if (requiresPassword) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
          <form onSubmit={handleStartExam} style={{ maxWidth: '440px', width: '100%', background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: '24px', padding: '36px 32px', textAlign: 'center', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(124,92,252,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Lock size={30} color="#c4b5fd" />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontFamily: 'Outfit, sans-serif' }}>Toets Vergrendeld</h2>
            <div style={{ fontSize: '0.85rem', color: '#c4b5fd', fontWeight: 600, marginBottom: '6px' }}>{exam.title}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
              Deze toets is beveiligd door de docent. Voer het wachtwoord of de toegangscode in die de docent in de klas deelt.
            </p>

            {isTeacher && (exam as any).accessCode && (
              <div style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.8rem', textAlign: 'left', color: '#7dd3fc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>💡 Docent preview:</strong> Code is: <span style={{ fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>{(exam as any).accessCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordInput((exam as any).accessCode)}
                  style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Vul in
                </button>
              </div>
            )}

            {passwordError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'left' }}>
                ⚠️ {passwordError}
              </div>
            )}

            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Toegangswachtwoord / Code</label>
              <input
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
                placeholder="Bijv. BIO2026"
                autoFocus
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.08em', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => navigate(isTeacher ? '/teacher' : '/student')} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                Annuleren
              </button>
              <button type="submit" disabled={!passwordInput.trim()} style={{ flex: 2, background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', border: 'none', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', opacity: !passwordInput.trim() ? 0.6 : 1 }}>
                Ontgrendel & Start →
              </button>
            </div>
          </form>
        </div>
      );
    } else {
      // Introductiescherm voor toetsen zonder wachtwoord
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: '24px', padding: '36px 32px', textAlign: 'center', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(56,189,248,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Sparkles size={32} color="#c4b5fd" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>{exam.title}</h2>
            {exam.subject && <div style={{ fontSize: '0.85rem', color: '#c4b5fd', fontWeight: 600, marginBottom: '14px' }}>{exam.subject}</div>}
            {exam.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>{exam.description}</p>}

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Aantal vragen:</span>
                <strong>{exam.questions.length} ({exam.totalPoints} punten)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tijdslimiet:</span>
                <strong>{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} minuten` : 'Geen tijdslimiet'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Anti-fraude:</span>
                <span style={{ color: !exam.allowTabSwitch ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                  {!exam.allowTabSwitch ? 'Tabblad wisselen niet toegestaan' : 'Vrij browsen'}
                </span>
              </div>
              {exam.aiAssistanceMode !== 'disabled' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>AI Assistent:</span>
                  <span style={{ color: '#c4b5fd', fontWeight: 600 }}>
                    {exam.aiAssistanceMode === 'hints' ? `Hints toegestaan (max ${exam.maxAiHints})` : 'Volledige hulp'}
                  </span>
                </div>
              )}
            </div>

            {passwordError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'left' }}>
                ⚠️ {passwordError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => navigate(isTeacher ? '/teacher' : '/student')} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '14px', borderRadius: '14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                Terug
              </button>
              <button type="button" onClick={() => handleStartExam()} style={{ flex: 2, background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', border: 'none', color: '#fff', padding: '14px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 4px 16px rgba(124,92,252,0.4)' }}>
                Start de Toets Nu →
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  const currentQ = exam.questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length;
  const progressPercent = Math.round((answeredCount / exam.questions.length) * 100);

  // Format tijd
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      onCopy={preventClipboard}
      onPaste={preventClipboard}
      onCut={preventClipboard}
      onContextMenu={preventClipboard}
      style={{
        minHeight: '100vh',
        background: '#0a0e1a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        userSelect: exam.disableCopyPaste ? 'none' : 'auto'
      }}
    >
      {/* BOVENBALK: Toetsinformatie, timer, anti-fraude status */}
      <header style={{
        padding: '12px 24px',
        background: 'rgba(17,24,39,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(124,92,252,0.2)', border: '1px solid rgba(124,92,252,0.4)', borderRadius: '10px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700, color: '#c4b5fd' }}>
            LOCRA TOETS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif' }}>{exam.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {exam.subject ? `${exam.subject} • ` : ''}Vraag {currentIndex + 1} van de {exam.questions.length}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* TIMER */}
          {secondsRemaining !== null && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: secondsRemaining < 300 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
              border: secondsRemaining < 300 ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
              color: secondsRemaining < 300 ? '#fca5a5' : '#fff',
              fontWeight: 700,
              fontSize: '0.9rem'
            }}>
              <Clock size={16} />
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          )}

          {/* ANTI-FRAUDE INDICATOR */}
          {!exam.allowTabSwitch && (
            <div title="Tabblad wisselen is verboden" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: tabViolations > 0 ? '#fca5a5' : 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '5px 10px', borderRadius: '8px' }}>
              <ShieldAlert size={14} color={tabViolations > 0 ? '#ef4444' : '#34d399'} />
              <span>{tabViolations > 0 ? `${tabViolations}/${exam.maxTabSwitchViolations} waarschuwingen` : 'Beveiligde Toetsmodus'}</span>
            </div>
          )}

          {/* FULLSCREEN KNOP */}
          {exam.forceFullscreen && !isFullscreen && (
            <button onClick={requestFullscreen} style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Maximize2 size={13} /> Volledig Scherm
            </button>
          )}

          {/* INLEVEREN KNOP */}
          <button onClick={() => setShowSubmitConfirm(true)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            <Send size={14} /> Toets Inleveren
          </button>
        </div>
      </header>

      {/* VOORTGANGSINDICATOR BALK */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', width: '100%' }}>
        <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, #7c5cfc, #38bdf8)', transition: 'width 0.3s ease' }} />
      </div>

      {/* HOOFD CONTENT: Vraag en navigatie */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* LINKER ZIJBALK: VRAAGNUMMERS STRIP */}
        <aside style={{
          width: '240px',
          background: 'rgba(15,23,42,0.6)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Vragenoverzicht</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{answeredCount} van {exam.questions.length} beantwoord ({progressPercent}%)</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', overflowY: 'auto' }}>
            {exam.questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
              const isCurrent = idx === currentIndex;
              const isFlagged = flagged.has(q.id);

              let bg = 'rgba(255,255,255,0.04)';
              let border = '1px solid rgba(255,255,255,0.1)';
              let color = 'var(--text-secondary)';

              if (isCurrent) {
                bg = 'rgba(124,92,252,0.3)';
                border = '1px solid #7c5cfc';
                color = '#fff';
              } else if (isAnswered) {
                bg = 'rgba(16,185,129,0.18)';
                border = '1px solid rgba(16,185,129,0.4)';
                color = '#a7f3d0';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    background: bg,
                    border,
                    color,
                    fontWeight: isCurrent ? 800 : 600,
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span style={{ position: 'absolute', top: 2, right: 2, width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* LOCRA AI WIDGET IN ZIJBALK */}
          <div style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} color="#c4b5fd" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c4b5fd' }}>Locra AI Hulp</span>
            </div>

            {exam.aiAssistanceMode === 'disabled' && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🔒 AI-hulp is uitgeschakeld door de docent voor deze toets.
              </div>
            )}

            {exam.aiAssistanceMode === 'hints' && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Socratische denk-hints ({hintsUsed}/{exam.maxAiHints} gebruikt)
                </div>
                <button
                  disabled={hintsUsed >= exam.maxAiHints || loadingHint}
                  onClick={() => handleRequestHint(currentQ.id)}
                  style={{
                    width: '100%',
                    background: hintsUsed >= exam.maxAiHints ? 'rgba(255,255,255,0.05)' : 'rgba(124,92,252,0.2)',
                    border: '1px solid rgba(124,92,252,0.4)',
                    color: hintsUsed >= exam.maxAiHints ? 'var(--text-muted)' : '#c4b5fd',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: hintsUsed >= exam.maxAiHints ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  {loadingHint ? 'Denkt na...' : '💡 Vraag hint voor deze vraag'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* MIDDEN: ACTIEVE VRAAG */}
        <main style={{ flex: 1, padding: '36px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: '840px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* VRAAG HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: 'rgba(124,92,252,0.2)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                  Vraag {currentIndex + 1}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {currentQ.points} {currentQ.points === 1 ? 'punt' : 'punten'}
                </span>
                <span style={{ background: currentQ.type === 'multiple_choice' ? 'rgba(56,189,248,0.15)' : 'rgba(168,85,247,0.15)', color: currentQ.type === 'multiple_choice' ? '#7dd3fc' : '#d8b4fe', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                  {currentQ.type === 'multiple_choice' ? 'Meerkeuzevraag' : 'Open Vraag'}
                </span>
              </div>

              <button
                onClick={() => {
                  setFlagged(prev => {
                    const next = new Set(prev);
                    if (next.has(currentQ.id)) next.delete(currentQ.id);
                    else next.add(currentQ.id);
                    return next;
                  });
                }}
                style={{
                  background: flagged.has(currentQ.id) ? 'rgba(245,158,11,0.2)' : 'transparent',
                  border: flagged.has(currentQ.id) ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                  color: flagged.has(currentQ.id) ? '#fbbf24' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Flag size={13} />
                <span>{flagged.has(currentQ.id) ? 'Gemarkeerd' : 'Markeren om na te kijken'}</span>
              </button>
            </div>

            {/* VRAAGSTELLING */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.5, margin: '0 0 24px', fontFamily: 'Inter, sans-serif' }}>
              {currentQ.question}
            </h2>

            {/* EVENTUELE AFBEELDING */}
            {currentQ.imageUrl && (
              <div style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', maxWidth: '520px' }}>
                <img
                  src={currentQ.imageUrl}
                  alt={currentQ.imageAlt || 'Bijlage bij vraag'}
                  onClick={() => setPreviewImageUrl(currentQ.imageUrl!)}
                  style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', cursor: 'zoom-in', background: '#000' }}
                />
                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{currentQ.imageAlt || 'Figuur bij de opgave'}</span>
                  <span onClick={() => setPreviewImageUrl(currentQ.imageUrl!)} style={{ cursor: 'pointer', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={12} /> Vergroten
                  </span>
                </div>
              </div>
            )}

            {/* ANTWOORDVAK */}
            <div style={{ flex: 1, marginBottom: '32px' }}>
              {currentQ.type === 'multiple_choice' && currentQ.options ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = String(answers[currentQ.id]) === String(optIdx);
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleAnswerChange(currentQ.id, optIdx)}
                        style={{
                          padding: '16px 20px',
                          borderRadius: '14px',
                          background: isSelected ? 'rgba(124,92,252,0.18)' : 'rgba(255,255,255,0.03)',
                          border: isSelected ? '1px solid #7c5cfc' : '1px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}>
                          {letter}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: isSelected ? '#fff' : 'var(--text-secondary)', flex: 1 }}>
                          {opt}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={8}
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    placeholder="Typ hier je volledige antwoord en toelichting..."
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    <span>Automatisch opgeslagen</span>
                    <span>{((answers[currentQ.id] || '').trim().split(/\s+/).filter(Boolean).length)} woorden</span>
                  </div>
                </div>
              )}
            </div>

            {/* NAVIGATIE ONDERIN: Vorige / Volgende */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: currentIndex === 0 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={16} /> Vorige Vraag
              </button>

              {currentIndex < exam.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(exam.questions.length - 1, prev + 1))}
                  style={{
                    background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Volgende Vraag <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 22px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Controleer & Lever In <Check size={16} />
                </button>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* MODAL: ANTI-FRAUDE TAB VERLATING WAARSCHUWING */}
      {showViolationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '460px', width: '100%', background: '#1e1b2e', border: '2px solid #ef4444', borderRadius: '20px', padding: '32px', textAlign: 'center', color: '#fff', boxShadow: '0 20px 60px rgba(239,68,68,0.4)' }}>
            <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 10px', fontSize: '1.4rem' }}>⚠️ Toetsscherm Verlaten!</h2>
            <p style={{ color: '#fca5a5', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '20px' }}>
              {violationMessage}
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Blijf binnen dit tabblad. Bij het overschrijden van de limiet wordt je toets onmiddellijk automatisch ingeleverd.
            </div>
            <button
              onClick={() => {
                setShowViolationModal(false);
                if (exam.forceFullscreen) requestFullscreen();
              }}
              style={{ width: '100%', background: '#ef4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
            >
              Ik begrijp het, keer terug naar de toets
            </button>
          </div>
        </div>
      )}

      {/* MODAL: BEVESTIGING INLEVEREN */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '440px', width: '100%', background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>Weet je zeker dat je wilt inleveren?</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Je hebt <strong>{answeredCount} van de {exam.questions.length}</strong> vragen beantwoord.
              {answeredCount < exam.questions.length && (
                <span style={{ display: 'block', color: '#f59e0b', marginTop: '6px' }}>
                  ⚠️ Let op: er staan nog {exam.questions.length - answeredCount} open vragen zonder antwoord!
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Verder Werken
              </button>
              <button onClick={() => handleSubmitExam(false)} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                Ja, Definitief Inleveren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AI HINT WEERGAVE */}
      {showHintModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '460px', width: '100%', background: 'rgba(23,17,45,0.95)', border: '1px solid #7c5cfc', borderRadius: '20px', padding: '24px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c4b5fd', fontWeight: 700 }}>
                <Sparkles size={18} /> Locra AI Denk-Hint
              </div>
              <button onClick={() => setShowHintModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', fontSize: '0.92rem', lineHeight: 1.6, color: '#e9d5ff', minHeight: '80px', display: 'flex', alignItems: 'center' }}>
              {loadingHint ? 'Locra AI formuleert een subtiele hint...' : currentHint}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'right' }}>
              Verbruikt: {hintsUsed} van {exam.maxAiHints} hints
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AFBEELDING VERGROTEN */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', cursor: 'zoom-out' }}>
          <img src={previewImageUrl} alt="Volledige weergave" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  );
}
