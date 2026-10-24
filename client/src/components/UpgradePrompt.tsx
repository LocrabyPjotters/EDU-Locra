import React from 'react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  featureName: string;
  icon?: string;
  description: string;
  requiredTier: 'edu-plus' | 'edu-premium' | 'enterprise';
  benefits: string[];
}

const TIER_LABELS: Record<string, { label: string; color: string; bg: string; price: string }> = {
  'edu-plus': { label: 'EDU Plus', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', price: '€100 / jaar' },
  'edu-premium': { label: 'EDU Premium', color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)', price: '€250 / jaar' },
  'enterprise': { label: 'Enterprise', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', price: 'Op Maat' },
};

export default function UpgradePrompt({
  featureName,
  icon = '🔒',
  description,
  requiredTier,
  benefits
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const tierInfo = TIER_LABELS[requiredTier] || TIER_LABELS['edu-plus'];

  return (
    <div style={{
      maxWidth: '750px',
      margin: '2rem auto',
      padding: '2.5rem',
      borderRadius: '24px',
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '-80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '300px',
        height: '200px',
        background: `radial-gradient(circle, ${tierInfo.color}30 0%, transparent 70%)`,
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      {/* Icon badge */}
      <div style={{
        width: '64px',
        height: '64px',
        margin: '0 auto 1.25rem',
        borderRadius: '18px',
        background: tierInfo.bg,
        border: `1px solid ${tierInfo.color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        boxShadow: `0 0 30px ${tierInfo.color}25`
      }}>
        {icon}
      </div>

      {/* Tier requirement pill */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 14px', borderRadius: '20px', background: tierInfo.bg, border: `1px solid ${tierInfo.color}50`, color: tierInfo.color, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        <span>👑</span> Beschikbaar vanaf {tierInfo.label} ({tierInfo.price})
      </div>

      {/* Heading & description */}
      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 0.75rem' }}>
        {featureName} is vergrendeld
      </h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '580px', margin: '0 auto 1.75rem' }}>
        {description}
      </p>

      {/* Benefits checklist */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        padding: '1.25rem 1.75rem',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: '2rem',
        textAlign: 'left'
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Wat krijg je met {tierInfo.label}?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.6rem' }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: '#e2e8f0' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/admin/license')}
          style={{
            background: `linear-gradient(135deg, ${tierInfo.color}, #3b82f6)`,
            color: '#000',
            fontWeight: 800,
            fontSize: '0.95rem',
            padding: '0.85rem 1.75rem',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 0 25px ${tierInfo.color}40`,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>⚡</span> Upgrade Licentie of Koppel Sleutel
        </button>

        <button
          onClick={() => navigate('/admin/network')}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            fontWeight: 600,
            fontSize: '0.95rem',
            padding: '0.85rem 1.5rem',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Netwerk & Status
        </button>
      </div>
    </div>
  );
}
