import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/ToastProvider';
import { Clock, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Award, FileText, Send, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ExamItem {
  key: string;
  subject: string;
  educationLevel: string;
  year: number;
  durationMinutes: number;
  questionCount: number;
}

interface ExamQuestion {
  id: number;
  question: string;
  context?: string;
  maxPoints: number;
  criteria: string[];
}

interface QuestionEvaluation {
  questionId: number;
  awardedPoints: number;
  maxPoints: number;
  feedback: string;
}

export default function ExamSimulator() {
  const token = useAuthStore(state => state.token);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [availableExams, setAvailableExams] = useState<ExamItem[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResult, setExamResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Haal beschikbare examens op
  useEffect(() => {
    const fetchAvailable = async () => {
      try {
        const res = await fetch('/api/exam-simulator/available', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setAvailableExams(await res.json());
        }
      } catch {
        addToast('Kon beschikbare examens niet laden', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchAvailable();
  }, [token]);

  // Timer loop
  useEffect(() => {
    if (!activeSession || activeSession.status === 'completed' || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(sec => {
        if (sec <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession, remainingSeconds]);

  // Start examen
  const handleStartExam = async (examKey: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/exam-simulator/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ examKey })
      });
      if (!res.ok) throw new Error('Kon examen niet starten');
      const session = await res.json();
      setActiveSession(session);
      const parsedQuestions: ExamQuestion[] = JSON.parse(session.questions);
      setQuestions(parsedQuestions);
      setAnswers(JSON.parse(session.answers || '{}'));
      setCurrentQuestionIndex(0);
      setRemainingSeconds(session.durationMinutes * 60);
      setExamResult(null);
      addToast('Examentijd is gestart! Succes!', 'info');
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Antwoord tussentijds opslaan
  const handleSaveAnswer = async (questionId: number, text: string) => {
    const nextAnswers = { ...answers, [questionId]: text };
    setAnswers(nextAnswers);

    if (activeSession) {
      try {
        await fetch(`/api/exam-simulator/sessions/${activeSession.id}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ questionId, answer: text })
        });
      } catch {
        // Silent sync
      }
    }
  };

  // Examen inleveren
  const handleSubmitExam = async (isAutoTimeout = false) => {
    if (!activeSession) return;
    if (!isAutoTimeout && !confirm('Weet je zeker dat je je antwoorden definitief wilt inleveren ter beoordeling?')) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/exam-simulator/sessions/${activeSession.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Fout bij nakijken van het examen');
      const completedSession = await res.json();
      setActiveSession(completedSession);
      const parsedFeedback = JSON.parse(completedSession.feedback || '{}');
      setExamResult({
        ...completedSession,
        feedback: parsedFeedback
      });
      addToast('Examen succesvol nagekeken volgens Cito correctievoorschrift!', 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentQuestionIndex];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={() => activeSession ? setActiveSession(null) : navigate(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              marginBottom: '6px'
            }}
          >
            <ArrowLeft size={16} /> {activeSession ? 'Terug naar examenkeuze' : 'Terug naar Locra'}
          </button>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🎓</span> Examen Simulator & Training
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Oefen officiële eindexamens onder realistische tijdsdruk met directe AI-correctie volgens het Cito correctievoorschrift.
          </p>
        </div>

        {activeSession && !examResult && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: remainingSeconds < 300 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
              border: `1px solid ${remainingSeconds < 300 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
              padding: '8px 16px',
              borderRadius: '999px',
              color: remainingSeconds < 300 ? '#fca5a5' : '#c7d2fe',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}
          >
            <Clock size={18} />
            <span>Resterende Tijd: {formatTime(remainingSeconds)}</span>
          </div>
        )}
      </div>

      {/* ── STATUS 1: Geen actieve sessie (Kies een examen) ────────── */}
      {!activeSession && !examResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ margin: '0.5rem 0 0 0', color: '#e2e8f0', fontSize: '1.1rem' }}>
            Kies een officieel oefenexamen
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {availableExams.map(ex => (
              <div
                key={ex.key}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontWeight: 700 }}>
                      {ex.educationLevel} • {ex.year}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {ex.durationMinutes} min
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>{ex.subject}</h4>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Centraal Examen met {ex.questionCount} officiële opgaven en puntentelling.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartExam(ex.key)}
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <FileText size={16} /> Start Oefenexamen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATUS 2: Examen aan de gang ────────────────────────────── */}
      {activeSession && !examResult && currentQ && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Linker Navigatiekolom */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Opgavenoverzicht
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {questions.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.id]?.trim());
                  const isCurrent = idx === currentQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(idx)}
                      style={{
                        padding: '10px 0',
                        borderRadius: '8px',
                        border: isCurrent ? '2px solid #6366f1' : isAnswered ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isCurrent ? 'rgba(99, 102, 241, 0.3)' : isAnswered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        color: isCurrent ? '#c7d2fe' : isAnswered ? '#6ee7b7' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      {q.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                {isSubmitting ? 'Bezig met nakijken...' : 'Examen Inleveren'}
              </button>
            </div>
          </div>

          {/* Rechter Vraag- en Antwoordpaneel */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase' }}>
                Vraag {currentQ.id} van {questions.length} ({currentQ.maxPoints} punten)
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {activeSession.subject} ({activeSession.educationLevel.toUpperCase()})
              </span>
            </div>

            {currentQ.context && (
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', borderLeft: '3px solid #6366f1', fontSize: '0.88rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                {currentQ.context}
              </div>
            )}

            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.5 }}>
              {currentQ.question}
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Jouw Uitwerking & Antwoord:
              </label>
              <textarea
                rows={7}
                placeholder="Typ hier je volledige beredenering of berekening..."
                value={answers[currentQ.id] || ''}
                onChange={e => handleSaveAnswer(currentQ.id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                disabled={currentQuestionIndex === 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem'
                }}
              >
                <ArrowLeft size={16} /> Vorige Vraag
              </button>

              <button
                type="button"
                onClick={() => setCurrentQuestionIndex(i => Math.min(questions.length - 1, i + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  color: '#c7d2fe',
                  cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Volgende Vraag <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS 3: Examen Nagekeken (Resultaten) ──────────────────── */}
      {examResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Cijfer Score Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '20px',
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                <Award size={18} /> Examenresultaat & Normering
              </div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>
                {examResult.subject} ({examResult.educationLevel.toUpperCase()})
              </h2>
              <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Behaalde score: <strong style={{ color: '#f8fafc' }}>{examResult.score} / {examResult.maxScore} punten</strong> (N-term = 1.0)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '3.5rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    color: examResult.grade >= 5.5 ? '#34d399' : '#f87171'
                  }}
                >
                  {examResult.grade?.toFixed(1)}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: examResult.grade >= 5.5 ? '#6ee7b7' : '#fca5a5' }}>
                  {examResult.grade >= 5.5 ? '✅ Voldoende' : '⚠️ Onvoldoende'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setExamResult(null);
                }}
                className="btn btn-primary"
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={16} /> Ander Examen Kiezen
              </button>
            </div>
          </div>

          {/* Examinator Samenvatting */}
          {examResult.feedback?.examinerSummary && (
            <div style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '14px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} /> Advies van de Eindexaminator
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {examResult.feedback.examinerSummary}
              </p>
            </div>
          )}

          {/* Vragenlijst met Feedback & Punten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>
              Uitgebreide Beoordeling per Vraag
            </h3>

            {questions.map(q => {
              const evalItem: QuestionEvaluation = examResult.feedback?.evaluations?.find((e: any) => e.questionId === q.id) || {
                questionId: q.id,
                awardedPoints: 0,
                maxPoints: q.maxPoints,
                feedback: 'Geen evaluatie beschikbaar.'
              };
              const studentAnswer = answers[q.id] || '(Geen antwoord ingevuld)';

              return (
                <div
                  key={q.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
                      Vraag {q.id}
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: evalItem.awardedPoints === q.maxPoints ? 'rgba(16, 185, 129, 0.15)' : evalItem.awardedPoints > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${evalItem.awardedPoints === q.maxPoints ? 'rgba(16, 185, 129, 0.3)' : evalItem.awardedPoints > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: evalItem.awardedPoints === q.maxPoints ? '#6ee7b7' : evalItem.awardedPoints > 0 ? '#fcd34d' : '#fca5a5'
                      }}
                    >
                      {evalItem.awardedPoints} / {q.maxPoints} pt
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1' }}>{q.question}</p>

                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.82rem', color: '#94a3b8' }}>
                    <strong style={{ color: '#cbd5e1' }}>Jouw antwoord:</strong> {studentAnswer}
                  </div>

                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '10px', borderLeft: '3px solid #818cf8', fontSize: '0.82rem', color: '#c7d2fe' }}>
                    <strong>Correctievoorschrift & Feedback:</strong> {evalItem.feedback}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
