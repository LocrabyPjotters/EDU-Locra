import React from 'react';

interface WordFrequency {
  word: string;
  count: number;
  isNew?: boolean;
}

interface GedachtenwolkProps {
  words?: WordFrequency[];
  rawThoughts?: string[];
  maxWords?: number;
  className?: string;
  emptyMessage?: string;
  title?: string;
}

// Kleurenpalet voor de gedachtenwolk bubbels
const CLOUD_PALETTES = [
  { bg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(59, 130, 246, 0.35))', border: 'rgba(56, 189, 248, 0.5)', text: '#38bdf8' },
  { bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(124, 92, 252, 0.35))', border: 'rgba(168, 85, 247, 0.5)', text: '#c084fc' },
  { bg: 'linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(16, 185, 129, 0.35))', border: 'rgba(52, 211, 153, 0.5)', text: '#34d399' },
  { bg: 'linear-gradient(135deg, rgba(244, 114, 182, 0.25), rgba(236, 72, 153, 0.35))', border: 'rgba(244, 114, 182, 0.5)', text: '#f472b6' },
  { bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.35))', border: 'rgba(251, 191, 36, 0.5)', text: '#fbbf24' },
  { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.35))', border: 'rgba(99, 102, 241, 0.5)', text: '#818cf8' },
  { bg: 'linear-gradient(135deg, rgba(45, 212, 191, 0.25), rgba(20, 184, 166, 0.35))', border: 'rgba(45, 212, 191, 0.5)', text: '#2dd4bf' }
];

export default function Gedachtenwolk({
  words,
  rawThoughts,
  maxWords = 40,
  emptyMessage = 'De gedachten van de klas verschijnen hier live zodra leerlingen insturen... ☁️',
  title
}: GedachtenwolkProps) {
  // Verwerk rawThoughts indien woordenlijst niet direct als frequencies gegeven is
  const computedList: WordFrequency[] = React.useMemo(() => {
    if (words && words.length > 0) {
      return [...words].sort((a, b) => b.count - a.count).slice(0, maxWords);
    }
    if (rawThoughts && rawThoughts.length > 0) {
      const counts: Record<string, number> = {};
      for (const t of rawThoughts) {
        if (!t) continue;
        const normalized = t.trim().toLowerCase();
        if (normalized.length >= 2) {
          counts[normalized] = (counts[normalized] || 0) + 1;
        }
      }
      return Object.entries(counts)
        .map(([w, c]) => ({
          // Behoud eerste hoofdletter voor nette presentatie
          word: w.charAt(0).toUpperCase() + w.slice(1),
          count: c
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, maxWords);
    }
    return [];
  }, [words, rawThoughts, maxWords]);

  const maxCount = React.useMemo(() => {
    if (computedList.length === 0) return 1;
    return Math.max(...computedList.map(w => w.count), 1);
  }, [computedList]);

  if (computedList.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '2px dashed rgba(168, 85, 247, 0.25)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '260px'
      }}>
        <div style={{
          fontSize: '3.5rem',
          marginBottom: '1rem',
          animation: 'pulse 3s infinite ease-in-out'
        }}>
          ☁️
        </div>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#c084fc', fontWeight: 700 }}>
          {title || 'Gedachtenwolk'}
        </h4>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', maxWidth: '420px', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'radial-gradient(ellipse at center, rgba(124, 92, 252, 0.12) 0%, rgba(10, 14, 26, 0.4) 70%)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      borderRadius: '24px',
      padding: '2rem 2.5rem',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {title && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>☁️</span>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#e0e7ff', letterSpacing: '0.02em' }}>
              {title}
            </span>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#a5b4fc', fontWeight: 600 }}>
            {computedList.length} unieke begrippen
          </span>
        </div>
      )}

      {/* Floating Cloud Tags Container */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '1rem 0',
        minHeight: '220px'
      }}>
        {computedList.map((item, idx) => {
          // Relatieve schaal berekening
          const relativeWeight = item.count / maxCount;
          // Font size van 1.05rem tot 2.85rem
          const fontSize = 1.05 + relativeWeight * 1.8;
          const paddingY = 6 + relativeWeight * 10;
          const paddingX = 14 + relativeWeight * 16;
          const palette = CLOUD_PALETTES[idx % CLOUD_PALETTES.length];
          const isTopWord = item.count === maxCount && item.count > 1;

          // Animatie vertraging voor organisch zweven
          const animDelay = (idx % 7) * 0.4;
          const animDuration = 4 + (idx % 5);

          return (
            <div
              key={item.word}
              style={{
                background: palette.bg,
                border: `1.5px solid ${palette.border}`,
                borderRadius: '999px',
                padding: `${paddingY}px ${paddingX}px`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isTopWord
                  ? `0 0 25px ${palette.border}, 0 6px 16px rgba(0,0,0,0.4)`
                  : '0 4px 14px rgba(0, 0, 0, 0.25)',
                transform: isTopWord ? 'scale(1.04)' : 'none',
                transition: 'all 0.3s ease',
                animation: `floatBubble ${animDuration}s ease-in-out ${animDelay}s infinite alternate`,
                cursor: 'default',
                userSelect: 'none'
              }}
            >
              <span style={{
                fontSize: `${fontSize}rem`,
                fontWeight: relativeWeight > 0.6 ? 800 : 700,
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                letterSpacing: '0.01em'
              }}>
                {item.word}
              </span>

              {item.count > 1 && (
                <span style={{
                  background: palette.border,
                  color: '#fff',
                  fontSize: `${Math.max(0.72, fontSize * 0.45)}rem`,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  {item.count}×
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes floatBubble {
          0% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-6px) rotate(0.5deg);
          }
          100% {
            transform: translateY(4px) rotate(-0.5deg);
          }
        }
      `}</style>
    </div>
  );
}
