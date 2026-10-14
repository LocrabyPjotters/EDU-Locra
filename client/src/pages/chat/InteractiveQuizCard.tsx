import { useState, useCallback } from 'react';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizData {
  title: string;
  topic?: string;
  questions: QuizQuestion[];
}

interface InteractiveQuizCardProps {
  data: QuizData;
  theme?: 'light' | 'dark';
}

export default function InteractiveQuizCard({ data, theme = 'dark' }: InteractiveQuizCardProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const isLight = theme === 'light';

  const handleSelectAnswer = useCallback((questionIdx: number, optionIdx: number) => {
    if (revealedAnswers[questionIdx]) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
  }, [revealedAnswers]);

  const handleCheckAnswer = useCallback((questionIdx: number) => {
    setRevealedAnswers(prev => ({ ...prev, [questionIdx]: true }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentQuestion < data.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentQuestion, data.questions.length]);

  const handleRestart = useCallback(() => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setRevealedAnswers({});
    setIsCompleted(false);
  }, []);

  const correctCount = data.questions.filter(
    (q, i) => revealedAnswers[i] && selectedAnswers[i] === q.correctAnswer
  ).length;

  const answeredCount = Object.keys(revealedAnswers).length;

  const q = data.questions[currentQuestion];
  if (!q) return null;

  const isRevealed = revealedAnswers[currentQuestion];
  const selectedOption = selectedAnswers[currentQuestion];
  const isCorrect = selectedOption === q.correctAnswer;

  const scorePercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (isCompleted) {
    const totalCorrect = data.questions.filter(
      (q, i) => selectedAnswers[i] === q.correctAnswer
    ).length;
    const totalPercent = Math.round((totalCorrect / data.questions.length) * 100);
    const emoji = totalPercent >= 80 ? '🏆' : totalPercent >= 60 ? '👏' : totalPercent >= 40 ? '💪' : '📚';
    const message = totalPercent >= 80 ? 'Uitstekend!' : totalPercent >= 60 ? 'Goed gedaan!' : totalPercent >= 40 ? 'Kan beter, blijf oefenen!' : 'Nog even studeren!';

    return (
      <div style={{
        background: isLight
          ? 'linear-gradient(145deg, #f8f5ff, #eef2ff, #f0f9ff)'
          : 'linear-gradient(145deg, rgba(99,102,241,0.12), rgba(124,92,252,0.08), rgba(6,182,212,0.06))',
        border: `1px solid ${isLight ? '#ddd6fe' : 'rgba(124,92,252,0.3)'}`,
        borderRadius: '20px',
        padding: '28px',
        maxWidth: '580px',
        width: '100%',
        position: 'relative' as const,
        overflow: 'hidden'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: totalPercent >= 60
            ? 'radial-gradient(circle, rgba(74,222,128,0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(251,146,60,0.2) 0%, transparent 70%)',
          pointerEvents: 'none' as const
        }} />

        <div style={{ textAlign: 'center', position: 'relative' as const, zIndex: 1 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '8px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}>{emoji}</div>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: isLight ? '#1e1b4b' : '#e0e7ff'
          }}>{message}</h3>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '0.9rem',
            color: isLight ? '#6366f1' : '#a5b4fc'
          }}>
            {data.title}
          </p>

          {/* Score ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '120px', height: '120px', borderRadius: '50%',
              background: isLight
                ? `conic-gradient(${totalPercent >= 60 ? '#22c55e' : '#f59e0b'} ${totalPercent}%, #e5e7eb ${totalPercent}%)`
                : `conic-gradient(${totalPercent >= 60 ? '#4ade80' : '#fbbf24'} ${totalPercent}%, rgba(255,255,255,0.08) ${totalPercent}%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px'
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: isLight ? '#f8f5ff' : '#141b2d',
                display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '1.8rem', fontWeight: 800,
                  color: isLight ? '#1e1b4b' : '#fff',
                  lineHeight: 1
                }}>{totalCorrect}/{data.questions.length}</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600,
                  color: isLight ? '#6366f1' : '#a5b4fc',
                  marginTop: '2px'
                }}>goed</span>
              </div>
            </div>
          </div>

          {/* Per question review */}
          <div style={{
            display: 'flex', flexWrap: 'wrap' as const, gap: '6px',
            justifyContent: 'center', marginBottom: '20px'
          }}>
            {data.questions.map((q, i) => {
              const wasCorrect = selectedAnswers[i] === q.correctAnswer;
              return (
                <div key={i} style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 700,
                  background: wasCorrect
                    ? (isLight ? 'rgba(34,197,94,0.15)' : 'rgba(74,222,128,0.15)')
                    : (isLight ? 'rgba(239,68,68,0.15)' : 'rgba(248,113,113,0.15)'),
                  color: wasCorrect
                    ? (isLight ? '#16a34a' : '#4ade80')
                    : (isLight ? '#dc2626' : '#f87171'),
                  border: `1px solid ${wasCorrect
                    ? (isLight ? 'rgba(34,197,94,0.3)' : 'rgba(74,222,128,0.3)')
                    : (isLight ? 'rgba(239,68,68,0.3)' : 'rgba(248,113,113,0.3)')}`
                }}>
                  {wasCorrect ? '✓' : '✗'}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleRestart}
            style={{
              padding: '10px 28px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            🔄 Opnieuw proberen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: isLight
        ? 'linear-gradient(145deg, #faf8ff, #eef2ff)'
        : 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(15,21,37,0.9))',
      border: `1px solid ${isLight ? '#e0e7ff' : 'rgba(124,92,252,0.25)'}`,
      borderRadius: '20px',
      padding: '0',
      maxWidth: '580px',
      width: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: isLight
          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
          : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.95rem', fontWeight: 700,
            color: isLight ? '#fff' : '#e0e7ff'
          }}>
            <span>🧪</span> {data.title}
          </div>
          {data.topic && (
            <div style={{
              fontSize: '0.75rem',
              color: isLight ? 'rgba(255,255,255,0.8)' : '#a5b4fc',
              marginTop: '2px'
            }}>
              {data.topic}
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          {/* Score badge */}
          {answeredCount > 0 && (
            <div style={{
              background: isLight ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isLight ? '#fff' : (scorePercent >= 60 ? '#4ade80' : '#fbbf24')
            }}>
              {correctCount}/{answeredCount} goed
            </div>
          )}
          {/* Progress */}
          <div style={{
            background: isLight ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
            borderRadius: '999px',
            padding: '4px 12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: isLight ? '#fff' : '#c7d2fe'
          }}>
            {currentQuestion + 1}/{data.questions.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '3px',
        background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'
      }}>
        <div style={{
          height: '100%',
          width: `${((currentQuestion + (isRevealed ? 1 : 0)) / data.questions.length) * 100}%`,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
          transition: 'width 0.4s ease',
          borderRadius: '0 2px 2px 0'
        }} />
      </div>

      {/* Question body */}
      <div style={{ padding: '20px' }}>
        <h4 style={{
          margin: '0 0 16px 0',
          fontSize: '1.05rem',
          fontWeight: 650,
          color: isLight ? '#1e1b4b' : '#eef2ff',
          lineHeight: 1.5
        }}>
          {q.question}
        </h4>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
          {q.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrectOption = idx === q.correctAnswer;
            let optionBg: string;
            let optionBorder: string;
            let optionColor: string;

            if (isRevealed) {
              if (isCorrectOption) {
                optionBg = isLight ? 'rgba(34,197,94,0.12)' : 'rgba(74,222,128,0.12)';
                optionBorder = isLight ? 'rgba(34,197,94,0.5)' : 'rgba(74,222,128,0.45)';
                optionColor = isLight ? '#16a34a' : '#4ade80';
              } else if (isSelected && !isCorrectOption) {
                optionBg = isLight ? 'rgba(239,68,68,0.1)' : 'rgba(248,113,113,0.1)';
                optionBorder = isLight ? 'rgba(239,68,68,0.5)' : 'rgba(248,113,113,0.4)';
                optionColor = isLight ? '#dc2626' : '#f87171';
              } else {
                optionBg = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)';
                optionBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
                optionColor = isLight ? '#9ca3af' : '#6b7280';
              }
            } else {
              if (isSelected) {
                optionBg = isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)';
                optionBorder = isLight ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.5)';
                optionColor = isLight ? '#4f46e5' : '#a5b4fc';
              } else {
                optionBg = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)';
                optionBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
                optionColor = isLight ? '#374151' : '#d1d5db';
              }
            }

            const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D

            return (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(currentQuestion, idx)}
                disabled={isRevealed}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  background: optionBg,
                  border: `1.5px solid ${optionBorder}`,
                  color: optionColor,
                  cursor: isRevealed ? 'default' : 'pointer',
                  textAlign: 'left' as const,
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  opacity: isRevealed && !isCorrectOption && !isSelected ? 0.5 : 1,
                  transform: isRevealed && isSelected && !isCorrect ? 'translateX(4px)' : 'none',
                  animation: isRevealed && isSelected && !isCorrect ? 'quizShake 0.4s ease' : 'none'
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '50%',
                  fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                  background: isSelected
                    ? (isRevealed
                      ? (isCorrectOption ? (isLight ? '#22c55e' : '#4ade80') : (isLight ? '#ef4444' : '#f87171'))
                      : (isLight ? '#6366f1' : '#818cf8'))
                    : (isRevealed && isCorrectOption
                      ? (isLight ? '#22c55e' : '#4ade80')
                      : (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)')),
                  color: (isSelected || (isRevealed && isCorrectOption))
                    ? '#fff'
                    : (isLight ? '#6b7280' : '#9ca3af'),
                  transition: 'all 0.2s ease'
                }}>
                  {isRevealed && isCorrectOption ? '✓' : (isRevealed && isSelected && !isCorrectOption ? '✗' : optionLetter)}
                </span>
                <span style={{ flex: 1 }}>{option}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {isRevealed && q.explanation && (
          <div style={{
            marginTop: '14px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: isCorrect
              ? (isLight ? 'rgba(34,197,94,0.08)' : 'rgba(74,222,128,0.06)')
              : (isLight ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.06)'),
            border: `1px solid ${isCorrect
              ? (isLight ? 'rgba(34,197,94,0.2)' : 'rgba(74,222,128,0.15)')
              : (isLight ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.15)')}`
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.78rem', fontWeight: 700,
              color: isCorrect
                ? (isLight ? '#16a34a' : '#4ade80')
                : (isLight ? '#ea580c' : '#fb923c'),
              marginBottom: '4px'
            }}>
              {isCorrect ? '✅ Goed!' : '💡 Uitleg'}
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: isLight ? '#374151' : '#d1d5db',
              lineHeight: 1.6
            }}>
              {q.explanation}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px'
        }}>
          {!isRevealed && (
            <button
              onClick={() => handleCheckAnswer(currentQuestion)}
              disabled={selectedOption === undefined}
              style={{
                padding: '9px 22px',
                borderRadius: '999px',
                border: 'none',
                background: selectedOption !== undefined
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)'),
                color: selectedOption !== undefined ? '#fff' : (isLight ? '#9ca3af' : '#6b7280'),
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: selectedOption !== undefined ? 'pointer' : 'not-allowed',
                boxShadow: selectedOption !== undefined ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Controleren
            </button>
          )}
          {isRevealed && (
            <button
              onClick={handleNext}
              style={{
                padding: '9px 22px',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {currentQuestion < data.questions.length - 1 ? 'Volgende vraag →' : 'Resultaat bekijken 🏁'}
            </button>
          )}
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes quizShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

/**
 * Parse quiz blocks from message content.
 * Supports :::quiz { JSON } ::: format.
 */
export function parseQuizBlocks(content: string): { before: string; quiz: QuizData | null; after: string } {
  const quizRegex = /:::quiz\s*\n?([\s\S]*?)\n?:::/;
  const match = content.match(quizRegex);

  if (!match) {
    return { before: content, quiz: null, after: '' };
  }

  const before = content.substring(0, match.index || 0).trim();
  const after = content.substring((match.index || 0) + match[0].length).trim();
  
  try {
    const jsonStr = match[1].trim();
    const quizData = JSON.parse(jsonStr) as QuizData;
    if (quizData.title && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
      return { before, quiz: quizData, after };
    }
  } catch (e) {
    // Failed to parse quiz JSON
  }

  return { before: content, quiz: null, after: '' };
}
