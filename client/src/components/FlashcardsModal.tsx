import React, { useState, useEffect } from 'react';

export interface Flashcard {
  id: number;
  front: string;
  back: string;
  hint?: string;
}

interface FlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Flashcard[];
  title?: string;
  theme?: 'light' | 'dark';
}

export function parseCardsFromText(text: string): Flashcard[] {
  const cards: Flashcard[] = [];
  if (!text) return cards;

  // Pattern 1: JSON array with front/back or term/definition
  try {
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          id: idx + 1,
          front: item.front || item.term || item.vraag || item.question || 'Begrip',
          back: item.back || item.definition || item.definitie || item.antwoord || item.answer || 'Uitleg',
          hint: item.hint || ''
        }));
      }
    }
  } catch {}

  // Pattern 2: Lines like "1. Term: Definitie" or "- Term - Definitie" or "Q: ... A: ..."
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let id = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for delimiter like " - ", " : ", " = "
    const cleanLine = line.replace(/^(\d+[\.\)]|\*|-)\s*/, '');
    const colonSplit = cleanLine.split(/:\s+/);
    if (colonSplit.length >= 2 && colonSplit[0].length < 80) {
      cards.push({
        id: id++,
        front: colonSplit[0].trim(),
        back: colonSplit.slice(1).join(': ').trim()
      });
      continue;
    }

    const dashSplit = cleanLine.split(/\s+[-—–]\s+/);
    if (dashSplit.length >= 2 && dashSplit[0].length < 80) {
      cards.push({
        id: id++,
        front: dashSplit[0].trim(),
        back: dashSplit.slice(1).join(' - ').trim()
      });
      continue;
    }

    // Check for "Vraag: ... / Antwoord: ..." across two lines
    if (/^vraag\b/i.test(line) && i + 1 < lines.length && /^antwoord\b/i.test(lines[i + 1])) {
      cards.push({
        id: id++,
        front: line.replace(/^vraag[:\s]*/i, '').trim(),
        back: lines[i + 1].replace(/^antwoord[:\s]*/i, '').trim()
      });
      i++;
      continue;
    }
  }

  return cards;
}

export default function FlashcardsModal({
  isOpen,
  onClose,
  cards: initialCards,
  title = 'Flitskaarten Overhoring',
  theme = 'dark'
}: FlashcardsModalProps) {
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<number>>(new Set());
  const [practiceIds, setPracticeIds] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'practice'>('all');
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (initialCards && initialCards.length > 0) {
      setDeck(initialCards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setMasteredIds(new Set());
      setPracticeIds(new Set());
      setFilterMode('all');
    }
  }, [initialCards, isOpen]);

  if (!isOpen) return null;

  const activeCards = filterMode === 'practice'
    ? deck.filter(c => practiceIds.has(c.id) || !masteredIds.has(c.id))
    : deck;

  const currentCard = activeCards[currentIndex] || activeCards[0];
  const isLight = theme === 'light';

  const handleNext = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (currentIndex < activeCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(activeCards.length - 1);
    }
  };

  const handleMarkMastered = () => {
    if (!currentCard) return;
    setMasteredIds(prev => new Set([...prev, currentCard.id]));
    setPracticeIds(prev => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleMarkPractice = () => {
    if (!currentCard) return;
    setPracticeIds(prev => new Set([...prev, currentCard.id]));
    setMasteredIds(prev => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setShowHint(false);
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
  };

  const handleExportAnki = () => {
    const textData = deck.map(c => `${c.front}\t${c.back}`).join('\n');
    const blob = new Blob([textData], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_anki.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercent = deck.length > 0
    ? Math.round((masteredIds.size / deck.length) * 100)
    : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 20, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: isLight ? '#ffffff' : '#111827',
        border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '680px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: isLight ? '#1f2937' : '#f9fafb',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: `1px solid ${isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🃏</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{title}</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: isLight ? '#6b7280' : '#9ca3af' }}>
                {activeCards.length} {activeCards.length === 1 ? 'kaart' : 'kaarten'} • {masteredIds.size} beheerst ({progressPercent}%)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExportAnki}
              title="Exporteer naar Anki of Quizlet (.tsv)"
              style={{
                background: 'transparent',
                border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.15)'}`,
                color: isLight ? '#4b5563' : '#d1d5db',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              📥 Anki/Quizlet
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#9ca3af' : '#6b7280',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '4px', background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #6366f1, #22c55e)',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span style={{ fontSize: '2.5rem' }}>🎉</span>
              <h4 style={{ margin: '12px 0 6px', fontSize: '1.1rem' }}>Gefeliciteerd!</h4>
              <p style={{ margin: 0, color: isLight ? '#6b7280' : '#9ca3af', fontSize: '0.9rem' }}>
                Je hebt alle kaarten in deze stap beheerst!
              </p>
              <button
                onClick={() => {
                  setFilterMode('all');
                  setMasteredIds(new Set());
                  setCurrentIndex(0);
                }}
                style={{
                  marginTop: '16px',
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🔄 Alles opnieuw overhoren
              </button>
            </div>
          ) : currentCard ? (
            <>
              {/* Card Meta & Switchers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#6366f1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Kaart {currentIndex + 1} van {activeCards.length}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleShuffle}
                    title="Schud kaarten"
                    style={{
                      background: 'transparent',
                      border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
                      color: isLight ? '#6b7280' : '#9ca3af',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔀 Schudden
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode(filterMode === 'all' ? 'practice' : 'all');
                      setCurrentIndex(0);
                      setIsFlipped(false);
                    }}
                    style={{
                      background: filterMode === 'practice' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      borderColor: filterMode === 'practice' ? '#ef4444' : isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      color: filterMode === 'practice' ? '#ef4444' : isLight ? '#6b7280' : '#9ca3af',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {filterMode === 'practice' ? '● Alleen te oefenen' : 'Toon alles'}
                  </button>
                </div>
              </div>

              {/* 3D Flip Card Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                style={{
                  minHeight: '260px',
                  perspective: '1000px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '260px',
                  borderRadius: '18px',
                  padding: '32px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  position: 'relative',
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
                  transformStyle: 'preserve-3d',
                  background: isFlipped
                    ? (isLight ? 'linear-gradient(145deg, #f0fdf4, #dcfce7)' : 'linear-gradient(145deg, #064e3b, #022c22)')
                    : (isLight ? 'linear-gradient(145deg, #f8fafc, #edf2f7)' : 'linear-gradient(145deg, #1e293b, #0f172a)'),
                  border: isFlipped
                    ? '2px solid #22c55e'
                    : `2px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: isLight
                    ? '0 10px 25px -5px rgba(0, 0, 0, 0.08)'
                    : '0 10px 30px -5px rgba(0, 0, 0, 0.45)'
                }}>
                  {/* Badge: Voorzijde / Achterzijde */}
                  <span style={{
                    position: 'absolute',
                    top: '14px',
                    left: '18px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: isFlipped ? '#22c55e' : (isLight ? '#64748b' : '#94a3b8'),
                    background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.25)',
                    padding: '3px 9px',
                    borderRadius: '20px'
                  }}>
                    {isFlipped ? '💡 Antwoord / Definitie' : '🎯 Vraag / Begrip'}
                  </span>

                  <span style={{
                    position: 'absolute',
                    top: '14px',
                    right: '18px',
                    fontSize: '0.72rem',
                    color: isLight ? '#94a3b8' : '#64748b'
                  }}>
                    Klik om te draaien ⟲
                  </span>

                  {/* Card Content */}
                  <div style={{ maxWidth: '90%', margin: 'auto' }}>
                    <div style={{
                      fontSize: isFlipped ? '1.12rem' : '1.3rem',
                      fontWeight: isFlipped ? 500 : 700,
                      lineHeight: 1.5,
                      color: isLight ? '#0f172a' : '#f8fafc'
                    }}>
                      {isFlipped ? currentCard.back : currentCard.front}
                    </div>

                    {/* Hint if available and not flipped */}
                    {!isFlipped && currentCard.hint && (
                      <div style={{ marginTop: '16px' }}>
                        {showHint ? (
                          <div style={{
                            fontSize: '0.82rem',
                            color: '#eab308',
                            background: 'rgba(234, 179, 8, 0.1)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            display: 'inline-block'
                          }}>
                            💡 Hint: {currentCard.hint}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHint(true);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#eab308',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                          >
                            Toon hint
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Controls: Practice vs Mastered */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr 1fr auto',
                gap: '10px',
                alignItems: 'center'
              }}>
                <button
                  onClick={handlePrev}
                  title="Vorige kaart"
                  style={{
                    background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
                    color: isLight ? '#374151' : '#f3f4f6',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  ◀
                </button>

                <button
                  onClick={handleMarkPractice}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>❌</span> Nog oefenen
                </button>

                <button
                  onClick={handleMarkMastered}
                  style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#22c55e',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>✅</span> Beheerst
                </button>

                <button
                  onClick={handleNext}
                  title="Volgende kaart"
                  style={{
                    background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
                    color: isLight ? '#374151' : '#f3f4f6',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  ▶
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
