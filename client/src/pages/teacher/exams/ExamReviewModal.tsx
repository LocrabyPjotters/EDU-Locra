import { useState, useEffect } from 'react';
import {
  X, Sparkles, CheckCircle2, AlertTriangle, Check, ShieldAlert
} from 'lucide-react';

interface Props {
  token: string;
  exam: any;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ExamReviewModal({ token, exam, onClose, onUpdated }: Props) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // Nakijk status per vraag voor geselecteerde student
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [finalGrade, setFinalGrade] = useState<string>('');
  const [teacherNotes, setTeacherNotes] = useState<string>('');
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  let questions: any[] = [];
  try {
    questions = JSON.parse(exam.questionsJson || '[]');
  } catch (e) {
    questions = [];
  }

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
        if (data.length > 0 && !selectedSubId) {
          setSelectedSubId(data[0].id);
        }
      }
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [exam.id]);

  const selectedSub = submissions.find(s => s.id === selectedSubId) || null;

  // Initialiseer scores wanneer geselecteerde student wijzigt
  useEffect(() => {
    if (!selectedSub) return;

    const initialScores: Record<string, number> = {};
    const answers = selectedSub.answers || {};

    questions.forEach(q => {
      if (q.type === 'multiple_choice') {
        const isCorrect = String(answers[q.id]) === String(q.correctAnswer);
        initialScores[q.id] = isCorrect ? (Number(q.points) || 1) : 0;
      } else {
        // Voor open vragen: kijk of er al een opgeslagen score is
        initialScores[q.id] = 0;
      }
    });

    if (selectedSub.grade) {
      setFinalGrade(String(selectedSub.grade));
    } else {
      // Bereken automatisch concept cijfer
      const currentTotal = (Object.values(initialScores) as number[]).reduce((a, b) => a + b, 0);
      const calc = exam.totalPoints > 0 ? ((currentTotal / exam.totalPoints) * 9 + 1).toFixed(1) : '6.0';
      setFinalGrade(calc);
    }

    setQuestionScores(initialScores);
    setTeacherNotes(selectedSub.teacherNotes || '');
    setAiSuggestions({});
  }, [selectedSubId]);

  // AI Nakijkvoorstel opvragen
  const handleAiGrade = async () => {
    if (!selectedSub) return;
    setIsAiGrading(true);
    try {
      const res = await fetch(`/api/exams/submissions/${selectedSub.id}/ai-grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI beoordeling mislukt');

      if (data.suggestions) {
        setAiSuggestions(data.suggestions);

        // Update de score state met suggesties
        const updated = { ...questionScores };
        Object.keys(data.suggestions).forEach(qId => {
          if (data.suggestions[qId].suggestedPoints !== undefined) {
            updated[qId] = data.suggestions[qId].suggestedPoints;
          }
        });
        setQuestionScores(updated);

        // Herbereken cijfer
        const total = Object.values(updated).reduce((a, b) => a + b, 0);
        const newGrade = exam.totalPoints > 0 ? ((total / exam.totalPoints) * 9 + 1).toFixed(1) : '6.0';
        setFinalGrade(newGrade);
      }
    } catch (e: any) {
      alert(`AI beoordeling fout: ${e.message}`);
    } finally {
      setIsAiGrading(false);
    }
  };

  // Beoordeling opslaan & publiceren
  const handleSaveGrade = async () => {
    if (!selectedSub) return;
    setIsSaving(true);
    try {
      const totalScore = (Object.values(questionScores) as number[]).reduce((a, b) => a + b, 0);
      const res = await fetch(`/api/exams/submissions/${selectedSub.id}/grade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          score: totalScore,
          maxScore: exam.totalPoints,
          grade: parseFloat(finalGrade) || 1.0,
          teacherNotes,
          aiGradingReport: aiSuggestions
        })
      });

      if (!res.ok) throw new Error('Opslaan mislukt');

      await loadSubmissions();
      onUpdated();
      alert('Cijfer en feedback succesvol gepubliceerd naar de leerling!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const studentAnswers = selectedSub?.answers || {};
  const currentTotalScore = (Object.values(questionScores) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '1100px', height: '90vh', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        
        {/* HEADER */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              Inzendingen & Nakijken: {exam.title}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {submissions.length} inzendingen • Totaal {exam.totalPoints} punten
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY: LINKER ZIJBALK (STUDENTEN) + RECHTS (ANTWOORDEN NAKIJKPANEEL) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* LINKER ZIJBALK: STUDENTENLIJST */}
          <aside style={{ width: '280px', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Leerlingen ({submissions.length})
            </div>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Laden...</div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Nog geen inzendingen van leerlingen.
              </div>
            ) : (
              submissions.map(sub => {
                const isSelected = sub.id === selectedSubId;
                const studentName = sub.student?.displayName || sub.student?.username || 'Leerling';
                const hasViolations = sub.tabSwitchViolations > 0;

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isSelected ? 'rgba(124,92,252,0.15)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #7c5cfc' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                        {studentName}
                      </div>
                      {sub.status === 'graded' ? (
                        <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {sub.grade}
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                          Ingeleverd
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {hasViolations && (
                        <span style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <AlertTriangle size={11} /> {sub.tabSwitchViolations}x tab
                        </span>
                      )}
                      <span>Score: {sub.score ?? '?'} / {exam.totalPoints}</span>
                    </div>
                  </div>
                );
              })
            )}
          </aside>

          {/* RECHTS: NAKIJKPANEEL VOOR GESELECTEERDE LEERLING */}
          <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!selectedSub ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Selecteer een leerling uit de lijst om de toets te bekijken en na te kijken.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* LEERLING SAMENVATTING & OVERTREDINGEN BANNER */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>
                      {selectedSub.student?.displayName || selectedSub.student?.username}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Ingeleverd op: {selectedSub.submittedAt ? new Date(selectedSub.submittedAt).toLocaleString('nl-NL') : 'Onbekend'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {selectedSub.tabSwitchViolations > 0 ? (
                      <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: '10px', padding: '8px 14px', color: '#fca5a5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={16} color="#ef4444" />
                        <span>⚠️ {selectedSub.tabSwitchViolations}x toetsscherm verlaten</span>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '8px 14px', color: '#a7f3d0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={16} color="#34d399" />
                        <span>Geen tabblad-wisselingen</span>
                      </div>
                    )}

                    <button
                      disabled={isAiGrading}
                      onClick={handleAiGrade}
                      style={{
                        background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                        border: 'none',
                        color: '#fff',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: isAiGrading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(124,92,252,0.3)'
                      }}
                    >
                      <Sparkles size={15} />
                      {isAiGrading ? 'AI Evalueert open vragen...' : 'Genereer AI-nakijkvoorstel'}
                    </button>
                  </div>
                </div>

                {/* VRAGEN OVERZICHT MET LEERLING ANTWOORDEN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {questions.map((q, idx) => {
                    const studentAns = studentAnswers[q.id];
                    const isMultipleChoice = q.type === 'multiple_choice';
                    const isCorrect = isMultipleChoice && String(studentAns) === String(q.correctAnswer);
                    const aiSuggest = aiSuggestions[q.id];

                    return (
                      <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        
                        {/* VRAAG KOP */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#7c5cfc', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.question}</span>
                          </div>

                          {/* PUNTEN INVOER */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Score:</span>
                            <input
                              type="number"
                              min="0"
                              max={q.points}
                              step="0.5"
                              value={questionScores[q.id] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = { ...questionScores, [q.id]: val };
                                setQuestionScores(updated);
                                const tot = (Object.values(updated) as number[]).reduce((a, b) => a + b, 0);
                                setFinalGrade(exam.totalPoints > 0 ? ((tot / exam.totalPoints) * 9 + 1).toFixed(1) : '6.0');
                              }}
                              style={{ width: '56px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {q.points} pt</span>
                          </div>
                        </div>

                        {/* MEERKEUZE WEERGAVE */}
                        {isMultipleChoice && (
                          <div style={{ padding: '12px', borderRadius: '10px', background: isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: isCorrect ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: isCorrect ? '#34d399' : '#f87171', marginBottom: '4px' }}>
                              {isCorrect ? '✅ Juist beantwoord' : '❌ Onjuist beantwoord'}
                            </div>
                            <div>
                              Gekozen door leerling: <strong>{q.options?.[studentAns] || `Optie ${studentAns ?? '-'}`}</strong>
                              {!isCorrect && (
                                <span style={{ marginLeft: '12px', color: '#a7f3d0' }}>
                                  (Juist antwoord: {q.options?.[q.correctAnswer] || `Optie ${q.correctAnswer}`})
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* OPEN VRAAG WEERGAVE */}
                        {!isMultipleChoice && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Antwoord van de leerling:</div>
                              <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: studentAns ? '#fff' : '#fca5a5' }}>
                                {studentAns || '(Geen antwoord ingevuld)'}
                              </div>
                            </div>

                            <div style={{ background: 'rgba(52,211,153,0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.2)', fontSize: '0.8rem', color: '#a7f3d0' }}>
                              <strong>Modelantwoord:</strong> {q.correctAnswer}
                            </div>

                            {/* AI NAKIJKVOORSTEL */}
                            {aiSuggest && (
                              <div style={{ background: 'rgba(124,92,252,0.12)', border: '1px solid #7c5cfc', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c4b5fd', fontWeight: 700, marginBottom: '4px' }}>
                                  <Sparkles size={14} /> AI Score-suggestie: {aiSuggest.suggestedPoints} / {aiSuggest.maxPoints} pt
                                </div>
                                <div style={{ color: '#e2e8f0', marginBottom: '4px' }}>{aiSuggest.feedback}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Toelichting: {aiSuggest.reasoning}</div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

                {/* CIJFER & PUBLICATIE VOETTEKST */}
                <div style={{ background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px', padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Totaalscore</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                        {currentTotalScore} / {exam.totalPoints} pt
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cijfer:</span>
                      <input
                        type="text"
                        value={finalGrade}
                        onChange={(e) => setFinalGrade(e.target.value)}
                        style={{ width: '70px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '2px solid #10b981', color: '#34d399', fontSize: '1.3rem', fontWeight: 800, textAlign: 'center' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <input
                        type="text"
                        value={teacherNotes}
                        onChange={(e) => setTeacherNotes(e.target.value)}
                        placeholder="Persoonlijke opmerking voor leerling..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <button
                    disabled={isSaving}
                    onClick={handleSaveGrade}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 26px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      fontSize: '0.92rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.4)'
                    }}
                  >
                    <Check size={18} />
                    {isSaving ? 'Opslaan...' : 'Cijfer Publiceren naar Leerling'}
                  </button>
                </div>

              </div>
            )}
          </main>

        </div>

      </div>
    </div>
  );
}
