import React from 'react';

interface PlayfulLiveBackdropProps {
  accentColor?: string;
}

const FLOATING_SHAPES = [
  { symbol: '▲', color: 'rgba(255, 71, 87, 0.18)', top: '12%', left: '8%', size: '2.4rem', duration: '11s', delay: '0s' },
  { symbol: '◆', color: 'rgba(56, 189, 248, 0.18)', top: '22%', left: '84%', size: '2.8rem', duration: '13s', delay: '1.2s' },
  { symbol: '●', color: 'rgba(250, 204, 21, 0.16)', top: '68%', left: '10%', size: '2.2rem', duration: '9s', delay: '0.7s' },
  { symbol: '■', color: 'rgba(16, 185, 129, 0.18)', top: '76%', left: '82%', size: '2.5rem', duration: '14s', delay: '2s' },
  { symbol: '✦', color: 'rgba(192, 132, 252, 0.22)', top: '42%', left: '6%', size: '2rem', duration: '10s', delay: '1.8s' },
  { symbol: '★', color: 'rgba(244, 114, 182, 0.18)', top: '48%', left: '90%', size: '2.1rem', duration: '12s', delay: '0.4s' },
  { symbol: '⚡', color: 'rgba(251, 191, 36, 0.14)', top: '86%', left: '46%', size: '2rem', duration: '15s', delay: '2.5s' },
  { symbol: '☁️', color: 'rgba(147, 197, 253, 0.14)', top: '10%', left: '48%', size: '2.4rem', duration: '16s', delay: '1s' }
];

export default function PlayfulLiveBackdrop({ accentColor = '#7c5cfc' }: PlayfulLiveBackdropProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        background: 'linear-gradient(155deg, #131136 0%, #0d1633 48%, #091b2a 100%)'
      }}
    >
      {/* Speelse Lichtbollen / Aurora */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-15%',
        width: '55vw',
        height: '55vw',
        maxWidth: '520px',
        maxHeight: '520px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}38 0%, transparent 70%)`,
        filter: 'blur(40px)',
        animation: 'auroraDrift 12s ease-in-out infinite alternate'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-18%',
        right: '-12%',
        width: '60vw',
        height: '60vw',
        maxWidth: '560px',
        maxHeight: '560px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%)',
        filter: 'blur(45px)',
        animation: 'auroraDrift 15s ease-in-out infinite alternate-reverse'
      }} />
      <div style={{
        position: 'absolute',
        top: '35%',
        right: '15%',
        width: '38vw',
        height: '38vw',
        maxWidth: '340px',
        maxHeight: '340px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.16) 0%, transparent 70%)',
        filter: 'blur(38px)',
        animation: 'auroraDrift 18s ease-in-out infinite alternate'
      }} />

      {/* Subtiel speels stippelraster */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.06) 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
        opacity: 0.65
      }} />

      {/* Zwevende Arcade Symbolen */}
      {FLOATING_SHAPES.map((s, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: s.color,
            fontWeight: 900,
            userSelect: 'none',
            animation: `playfulFloat ${s.duration} ease-in-out ${s.delay} infinite alternate`
          }}
        >
          {s.symbol}
        </div>
      ))}

      <style>{`
        @keyframes auroraDrift {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -25px) scale(1.12); }
        }
        @keyframes playfulFloat {
          0% { transform: translateY(0px) rotate(-8deg) scale(1); }
          50% { transform: translateY(-20px) rotate(10deg) scale(1.08); }
          100% { transform: translateY(8px) rotate(-4deg) scale(0.96); }
        }
      `}</style>
    </div>
  );
}
