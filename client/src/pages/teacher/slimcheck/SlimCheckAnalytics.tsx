import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Target, AlertTriangle,
  CheckCircle2, XCircle, ArrowLeft, Award, Brain, Percent, ChevronDown,
  ChevronUp, Activity
} from 'lucide-react';

interface Props {
  sessionId: string;
  token: string;
  onBack: () => void;
}

export default function SlimCheckAnalytics({ sessionId, token, onBack }: Props) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [sortStudents, setSortStudents] = useState<'score-desc' | 'score-asc' | 'name'>('score-desc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/slimcheck/sessions/${sessionId}/analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setAnalytics(await res.json());
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [sessionId, token]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <Activity size={32} className="spin" style={{ marginBottom: '12px' }} />
        <div>Analysegegevens laden...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        Geen analysegegevens beschikbaar voor deze sessie.
      </div>
    );
  }

  const { summary, distribution, questionStats, hardestQuestions, studentScores } = analytics;

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return '#34d399';
    if (pct >= 55) return '#fbbf24';
    return '#f87171';
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>Makkelijk</span>;
      case 'medium':
        return <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>Gemiddeld</span>;
      case 'hard':
        return <span style={{ background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>Moeilijk</span>;
      default:
        return null;
    }
  };

  const sortedStudents = [...studentScores].sort((a: any, b: any) => {
    if (sortStudents === 'score-desc') return b.percentage - a.percentage;
    if (sortStudents === 'score-asc') return a.percentage - b.percentage;
    return a.studentName.localeCompare(b.studentName);
  });

  const maxDistCount = Math.max(...distribution.map((d: any) => d.count), 1);

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Terug
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={22} color="#c4b5fd" />
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                Analyse: {analytics.title}
              </h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
              {analytics.subject && <span>{analytics.subject} • </span>}
              {analytics.className && <span>Klas: {analytics.className} • </span>}
              {analytics.totalStudents} leerlingen • {analytics.totalQuestions} vragen
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '14px'
      }}>
        {/* Gemiddelde Score */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} color="#c4b5fd" />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gemiddelde</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: getScoreColor(summary.avgPercentage) }}>
            {summary.avgPercentage}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Mediaan: {summary.medianPercentage}% • Min: {summary.minPercentage}% • Max: {summary.maxPercentage}%
          </div>
        </div>

        {/* Slagingspercentage */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#34d399" />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Geslaagd</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: summary.passRate >= 60 ? '#34d399' : '#fbbf24' }}>
            {summary.passRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            <span style={{ color: '#34d399' }}>{summary.passCount} voldoende</span>
            {' • '}
            <span style={{ color: '#f87171' }}>{summary.failCount} onvoldoende</span>
          </div>
        </div>

        {/* AI Betrouwbaarheid */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={18} color="#38bdf8" />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Zekerheid</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: (summary.avgConfidence ?? 0) >= 70 ? '#34d399' : '#fbbf24' }}>
            {summary.avgConfidence !== null ? `${summary.avgConfidence}%` : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {summary.reviewCount > 0 ? (
              <span style={{ color: '#fbbf24' }}>⚠️ {summary.reviewCount} antwoorden vereisen handmatige controle</span>
            ) : (
              <span style={{ color: '#34d399' }}>✅ Geen handmatige controle nodig</span>
            )}
          </div>
        </div>

        {/* Totaal */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#a78bfa" />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overzicht</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0' }}>
            {analytics.totalStudents}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            leerlingen • max {analytics.totalMaxScore} pt
          </div>
        </div>
      </div>

      {/* Score Distribution Histogram + Hardest Questions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Histogram */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '22px'
        }}>
          <h3 style={{ margin: '0 0 18px 0', fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#c4b5fd" /> Score-verdeling
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px' }}>
            {distribution.map((d: any, i: number) => {
              const heightPct = maxDistCount > 0 ? (d.count / maxDistCount) * 100 : 0;
              const barColors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399'];
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: barColors[i] }}>
                    {d.count}
                  </span>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(heightPct, 8)}%`,
                    background: `linear-gradient(180deg, ${barColors[i]}, ${barColors[i]}88)`,
                    borderRadius: '6px 6px 2px 2px',
                    transition: 'height 0.5s ease',
                    minHeight: '6px'
                  }} />
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 moeilijkste vragen */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '22px'
        }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#f87171" /> Moeilijkste Vragen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hardestQuestions.map((q: any, i: number) => (
              <div key={q.questionId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <span style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: getScoreColor(q.avgPercentage) + '22',
                  border: `1px solid ${getScoreColor(q.avgPercentage)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: getScoreColor(q.avgPercentage),
                  flexShrink: 0
                }}>
                  {q.number}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.promptText}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Gem: {q.avgPoints}/{q.maxPoints} pt • {q.zeroScoreCount} × nul
                  </div>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: getScoreColor(q.avgPercentage), flexShrink: 0 }}>
                  {q.avgPercentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Question Detail Table */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '22px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} color="#a78bfa" /> Resultaten per Vraag
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Vraag</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Max pt</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Gem pt</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Gem %</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Vol score</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Nul score</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>Moeilijkheid</th>
              </tr>
            </thead>
            <tbody>
              {questionStats.map((q: any) => (
                <tr key={q.questionId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#c4b5fd' }}>{q.number}</td>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.promptText}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{q.maxPoints}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#e2e8f0', fontWeight: 600 }}>{q.avgPoints}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      color: getScoreColor(q.avgPercentage),
                      fontWeight: 700,
                      background: getScoreColor(q.avgPercentage) + '15',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {q.avgPercentage}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#34d399' }}>{q.fullScoreCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: q.zeroScoreCount > 0 ? '#f87171' : '#64748b' }}>{q.zeroScoreCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{getDifficultyBadge(q.difficulty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Ranking */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '22px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#38bdf8" /> Resultaten per Leerling
          </h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { key: 'score-desc', label: '↓ Score' },
              { key: 'score-asc', label: '↑ Score' },
              { key: 'name', label: 'A-Z' }
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortStudents(opt.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: sortStudents === opt.key ? 'rgba(124, 92, 252, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: sortStudents === opt.key ? '#c4b5fd' : '#94a3b8'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedStudents.map((s: any, i: number) => (
            <div
              key={s.scanId}
              onClick={() => setExpandedQuestion(expandedQuestion === s.scanId ? null : s.scanId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: expandedQuestion === s.scanId ? 'rgba(124, 92, 252, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                borderRadius: '10px',
                border: expandedQuestion === s.scanId ? '1px solid rgba(124, 92, 252, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {/* Rank */}
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: s.percentage >= 55 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                border: `1px solid ${s.percentage >= 55 ? '#34d399' : '#f87171'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: s.percentage >= 55 ? '#34d399' : '#f87171',
                flexShrink: 0
              }}>
                {sortStudents === 'score-desc' ? i + 1 : '•'}
              </span>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {s.studentName}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {s.totalPoints}/{s.maxPoints} pt
                </div>
              </div>

              {/* Score bar */}
              <div style={{ width: '120px', flexShrink: 0 }}>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${s.percentage}%`,
                    background: getScoreColor(s.percentage),
                    borderRadius: '999px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>

              {/* Percentage */}
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 800,
                color: getScoreColor(s.percentage),
                minWidth: '44px',
                textAlign: 'right'
              }}>
                {s.percentage}%
              </span>

              {/* Expand icon */}
              {expandedQuestion === s.scanId ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#64748b" />}
            </div>
          ))}

          {/* Expanded detail: per-question breakdown for selected student */}
          {expandedQuestion && (() => {
            const student = studentScores.find((s: any) => s.scanId === expandedQuestion);
            if (!student) return null;
            return (
              <div style={{
                background: 'rgba(124, 92, 252, 0.04)',
                border: '1px solid rgba(124, 92, 252, 0.15)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginTop: '-2px'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 600, marginBottom: '10px' }}>
                  Detail per vraag — {student.studentName}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                  {student.questionScores.map((qs: any) => (
                    <div key={qs.questionNumber} style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      textAlign: 'center',
                      border: `1px solid ${getScoreColor(qs.maxPoints > 0 ? (qs.finalPoints / qs.maxPoints) * 100 : 0)}22`
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Vraag {qs.questionNumber}</div>
                      <div style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: getScoreColor(qs.maxPoints > 0 ? (qs.finalPoints / qs.maxPoints) * 100 : 0)
                      }}>
                        {qs.finalPoints}/{qs.maxPoints}
                      </div>
                      {qs.needsReview && (
                        <span style={{ fontSize: '0.65rem', color: '#fbbf24' }}>⚠️ Review</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
