import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface TierSpec {
  id: string;
  name: string;
  price: string;
  period: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  features: { name: string; included: boolean; note?: string }[];
  telemetryNotice: string;
  telemetryIsZero: boolean;
}

const TIERS: TierSpec[] = [
  {
    id: 'edu-free',
    name: 'EDU-Free',
    price: '€0',
    period: 'altijd gratis',
    badgeColor: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.15)',
    description: 'Ideaal om Locra lokaal te verkennen en testen op een individuele machine.',
    features: [
      { name: 'Lokale AI Chat & Gesprekken', included: true },
      { name: 'Lokale Modellen (Ollama / GGUF)', included: true },
      { name: 'Gebruikersbeheer & Authenticatie', included: true },
      { name: 'SlimCheck & Online Toetsen', included: false },
      { name: 'RAG Kennisbanken', included: false },
      { name: 'Limieten & Quota beheer', included: false },
      { name: 'Klassen & Groepen', included: false },
      { name: 'CodeMatch (IDE)', included: false },
      { name: 'Cryptografische Watermerk Detectie', included: false },
    ],
    telemetryNotice: 'Geanonimiseerde gebruiks- en performancestatistieken worden gedeeld met Locra.',
    telemetryIsZero: false
  },
  {
    id: 'edu-basic',
    name: 'EDU-Basic',
    price: '€50',
    period: 'per jaar',
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    description: 'Instapplan voor kleine scholen met basisfuncties en online toetsomgeving.',
    features: [
      { name: 'Lokale AI Chat & Gesprekken', included: true },
      { name: 'Lokale Modellen (Ollama / GGUF)', included: true },
      { name: 'Gebruikersbeheer & Authenticatie', included: true },
      { name: 'SlimCheck & Online Toetsen', included: true },
      { name: 'RAG Kennisbanken', included: false, note: 'Niet inbegrepen' },
      { name: 'Limieten & Quota beheer', included: false, note: 'Niet inbegrepen' },
      { name: 'Klassen & Groepen', included: false, note: 'Niet inbegrepen' },
      { name: 'CodeMatch (IDE)', included: false, note: 'Niet inbegrepen' },
      { name: 'Cryptografische Watermerk Detectie', included: false, note: 'Niet inbegrepen' },
    ],
    telemetryNotice: 'Geanonimiseerde prestatiegegevens worden gedeeld met Locra.',
    telemetryIsZero: false
  },
  {
    id: 'edu-plus',
    name: 'EDU-Plus',
    price: '€100',
    period: 'per jaar',
    badgeColor: '#818cf8',
    badgeBg: 'rgba(129, 140, 248, 0.15)',
    description: 'De standaard voor middelbare scholen met RAG, klassen, watermarking en SOMtoday.',
    features: [
      { name: 'Alles van EDU-Basic', included: true },
      { name: 'Cryptografische Watermerk Detectie', included: true, note: 'Onzichtbare zero-width' },
      { name: 'Klassen & Groepenbeheer', included: true },
      { name: 'Limieten & Quota per rol/groep', included: true },
      { name: 'RAG Kennisbanken (tot 15)', included: true },
      { name: 'SOMtoday Koppeling', included: true },
      { name: 'CodeMatch (IDE)', included: false, note: 'Vereist EDU-Premium' },
      { name: 'Locra Academy Certificaten', included: false, note: 'Vereist EDU-Premium' },
    ],
    telemetryNotice: '100% On-premise netwerkisolatie. Nul telemetrie naar externe servers.',
    telemetryIsZero: true
  },
  {
    id: 'edu-premium',
    name: 'EDU-Premium',
    price: '€250',
    period: 'per jaar',
    badgeColor: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.15)',
    description: 'Het complete pakket inclusief programmeer-IDE, onbeperkte RAG en Academy.',
    features: [
      { name: 'Alles van EDU-Plus', included: true },
      { name: 'CodeMatch (Volledige IDE & Evaluatie)', included: true },
      { name: 'Locra Academy & Certificaten', included: true },
      { name: 'Onbeperkte RAG Kennisbanken', included: true },
      { name: 'Geavanceerde Hardware Benchmarks', included: true },
      { name: 'Cryptografische Watermerk Detectie', included: true },
      { name: 'SOMtoday & Roosters', included: true },
    ],
    telemetryNotice: '100% On-premise netwerkisolatie. Nul telemetrie naar externe servers.',
    telemetryIsZero: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Op maat',
    period: 'offerte',
    badgeColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    description: 'Voor schoolbesturen en campussen met meerdere vestigingen en Entree SSO.',
    features: [
      { name: 'Alles van EDU-Premium', included: true },
      { name: 'Multi-school & Campus Management', included: true },
      { name: 'Kennisnet / Entree Federatie SSO', included: true },
      { name: 'Dedicated Cluster & Failover', included: true },
      { name: 'Maatwerk SLA & 24/7 Ondersteuning', included: true },
    ],
    telemetryNotice: '100% On-premise netwerkisolatie. Nul telemetrie naar externe servers.',
    telemetryIsZero: true
  }
];

export default function LicensePanel() {
  const token = useAuthStore(state => state.token);
  const [licenseData, setLicenseData] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Watermark interactive sandbox state
  const [sandboxText, setSandboxText] = useState(
    'De Franse Revolutie (1789-1799) was een periode van radicale sociale en politieke omwenteling in Frankrijk.\u200B\u200C\u200D\u200E\u200B'
  );
  const [showHiddenChars, setShowHiddenChars] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ hasWatermark: boolean; confidence: number } | null>(null);

  const loadLicense = () => {
    fetch('/api/settings/license', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setLicenseData(data);
          if (data.key) {
            setLicenseKeyInput(data.key);
          }
        }
      })
      .catch(err => console.error('Failed to load license', err));
  };

  useEffect(() => {
    loadLicense();
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setMessage({ type: 'error', text: 'Vul een geldige licentiesleutel in (bijv. LOCRA-W69P-6C06-7YX0).' });
      return;
    }

    setActivating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/license/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ licenseKey: licenseKeyInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Licentieactivatie mislukt');
      }

      setMessage({
        type: 'success',
        text: `✓ Licentie succesvol gekoppeld! ${data.license?.tier?.toUpperCase()} is nu actief voor ${data.license?.schoolName || 'jouw school'}.`
      });
      loadLicense();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActivating(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/network/license/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `✓ Licentie succesvol geverifieerd via api.rowmatch.nl! Plan: ${data.license?.tier?.toUpperCase()} (${data.license?.schoolName || ''}).`
        });
        loadLicense();
      } else {
        setMessage({ type: 'error', text: data.error || 'Verificatie met centrale server mislukt.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Netwerkfout bij synchronisatie: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Weet je zeker dat je de licentie wilt ontkoppelen? De server valt terug naar het gratis EDU-Free plan.')) {
      return;
    }

    try {
      const res = await fetch('/api/settings/license/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLicenseKeyInput('');
        setMessage({ type: 'success', text: 'Licentie ontkoppeld. Server draait nu op het gratis EDU-Free plan.' });
        loadLicense();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Fout bij ontkoppelen: ' + e.message });
    }
  };

  const handleVerifySandbox = async () => {
    if (!sandboxText.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/watermark/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: sandboxText })
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyResult(data);
      } else {
        alert(data.error || 'Verificatie mislukt. Mogelijk vereist dit een actieve EDU-Plus licentie.');
      }
    } catch (err: any) {
      alert('Netwerkfout bij verificatie: ' + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const activeTierRaw = licenseData?.tier || 'edu-free';
  const activeTierId = activeTierRaw === 'free' ? 'edu-free' : activeTierRaw;
  const isPaidTier = ['edu-basic', 'edu-plus', 'edu-premium', 'enterprise'].includes(activeTierId);
  const isZeroTelemetry = ['edu-plus', 'edu-premium', 'enterprise'].includes(activeTierId);

  const countZeroWidth = (text: string) => {
    const matches = text.match(/[\u200B\u200C\u200D\u200E]/g);
    return matches ? matches.length : 0;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🎓</span>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Licentie & EDU Abonnementen</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0 }}>
            Beheer de schoollicentie van Locra AI. Controleer plannen, automatische 3-maandelijkse verificatie en privacy-garanties.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to="/privacy"
            target="_blank"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🛡️</span> Privacybeleid
          </Link>
          <Link
            to="/terms"
            target="_blank"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>📜</span> Algemene Voorwaarden
          </Link>
          <Link
            to="/admin/network"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🌐</span> RowMatch Hub Status
          </Link>
        </div>
      </div>

      {message && (
        <div 
          style={{ 
            padding: '1rem 1.25rem', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: message.type === 'success' ? '#86efac' : '#fca5a5',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {/* Main License Coupling Card */}
      <div 
        className="glass-panel"
        style={{
          padding: '2.5rem',
          borderRadius: '24px',
          border: isPaidTier ? '2px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255,255,255,0.1)',
          background: isPaidTier 
            ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)' 
            : 'var(--bg-surface)',
          boxShadow: isPaidTier ? '0 16px 40px -10px rgba(99, 102, 241, 0.25)' : 'none',
          marginBottom: '2.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
                {licenseData?.hasLicense ? 'Actieve Schoollicentie' : 'Geen Licentie Gekoppeld'}
              </h2>
              <span style={{
                background: isPaidTier ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '4px 14px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {activeTierId.toUpperCase()}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {licenseData?.hasLicense 
                ? 'Deze Locra server is geautoriseerd en gekoppeld aan api.rowmatch.nl met periodieke 3-maandelijkse controle.' 
                : 'Voer een officiële licentiesleutel in om functies zoals Watermarking, Klassen & Groepen en RAG te ontgrendelen.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {licenseData?.hasLicense && (
              <>
                <button 
                  type="button" 
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {syncing ? 'Synchroniseren...' : '🔄 Synchroniseer met api.rowmatch.nl'}
                </button>
                <button 
                  type="button" 
                  onClick={handleUnlink}
                  className="btn" 
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  Ontkoppelen
                </button>
              </>
            )}
          </div>
        </div>

        {licenseData?.hasLicense ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>School / Organisatie</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{licenseData?.schoolName || 'Onderwijsinstelling'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>Licentiesleutel</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace', color: '#818cf8' }}>{licenseData?.key}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>Telemetrie & Privacy</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: isZeroTelemetry ? '#4ade80' : '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{isZeroTelemetry ? '🛡️' : '📊'}</span>
                  <span>{isZeroTelemetry ? '100% On-premise (0 Telemetrie)' : 'Geanonimiseerde feedback'}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>Volgende 3-Maandelijkse Check</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                  {licenseData?.expiresAt ? new Date(licenseData.expiresAt).toLocaleDateString('nl-NL') : 'Elke 90 dagen (+14d respijt)'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActivate} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="LOCRA-XXXX-XXXX-XXXX"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '0.9rem 1.25rem',
                fontSize: '1.1rem',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={activating}
              style={{ padding: '0.9rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              {activating ? 'Koppelen...' : '⚡ Licentie Koppelen'}
            </button>
          </form>
        )}
      </div>

      {/* 5-Tier Overview & Comparison */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Overzicht Locra AI Plannen & Functies
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Kies het plan dat aansluit bij jouw schoolorganisatie. Upgrade eenvoudig door een nieuwe sleutel in te voeren.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {TIERS.map(tier => {
            const isActive = activeTierId === tier.id;
            return (
              <div
                key={tier.id}
                className="glass-panel"
                style={{
                  padding: '1.75rem',
                  borderRadius: '20px',
                  border: isActive ? `2px solid ${tier.badgeColor}` : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(30, 41, 59, 0.6)' : 'rgba(15, 23, 42, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '16px',
                    background: tier.badgeColor,
                    color: '#000',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    letterSpacing: '0.05em'
                  }}>
                    ACTIEF PLAN
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{
                    background: tier.badgeBg,
                    color: tier.badgeColor,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '12px'
                  }}>
                    {tier.name}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>{tier.price}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>/{tier.period}</span>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.5, minHeight: '48px', margin: '0 0 1.25rem 0' }}>
                  {tier.description}
                </p>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginBottom: '1.25rem', flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Inbegrepen functies:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {tier.features.map((feat, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: feat.included ? '#f1f5f9' : 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color: feat.included ? '#4ade80' : '#ef4444', flexShrink: 0 }}>
                          {feat.included ? '✓' : '✕'}
                        </span>
                        <span>
                          {feat.name}
                          {feat.note && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: feat.included ? '#a5b4fc' : '#64748b' }}>
                              {feat.note}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Telemetry pill */}
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: tier.telemetryIsZero ? 'rgba(34, 197, 94, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                  border: `1px solid ${tier.telemetryIsZero ? 'rgba(34, 197, 94, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
                  fontSize: '0.72rem',
                  color: tier.telemetryIsZero ? '#86efac' : '#7dd3fc',
                  lineHeight: 1.4
                }}>
                  <strong>{tier.telemetryIsZero ? '🔒 0 Telemetrie:' : '📊 Verbetering:'}</strong> {tier.telemetryNotice}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Watermarking Sandbox */}
      <div 
        className="glass-panel"
        style={{
          padding: '2rem',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--bg-surface)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔬</span> Interactieve Watermerk Sandbox & Inspector
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
              Test hoe het EDU-Plus / EDU-Premium cryptografische watermerk werkt en verifieer hoe docenten dit direct kunnen detecteren.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setSandboxText('Dit is een origineel stuk tekst geschreven door een leerling zelf zonder enige hulp van AI.')}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem' }}
            >
              Tekst Zonder Watermerk
            </button>
            <button 
              type="button" 
              onClick={() => setSandboxText('Volgens de wet van behoud van energie kan energie niet verloren gaan, maar enkel worden omgezet in een andere vorm.\u200B\u200C\u200D\u200E\u200B')}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              + AI Voorbeeld Met Watermerk
            </button>
          </div>
        </div>

        <textarea
          value={sandboxText}
          onChange={(e) => setSandboxText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '1rem',
            fontFamily: 'inherit',
            marginBottom: '1rem',
            resize: 'vertical'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={() => setShowHiddenChars(!showHiddenChars)}
              style={{ 
                background: showHiddenChars ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.05)',
                color: showHiddenChars ? '#c084fc' : 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85rem'
              }}
            >
              {showHiddenChars ? '👁️ Verberg Onzichtbare Tekens' : '🔍 Inspecteer Verborgen Karakters'}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Aanwezige onzichtbare tekens: <strong style={{ color: countZeroWidth(sandboxText) > 0 ? '#4ade80' : '#aaa' }}>{countZeroWidth(sandboxText)}</strong>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleVerifySandbox}
            disabled={verifyLoading || !sandboxText.trim()}
            style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
          >
            {verifyLoading ? 'Controleren...' : '🛡️ Verifieer Watermerk'}
          </button>
        </div>

        {/* Hidden Character Visualizer */}
        {showHiddenChars && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(168, 85, 247, 0.4)' }}>
            <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Unicode Inspectie View (Zero-Width Tekens Worden Geel/Paars Weergegeven)
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', wordBreak: 'break-all', lineHeight: 1.8 }}>
              {Array.from(sandboxText).map((char, idx) => {
                const code = char.charCodeAt(0);
                if (code === 0x200B) return <span key={idx} style={{ background: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWSP:200B]</span>;
                if (code === 0x200C) return <span key={idx} style={{ background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWNJ:200C]</span>;
                if (code === 0x200D) return <span key={idx} style={{ background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWJ:200D]</span>;
                if (code === 0x200E) return <span key={idx} style={{ background: '#059669', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[LRM:200E]</span>;
                return <span key={idx}>{char}</span>;
              })}
            </div>
          </div>
        )}

        {/* Verification Result Card */}
        {verifyResult && (
          <div 
            style={{ 
              marginTop: '1.5rem',
              padding: '1.25rem', 
              borderRadius: '12px',
              background: verifyResult.hasWatermark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${verifyResult.hasWatermark ? '#22c55e' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>
              {verifyResult.hasWatermark ? '🛡️' : '❌'}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: verifyResult.hasWatermark ? '#86efac' : '#fca5a5' }}>
                {verifyResult.hasWatermark 
                  ? 'Geverifieerd: Deze tekst is gegenereerd door Locra AI (Watermerk Actief)' 
                  : 'Geen Locra Watermerk Gedetecteerd'}
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Detectie Betrouwbaarheid van detectie: <strong style={{ color: '#fff' }}>{verifyResult.confidence}%</strong> {verifyResult.hasWatermark && '— Cryptografische zero-width reeks is intact.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
