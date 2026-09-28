import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ── Types ──
interface LicenseResult {
  valid: boolean;
  tier?: string;
  schoolName?: string;
  maxUsers?: number;
  expiresAt?: string | null;
  reason?: string;
}

// ── Helpers ──
const STEPS = ['Welkom', 'Licentie', 'Organisatie', 'Beheerder', 'Voltooien'];
const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  'edu-basic': 'EDU Basic',
  'edu-plus': 'EDU Plus',
  enterprise: 'Enterprise',
};
const TIER_COLORS: Record<string, string> = {
  free: '#94a3b8',
  'edu-basic': '#22d3ee',
  'edu-plus': '#818cf8',
  enterprise: '#f59e0b',
};

// ── Component ──
export default function SetupWizard() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  // Step 1: License
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseChecking, setLicenseChecking] = useState(false);
  const [licenseResult, setLicenseResult] = useState<LicenseResult | null>(null);

  // Step 2: Organization
  const [orgName, setOrgName] = useState('');
  const [orgSlogan, setOrgSlogan] = useState('');

  // Step 3: Admin
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Finish
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [completedData, setCompletedData] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Mount: check if already setup ──
  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => {
        if (d.isSetup) navigate('/login');
        setLoading(false);
      })
      .catch(() => {
        setError('Kan de server niet bereiken. Zorg dat de backend draait op poort 6000.');
        setLoading(false);
      });
  }, [navigate]);

  // ── Auto-focus first input ──
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [step]);

  // ── License validation ──
  const validateLicense = async () => {
    if (!licenseKey.trim()) return;
    setLicenseChecking(true);
    setLicenseResult(null);

    try {
      const endpoints = [
        `https://api.rowmatch.nl/api/locra/validate/${licenseKey.trim().toUpperCase()}`,
        `http://localhost:5001/api/locra/validate/${licenseKey.trim().toUpperCase()}`
      ];
      let result: LicenseResult | null = null;

      for (const url of endpoints) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            result = await res.json();
            break;
          }
        } catch { /* try next */ }
      }

      if (result) {
        setLicenseResult(result);
        if (result.valid && result.schoolName) setOrgName(result.schoolName);
      } else {
        setLicenseResult({ valid: false, reason: 'Geen verbinding met de licentieserver. Controleer je internetverbinding.' });
      }
    } catch {
      setLicenseResult({ valid: false, reason: 'Onverwachte fout bij het valideren.' });
    } finally {
      setLicenseChecking(false);
    }
  };

  // ── Navigation ──
  const goNext = () => { setDirection('next'); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goPrev = () => { setDirection('prev'); setStep(s => Math.max(s - 1, 0)); };

  // ── Submit ──
  const handleFinish = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          orgSlogan,
          licenseKey: licenseKey.trim().toUpperCase() || undefined,
          adminUsername,
          adminEmail,
          adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup mislukt');
      setCompletedData(data);
      setSetupComplete(true);
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Validation per step ──
  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return licenseResult?.valid === true;
      case 2: return orgName.trim().length >= 2;
      case 3: return adminUsername.trim().length >= 2 && adminEmail.includes('@') && adminPassword.length >= 8;
      default: return true;
    }
  };

  // ── Loading ──
  if (loading) return (
    <div style={S.page}>
      <div style={S.loaderWrap}>
        <div style={S.spinner} />
        <p style={{ color: '#94a3b8', marginTop: 20 }}>Verbinding maken met Locra…</p>
      </div>
    </div>
  );

  // ── Completed ──
  if (setupComplete) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center', maxWidth: 480, animation: 'wzFadeScale .5s ease' }}>
        <div style={S.completedIcon}>✓</div>
        <h1 style={{ ...S.title, fontSize: '1.8rem' }}>Locra is gereed!</h1>
        <p style={S.subtitle}>Je omgeving <strong>{orgName}</strong> is succesvol geconfigureerd.</p>
        <div style={S.tierBadgeLg}>
          {TIER_LABELS[licenseResult?.tier || 'enterprise'] || 'Enterprise'} Licentie
        </div>
        <button style={S.btnPrimary} onClick={() => navigate('/admin')}>
          Naar het beheerpaneel →
        </button>
      </div>
    </div>
  );

  // ── Main Wizard ──
  return (
    <div style={S.page}>
      <style>{animations}</style>

      {/* Top brand */}
      <div style={S.brand}>
        <span style={S.brandL}>l</span>ocra
      </div>

      {/* Progress bar */}
      <div style={S.progressWrap}>
        {STEPS.map((label, i) => (
          <div key={label} style={S.progressStep}>
            <div style={{
              ...S.progressDot,
              background: i < step ? '#818cf8' : i === step ? '#c7d2fe' : 'rgba(255,255,255,0.12)',
              boxShadow: i === step ? '0 0 12px rgba(129,140,248,0.5)' : 'none',
              transform: i === step ? 'scale(1.25)' : 'scale(1)',
            }}>
              {i < step ? '✓' : ''}
            </div>
            <span style={{
              ...S.progressLabel,
              color: i <= step ? '#c7d2fe' : '#475569',
              fontWeight: i === step ? 700 : 400,
            }}>{label}</span>
            {i < STEPS.length - 1 && (
              <div style={{
                ...S.progressLine,
                background: i < step ? '#818cf8' : 'rgba(255,255,255,0.08)',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div style={S.card} key={step}>
        {error && (
          <div style={S.errorBox}>
            <span>⚠</span> {error}
            <button onClick={() => setError('')} style={S.errorClose}>×</button>
          </div>
        )}

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div style={{ animation: 'wzSlideIn .35s ease' }}>
            <div style={S.stepIcon}>🚀</div>
            <h1 style={S.title}>Welkom bij Locra</h1>
            <p style={S.subtitle}>
              Deze wizard helpt je om je private AI-omgeving in te richten. In een paar stappen configureer je je licentie, organisatie en beheerdersaccount.
            </p>
            <div style={S.featureGrid}>
              {[
                ['🔐', 'Licentie activeren', 'Koppel je Pjotters-licentie voor toegang tot alle functies.'],
                ['🏢', 'Organisatie instellen', 'Geef je school of organisatie een naam en identiteit.'],
                ['👤', 'Beheerder aanmaken', 'Maak een superadmin-account waarmee je alles kunt beheren.'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={S.featureCard}>
                  <div style={S.featureIcon}>{icon}</div>
                  <div>
                    <strong style={{ color: '#e2e8f0', fontSize: '.9rem' }}>{title}</strong>
                    <p style={{ color: '#64748b', fontSize: '.8rem', margin: '4px 0 0' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: License ── */}
        {step === 1 && (
          <div style={{ animation: 'wzSlideIn .35s ease' }}>
            <div style={S.stepIcon}>🔑</div>
            <h1 style={S.title}>Licentie activeren</h1>
            <p style={S.subtitle}>
              Voer je Pjotters-licentiesleutel in om je omgeving te activeren. Deze heb je ontvangen bij je aanvraag.
            </p>

            <div style={S.inputGroup}>
              <label style={S.label}>Licentiesleutel</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  style={{ ...S.input, flex: 1, fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
                  value={licenseKey}
                  onChange={e => { setLicenseKey(e.target.value); setLicenseResult(null); }}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  onKeyDown={e => e.key === 'Enter' && validateLicense()}
                />
                <button
                  style={{ ...S.btnSecondary, whiteSpace: 'nowrap', minWidth: 110 }}
                  onClick={validateLicense}
                  disabled={!licenseKey.trim() || licenseChecking}
                >
                  {licenseChecking ? (
                    <span style={S.btnSpinner} />
                  ) : 'Valideren'}
                </button>
              </div>
            </div>

            {/* License result */}
            {licenseResult && (
              <div style={{
                ...S.licenseResult,
                borderColor: licenseResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                background: licenseResult.valid ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              }}>
                {licenseResult.valid ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: '1.4rem' }}>✅</span>
                      <div>
                        <strong style={{ color: '#22c55e', fontSize: '1rem' }}>Licentie gevalideerd!</strong>
                        <div style={{ color: '#94a3b8', fontSize: '.8rem' }}>Verbonden met Pjotters Licentieserver</div>
                      </div>
                    </div>
                    <div style={S.licenseGrid}>
                      <div style={S.licenseItem}>
                        <span style={S.licenseLabel}>Tier</span>
                        <span style={{
                          ...S.tierBadge,
                          background: TIER_COLORS[licenseResult.tier || 'free'] + '22',
                          color: TIER_COLORS[licenseResult.tier || 'free'],
                          borderColor: TIER_COLORS[licenseResult.tier || 'free'] + '44',
                        }}>
                          {TIER_LABELS[licenseResult.tier || 'free']}
                        </span>
                      </div>
                      {licenseResult.schoolName && (
                        <div style={S.licenseItem}>
                          <span style={S.licenseLabel}>Organisatie</span>
                          <span style={{ color: '#e2e8f0' }}>{licenseResult.schoolName}</span>
                        </div>
                      )}
                      {licenseResult.maxUsers && (
                        <div style={S.licenseItem}>
                          <span style={S.licenseLabel}>Max. gebruikers</span>
                          <span style={{ color: '#e2e8f0' }}>{licenseResult.maxUsers}</span>
                        </div>
                      )}
                      {licenseResult.expiresAt && (
                        <div style={S.licenseItem}>
                          <span style={S.licenseLabel}>Verloopt</span>
                          <span style={{ color: '#e2e8f0' }}>{new Date(licenseResult.expiresAt).toLocaleDateString('nl-NL')}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>❌</span>
                    <div>
                      <strong style={{ color: '#ef4444' }}>Ongeldige licentie</strong>
                      <p style={{ color: '#94a3b8', fontSize: '.82rem', margin: '4px 0 0' }}>
                        {licenseResult.reason || 'De ingevoerde sleutel is niet herkend. Controleer de sleutel en probeer opnieuw.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Organization ── */}
        {step === 2 && (
          <div style={{ animation: 'wzSlideIn .35s ease' }}>
            <div style={S.stepIcon}>🏢</div>
            <h1 style={S.title}>Organisatie instellen</h1>
            <p style={S.subtitle}>
              Geef je organisatie een naam. {licenseResult?.schoolName
                ? 'We hebben de naam al ingevuld op basis van je licentie.'
                : 'Dit wordt zichtbaar voor alle gebruikers.'}
            </p>

            <div style={S.inputGroup}>
              <label style={S.label}>Organisatienaam *</label>
              <input
                ref={inputRef}
                style={S.input}
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Bijv. Scholengemeenschap De Toekomst"
              />
            </div>

            <div style={S.inputGroup}>
              <label style={S.label}>Slogan <span style={{ opacity: .5 }}>(optioneel)</span></label>
              <input
                style={S.input}
                value={orgSlogan}
                onChange={e => setOrgSlogan(e.target.value)}
                placeholder="Bijv. Slim leren met AI"
              />
            </div>

            <div style={S.previewBox}>
              <div style={{ fontSize: '.72rem', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Voorbeeld</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={S.previewAvatar}>{orgName ? orgName[0].toUpperCase() : '?'}</div>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem' }}>{orgName || 'Organisatienaam'}</div>
                  {orgSlogan && <div style={{ color: '#64748b', fontSize: '.82rem' }}>{orgSlogan}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Admin ── */}
        {step === 3 && (
          <div style={{ animation: 'wzSlideIn .35s ease' }}>
            <div style={S.stepIcon}>👤</div>
            <h1 style={S.title}>Beheerder aanmaken</h1>
            <p style={S.subtitle}>
              Dit wordt het superadmin-account met volledige toegang tot het beheerpaneel.
            </p>

            <div style={S.inputGroup}>
              <label style={S.label}>Gebruikersnaam *</label>
              <input
                ref={inputRef}
                style={S.input}
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div style={S.inputGroup}>
              <label style={S.label}>E-mailadres *</label>
              <input
                style={S.input}
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@school.nl"
              />
            </div>

            <div style={S.inputGroup}>
              <label style={S.label}>Wachtwoord * <span style={{ opacity: .5 }}>(min. 8 tekens)</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  style={S.input}
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••••"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={S.eyeBtn}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {adminPassword.length > 0 && (
                <div style={S.pwStrength}>
                  <div style={{
                    ...S.pwBar,
                    width: adminPassword.length >= 12 ? '100%' : adminPassword.length >= 8 ? '66%' : '33%',
                    background: adminPassword.length >= 12 ? '#22c55e' : adminPassword.length >= 8 ? '#eab308' : '#ef4444',
                  }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 4 && (
          <div style={{ animation: 'wzSlideIn .35s ease' }}>
            <div style={S.stepIcon}>📋</div>
            <h1 style={S.title}>Overzicht & voltooien</h1>
            <p style={S.subtitle}>Controleer de gegevens hieronder en rond de setup af.</p>

            <div style={S.summaryGrid}>
              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>Licentie</span>
                <span style={{ ...S.tierBadge, background: TIER_COLORS[licenseResult?.tier || 'enterprise'] + '22', color: TIER_COLORS[licenseResult?.tier || 'enterprise'], borderColor: TIER_COLORS[licenseResult?.tier || 'enterprise'] + '44' }}>
                  {TIER_LABELS[licenseResult?.tier || 'enterprise']}
                </span>
              </div>
              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>Organisatie</span>
                <span style={{ color: '#e2e8f0' }}>{orgName}</span>
              </div>
              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>Beheerder</span>
                <span style={{ color: '#e2e8f0' }}>{adminUsername} ({adminEmail})</span>
              </div>
              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>Licentiesleutel</span>
                <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '.82rem' }}>{licenseKey.toUpperCase() || '—'}</span>
              </div>
            </div>

            <button
              style={{ ...S.btnPrimary, width: '100%', marginTop: 20, fontSize: '1rem', padding: '14px 0' }}
              onClick={handleFinish}
              disabled={submitting}
            >
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={S.btnSpinner} /> Locra wordt geconfigureerd…
                </span>
              ) : '🚀 Setup voltooien'}
            </button>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        {step < 4 && (
          <div style={S.navRow}>
            {step > 0 ? (
              <button style={S.btnGhost} onClick={goPrev}>← Vorige</button>
            ) : <div />}
            <button
              style={canProceed() ? S.btnPrimary : S.btnDisabled}
              onClick={goNext}
              disabled={!canProceed()}
            >
              {step === 0 ? 'Laten we beginnen →' : 'Volgende →'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        Locra by <strong>Pjotters</strong> · Private AI Infrastructure
      </div>
    </div>
  );
}

// ── Animations ──
const animations = `
@keyframes wzSlideIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes wzFadeScale {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes wzSpin {
  to { transform: rotate(360deg); }
}
@keyframes wzPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
`;

// ── Styles ──
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(145deg, #0a0e1a 0%, #0f172a 40%, #131b2e 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
  },
  brand: {
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#e2e8f0',
    marginBottom: 28,
  },
  brandL: {
    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 900,
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginBottom: 32,
    maxWidth: 560,
    width: '100%',
  },
  progressStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.65rem',
    color: '#fff',
    fontWeight: 700,
    transition: 'all .3s ease',
    flexShrink: 0,
  },
  progressLabel: {
    fontSize: '.72rem',
    whiteSpace: 'nowrap',
    transition: 'color .3s ease',
  },
  progressLine: {
    flex: 1,
    height: 2,
    borderRadius: 2,
    marginLeft: 6,
    marginRight: 6,
    transition: 'background .3s ease',
  },
  card: {
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(99, 102, 241, 0.12)',
    borderRadius: 20,
    padding: '36px 40px',
    maxWidth: 540,
    width: '100%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  stepIcon: {
    fontSize: '2.4rem',
    marginBottom: 8,
  },
  title: {
    color: '#e2e8f0',
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '.9rem',
    lineHeight: 1.6,
    margin: '0 0 24px',
  },
  featureGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  featureCard: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: '1.4rem',
    flexShrink: 0,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    color: '#94a3b8',
    fontSize: '.8rem',
    fontWeight: 600,
    marginBottom: 6,
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: '.92rem',
    outline: 'none',
    transition: 'border-color .2s ease, box-shadow .2s ease',
    boxSizing: 'border-box',
  },
  licenseResult: {
    border: '1px solid',
    borderRadius: 14,
    padding: '18px 20px',
    marginTop: 16,
    animation: 'wzFadeScale .3s ease',
  },
  licenseGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 20px',
  },
  licenseItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  licenseLabel: {
    fontSize: '.72rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tierBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: '.78rem',
    fontWeight: 700,
    border: '1px solid',
  },
  tierBadgeLg: {
    display: 'inline-block',
    padding: '8px 20px',
    borderRadius: 10,
    fontSize: '.9rem',
    fontWeight: 700,
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
    marginBottom: 24,
  },
  previewBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '16px 20px',
    marginTop: 8,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.2rem',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 4,
  },
  pwStrength: {
    height: 4,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  pwBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width .3s ease, background .3s ease',
  },
  summaryGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '13px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '.88rem',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: '.82rem',
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    gap: 12,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    border: 'none',
    padding: '11px 24px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '.88rem',
    cursor: 'pointer',
    transition: 'opacity .2s, transform .15s',
  },
  btnSecondary: {
    background: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.25)',
    padding: '11px 18px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '.88rem',
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    padding: '11px 18px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '.88rem',
    cursor: 'pointer',
  },
  btnDisabled: {
    background: 'rgba(255,255,255,0.05)',
    color: '#475569',
    border: 'none',
    padding: '11px 24px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '.88rem',
    cursor: 'not-allowed',
  },
  btnSpinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.25)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'wzSpin .6s linear infinite',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10,
    color: '#fca5a5',
    fontSize: '.85rem',
    marginBottom: 18,
  },
  errorClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    fontSize: '1.1rem',
    cursor: 'pointer',
  },
  completedIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '2rem',
    fontWeight: 800,
    margin: '0 auto 20px',
  },
  loaderWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(99,102,241,0.2)',
    borderTopColor: '#818cf8',
    borderRadius: '50%',
    animation: 'wzSpin .8s linear infinite',
  },
  footer: {
    color: '#334155',
    fontSize: '.75rem',
    marginTop: 32,
    letterSpacing: '0.02em',
  },
};
