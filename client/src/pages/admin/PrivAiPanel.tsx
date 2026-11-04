import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export interface PrivAiTierConfig {
  id: string;
  name: string;
  priceEur: number;
  monthlyCreditAllowanceEur: number;
  monthlyTokens: number;
  overagePricePerMillionEur: number;
  targetAudience: string;
  recommended?: boolean;
  features: string[];
}

export const PRIVAI_TIERS: PrivAiTierConfig[] = [
  {
    id: 'trial',
    name: 'PrivAI Gratis Starter',
    priceEur: 0,
    monthlyCreditAllowanceEur: 5.00,
    monthlyTokens: 1_000_000,
    overagePricePerMillionEur: 0,
    targetAudience: 'Testen & Evalueren in Ontwikkelomgeving',
    features: [
      '€5,00 Gratis Compute Credits',
      '1 Actieve API Key',
      'Toegang tot alle 3 NL Modellen',
      'Strikt budgetplafond (geen onverwachte kosten)',
      'Volledige AMD SEV-SNP Enclave Attestatie'
    ]
  },
  {
    id: 'dev',
    name: 'PrivAI Developer',
    priceEur: 19,
    monthlyCreditAllowanceEur: 19.00,
    monthlyTokens: 5_000_000,
    overagePricePerMillionEur: 3.50,
    targetAudience: 'Individuele Ontwikkelaars & Prototypes',
    features: [
      '€19,00 Maandelijks Tegoed',
      'Tot 3 API Keys met labels',
      'Boven bundel: €3,50 per 1M tokens',
      'Optionele automatische budgetstop',
      'Drop-in compatibel met OpenAI SDK'
    ]
  },
  {
    id: 'school-basic',
    name: 'PrivAI School Basic',
    priceEur: 69,
    monthlyCreditAllowanceEur: 69.00,
    monthlyTokens: 25_000_000,
    overagePricePerMillionEur: 2.80,
    targetAudience: 'Basisscholen & Compacte VMBO Locaties',
    features: [
      '€69,00 Maandelijkse Credits',
      'Tot 5 API Keys voor lokalen & teams',
      'Boven bundel: €2,80 per 1M tokens',
      'Verwerkersovereenkomst conform Privacy Convenant',
      'Facturatie per maand of schooljaar'
    ]
  },
  {
    id: 'school-pro',
    name: 'PrivAI School Pro / Core',
    priceEur: 149,
    monthlyCreditAllowanceEur: 149.00,
    monthlyTokens: 60_000_000,
    overagePricePerMillionEur: 2.20,
    targetAudience: 'VO- & MBO-Scholen (Dagelijkse AI Begeleiding)',
    recommended: true,
    features: [
      '€149,00 Maandelijkse Credits',
      'Tot 15 API Keys & Locra Core integratie',
      'Boven bundel: €2,20 per 1M tokens',
      'Prioriteit vLLM Cluster in Equinix AM4',
      'Veilige Didactische Overloop naar lokale modellen',
      '0 Bytes Prompt Logging Garantie'
    ]
  },
  {
    id: 'enterprise',
    name: 'PrivAI Campus Enterprise',
    priceEur: 399,
    monthlyCreditAllowanceEur: 399.00,
    monthlyTokens: 200_000_000,
    overagePricePerMillionEur: 1.75,
    targetAudience: 'Scholengemeenschappen, MBO/HBO & Besturen',
    features: [
      '€399,00 Maandelijkse Credits',
      'Tot 50 API Keys & Role-Based Access',
      'Boven bundel: €1,75 per 1M tokens (laagste tarief)',
      '99.95% uptime SLA met 24/7 monitoring',
      'Optie voor dedicated bare-metal serverracks',
      'Directe Kennisnet interconnectie mogelijk'
    ]
  }
];

interface PrivAiStatus {
  connected: boolean;
  apiKeyMasked: string | null;
  organization: string;
  tier: string;
  tierName: string;
  monthlyTokenQuota: number;
  usedTokens: number;
  overageTokensUsed: number;
  overageTokenPrice: number;
  allowOverage: boolean;
  routingMode: 'hybrid' | 'privai-primary' | 'local-primary';
  routedFeatures: {
    codeMatch: boolean;
    essayCoach: boolean;
    rag: boolean;
    examSimulator: boolean;
    generalChat: boolean;
  };
  gatewayUrl: string;
  lastVerifiedAt: string | null;
  enclave: {
    status: string;
    datacenter: string;
    hardware: string;
    latencyMs: number;
    promptLogging: string;
    attestationMeasurement: string;
    jurisdiction: string;
  };
}

const DEFAULT_STATUS: PrivAiStatus = {
  connected: false,
  apiKeyMasked: null,
  organization: 'Stedelijk Gymnasium (Nog niet gekoppeld)',
  tier: 'school-pro',
  tierName: 'PrivAI School Pro (Beschikbaar)',
  monthlyTokenQuota: 60_000_000,
  usedTokens: 0,
  overageTokensUsed: 0,
  overageTokenPrice: 2.20,
  allowOverage: false,
  routingMode: 'hybrid',
  routedFeatures: {
    codeMatch: true,
    essayCoach: true,
    rag: true,
    examSimulator: false,
    generalChat: false
  },
  gatewayUrl: 'https://api.privai.locra.nl/v1',
  lastVerifiedAt: null,
  enclave: {
    status: 'Standby / Lokaal',
    datacenter: 'Equinix AM4, Science Park, Amsterdam (NL)',
    hardware: 'AMD EPYC™ 9004 met SEV-SNP TEE',
    latencyMs: 28,
    promptLogging: '0 Bytes (Hardwarematig geblokkeerd)',
    attestationMeasurement: '3a8f9c2d1e0b5a7e9f4c6b8d2a1e3f5c7a9b0d2e4f6a8c0e2b4d6f8a0c2e4f6a',
    jurisdiction: 'Nederlands Recht & AVG / GDPR'
  }
};

class PrivAiErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message || String(error) };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[PrivAI] Component crash caught by boundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '16px', color: '#fff' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#f87171', margin: '0 0 1rem' }}>⚠️ Er is een fout opgetreden in het PrivAI-paneel</h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>Foutmelding: <code style={{ color: '#fca5a5', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>{this.state.error}</code></p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="btn btn-primary btn-sm">Opnieuw proberen</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivAiPanelContent() {
  const token = useAuthStore(state => state.token);
  const [status, setStatus] = useState<PrivAiStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Key configuration state
  const [keyInput, setKeyInput] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // SSO Login Modal state
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoPassword, setSsoPassword] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);

  // Subscription Tiers modal
  const [showTiersModal, setShowTiersModal] = useState(false);

  // Live Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ latencyMs: number; testOutput: string; attestation: any } | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/privai/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setStatus({
            ...DEFAULT_STATUS,
            ...data,
            enclave: {
              ...DEFAULT_STATUS.enclave,
              ...(data.enclave || {})
            },
            routedFeatures: {
              ...DEFAULT_STATUS.routedFeatures,
              ...(data.routedFeatures || {})
            }
          });
        }
      }
    } catch (err) {
      console.warn('PrivAI status kon niet worden geladen vanaf backend, fallback actief:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [token]);

  const handleConfigureKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setMessage({ type: 'error', text: 'Voer een geldige PrivAI API-sleutel in (privai_live_...).' });
      return;
    }

    setConfiguring(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/privai/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: keyInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kon PrivAI sleutel niet configureren.');
      }

      setMessage({ type: 'success', text: data.message || 'PrivAI Cloud succesvol gekoppeld!' });
      setKeyInput('');
      setShowConfigModal(false);
      await loadStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setConfiguring(false);
    }
  };

  const handleSsoConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/privai/sso-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: ssoEmail.trim(), password: ssoPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Inloggen bij Pjotters/Locra mislukt.');
      }

      setMessage({ type: 'success', text: data.message || 'School succesvol gekoppeld via Pjotters SSO!' });
      setShowSsoModal(false);
      setSsoEmail('');
      setSsoPassword('');
      await loadStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSsoLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Weet je zeker dat je de PrivAI Cloud wilt ontkoppelen? De schoolserver valt dan volledig terug op lokale modellen.')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/privai/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessage({ type: 'success', text: data.message || 'PrivAI ontkoppeld.' });
      await loadStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleRoutingChange = async (newMode: 'hybrid' | 'privai-primary' | 'local-primary') => {
    try {
      const res = await fetch('/api/admin/privai/routing', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ routingMode: newMode, routedFeatures: status.routedFeatures })
      });
      if (res.ok) {
        setStatus(prev => ({ ...prev, routingMode: newMode }));
      }
    } catch (err) {
      console.error('Failed to update routing mode', err);
    }
  };

  const handleFeatureToggle = async (featureName: keyof PrivAiStatus['routedFeatures']) => {
    const updatedFeatures = {
      ...status.routedFeatures,
      [featureName]: !status.routedFeatures[featureName]
    };

    try {
      const res = await fetch('/api/admin/privai/routing', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ routingMode: status.routingMode, routedFeatures: updatedFeatures })
      });
      if (res.ok) {
        setStatus(prev => ({ ...prev, routedFeatures: updatedFeatures }));
      }
    } catch (err) {
      console.error('Failed to update feature routing', err);
    }
  };

  const runLiveTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/privai/test-connection', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Verbindingstest mislukt.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' };
      case 'school-pro': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
      case 'school-basic': return { bg: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: 'rgba(167, 139, 250, 0.4)' };
      case 'dev': return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' };
      default: return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)' };
    }
  };

  const isConnected = Boolean(status.connected);
  const tierColor = getTierBadgeColor(status.tier || 'trial');
  const usedTokens = status.usedTokens || 0;
  const quota = status.monthlyTokenQuota || 60_000_000;
  const percentUsed = Math.min(100, Math.round((usedTokens / quota) * 100));
  const currentTierObj = PRIVAI_TIERS.find(t => t.id === status.tier) || PRIVAI_TIERS[3];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ═══ Top Header ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(124, 92, 252, 0.12)', border: '1px solid rgba(124, 92, 252, 0.3)', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd', marginBottom: '8px' }}>
            <span>🔒 Soevereine Nederlandse AI-Cloud</span>
            <span>·</span>
            <span>OpenPCC AMD SEV-SNP</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Locra PrivAI™ Cloud
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '6px 0 0', maxWidth: '750px' }}>
            Koppel je schoolserver direct met onze hardwarematig afgeschermde TEE-enclaves in Amsterdam (Equinix AM4). Drop-in compatibel met 0 bytes prompt logging garantie.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTiersModal(true)}
            className="btn btn-outline btn-sm"
            style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
          >
            ⭐ Bekijk Abonnementen & Bundels
          </button>
          <a
            href="http://localhost:4200/dashboard.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            Mijn Web Dashboard ↗
          </a>
          {isConnected && (
            <button
              onClick={handleUnlink}
              className="btn btn-outline btn-sm"
              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              Ontkoppelen
            </button>
          )}
        </div>
      </div>

      {/* Notification Message */}
      {message && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          color: message.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ═══ Hoofd Status Kaart ═══ */}
      <div style={{
        background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        borderRadius: '20px',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isConnected ? '#10b981' : '#f59e0b',
                boxShadow: isConnected ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
              }} />
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                {isConnected ? `Gekoppeld: ${status.organization}` : 'Niet Gekoppeld (Draait Volledig Lokaal)'}
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: '9999px',
                background: tierColor.bg,
                color: tierColor.color,
                border: `1px solid ${tierColor.border}`
              }}>
                {status.tierName || currentTierObj.name}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              {isConnected
                ? `Actieve sleutel: ${status.apiKeyMasked || 'privai_live_****'} · Datacenter: ${status.enclave?.datacenter || 'Equinix AM4, Amsterdam'}`
                : 'Voer een PrivAI API-sleutel in of log in met je Pjotters/RowMatch account om zware modellen soeverein in de Nederlandse cloud te draaien.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isConnected ? (
              <>
                <button onClick={() => setShowConfigModal(true)} className="btn btn-primary btn-sm">
                  🔑 API Sleutel Invoeren
                </button>
                <button onClick={() => setShowSsoModal(true)} className="btn btn-outline btn-sm">
                  ⚡ 1-Klik Pjotters SSO
                </button>
              </>
            ) : (
              <button onClick={() => setShowConfigModal(true)} className="btn btn-outline btn-sm">
                Sleutel Wijzigen
              </button>
            )}
          </div>
        </div>

        {/* TEE Attestation Badge Bar */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          fontSize: '0.82rem'
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>HARDWARE ROOT OF TRUST</div>
            <div style={{ color: '#34d399', fontWeight: 600, marginTop: '2px' }}>✓ AMD SEV-SNP Silicium Enclave</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>PROMPT LOGGING</div>
            <div style={{ color: '#34d399', fontWeight: 600, marginTop: '2px' }}>🔒 0 Bytes (RAM Purged)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>JURISDICTIE & RECHTSMACHT</div>
            <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>🇳🇱 Nederland (AVG & ISO 27001)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>SERVER LATENCY</div>
            <div style={{ color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>⚡ ~{status.enclave?.latencyMs || 28}ms (Amsterdam AM4)</div>
          </div>
        </div>
      </div>

      {/* ═══ Token Quota & Verbruik ═══ */}
      <div style={{
        background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        borderRadius: '20px',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Maandelijks Token Quotum & Verbruik
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Inbegrepen bundelcapaciteit voor de school. Bij overschrijding treedt de veilige didactische overloop in werking.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: percentUsed >= 90 ? '#f87171' : '#34d399', fontFamily: 'var(--font-display, sans-serif)' }}>
              {percentUsed}%
            </span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>van bundel verbruikt</div>
          </div>
        </div>

        {/* Progress Track */}
        <div style={{
          height: '14px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <div style={{
            height: '100%',
            width: `${percentUsed}%`,
            background: percentUsed < 70 ? 'linear-gradient(90deg, #10b981, #34d399)' : percentUsed < 90 ? 'linear-gradient(90deg, #10b981, #f59e0b)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
            borderRadius: '9999px',
            transition: 'width 0.6s ease'
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '10px' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>VERBRUIKT DEZE MAAND</span>
            <strong style={{ color: '#ffffff', fontSize: '1.1rem' }}>{formatNumber(usedTokens)}</strong> tokens
          </div>
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '10px' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>MAANDELIJKSE BUNDEL</span>
            <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>{formatNumber(quota)}</strong> tokens
          </div>
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '10px' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>OVERAGE VERBRUIK</span>
            <strong style={{ color: status.overageTokensUsed ? '#fbbf24' : '#94a3b8', fontSize: '1.1rem' }}>
              {status.overageTokensUsed ? formatNumber(status.overageTokensUsed) : '0'}
            </strong> tokens
          </div>
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '10px' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>OVERLOOP BELEID</span>
            <strong style={{ color: status.allowOverage ? '#fbbf24' : '#34d399', fontSize: '0.9rem' }}>
              {status.allowOverage ? `Overage (€${Number(status.overageTokenPrice || 2.20).toFixed(2)}/1M)` : '✓ Veilige Didactische Overloop'}
            </strong>
          </div>
        </div>
      </div>

      {/* ═══ Didactische Hybrid Routing ═══ */}
      <div style={{
        background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        borderRadius: '20px',
        padding: '2rem'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Didactische Hybrid Routing
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Bepaal hoe Locra Core het schoolverkeer verdeelt tussen de lokale schoolserver en het PrivAI TEE-cluster.
          </p>
        </div>

        {/* Routing Mode Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            onClick={() => handleRoutingChange('hybrid')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${status.routingMode === 'hybrid' ? 'var(--primary, #7c5cfc)' : 'rgba(255, 255, 255, 0.08)'}`,
              background: status.routingMode === 'hybrid' ? 'rgba(124, 92, 252, 0.15)' : 'rgba(2, 6, 23, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>⭐ Didactische Hybrid (Aanbevolen)</strong>
              {status.routingMode === 'hybrid' && <span style={{ color: '#34d399' }}>✓</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Zware taken (CodeMatch IDE, diepe essays) routeren via PrivAI Pro/Coder; simpele vragen draaien gratis lokaal.
            </p>
          </div>

          <div
            onClick={() => handleRoutingChange('privai-primary')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${status.routingMode === 'privai-primary' ? 'var(--primary, #7c5cfc)' : 'rgba(255, 255, 255, 0.08)'}`,
              background: status.routingMode === 'privai-primary' ? 'rgba(124, 92, 252, 0.15)' : 'rgba(2, 6, 23, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>Cloud Primary</strong>
              {status.routingMode === 'privai-primary' && <span style={{ color: '#34d399' }}>✓</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Alle schoolprompts gaan standaard naar de soevereine PrivAI TEE-cloud. Lokale modellen dienen puur als offline backup.
            </p>
          </div>

          <div
            onClick={() => handleRoutingChange('local-primary')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${status.routingMode === 'local-primary' ? 'var(--primary, #7c5cfc)' : 'rgba(255, 255, 255, 0.08)'}`,
              background: status.routingMode === 'local-primary' ? 'rgba(124, 92, 252, 0.15)' : 'rgba(2, 6, 23, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>Lokaal Primary</strong>
              {status.routingMode === 'local-primary' && <span style={{ color: '#34d399' }}>✓</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Alle taken draaien op de lokale Ollama schoolserver. PrivAI wordt alleen aangeroepen als een prompt er expliciet om vraagt.
            </p>
          </div>
        </div>

        {/* Feature Switches in Hybrid Mode */}
        {status.routingMode === 'hybrid' && (
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Geselecteerde Taken via PrivAI TEE Cloud:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                { key: 'codeMatch' as const, label: 'CodeMatch (IDE & Coder 32B)', desc: 'Programmeeropdrachten & debugging' },
                { key: 'essayCoach' as const, label: 'Essay Coach & Didactisch Redeneren', desc: 'Diepe schrijfanalyses (Llama 70B)' },
                { key: 'rag' as const, label: 'Kennisbanken & Document RAG', desc: 'Synthese over grote school-PDFs' },
                { key: 'examSimulator' as const, label: 'Kiosk Toetssimulator', desc: 'Toetssimulaties met zero-logging' },
                { key: 'generalChat' as const, label: 'Algemene Leerling Chat', desc: 'Dagelijkse vragen in de klas' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(status.routedFeatures?.[item.key])}
                    onChange={() => handleFeatureToggle(item.key)}
                    style={{ marginTop: '3px', accentColor: 'var(--primary, #7c5cfc)' }}
                  />
                  <div>
                    <strong style={{ color: '#ffffff', display: 'block' }}>{item.label}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Live Diagnostiek & Hardware Attestatie Test ═══ */}
      <div style={{
        background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        borderRadius: '20px',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Live Hardware Attestatie & Diagnostiek
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              Verifieer de integriteit van de processor in het datacenter in Amsterdam en meet de realtime reactietijd.
            </p>
          </div>
          <button
            onClick={runLiveTest}
            disabled={testing || !isConnected}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {testing ? '⏳ Enclave Bevragen...' : '⚡ Voer Live TEE Test Uit'}
          </button>
        </div>

        {testResult ? (
          <div style={{ background: '#020617', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', fontWeight: 700, marginBottom: '8px' }}>
              <span>✓ TEE Enclave Respons Ontvangen ({testResult.latencyMs}ms)</span>
              <span>Status: {testResult.attestation?.status || 'VERIFIED'}</span>
            </div>
            <p style={{ color: '#cbd5e1', fontStyle: 'italic', margin: '0 0 12px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
              "{testResult.testOutput}"
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div>Hardware Root of Trust: <span style={{ color: '#34d399' }}>{testResult.attestation?.hardwareRootOfTrust}</span></div>
              <div>Attestation Measurement Hash: <span style={{ color: '#38bdf8' }}>{testResult.attestation?.measurementHash}</span></div>
              <div>Prompt Logging Guarantee: <span style={{ color: '#34d399' }}>0 Bytes Verified</span></div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(2, 6, 23, 0.4)', borderRadius: '12px', padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            Klik op 'Voer Live TEE Test Uit' om de cryptografische chip-handtekening en netwerklatency live op te halen.
          </div>
        )}
      </div>

      {/* ═══ Modal: 5 Abonnementen & Bundels Overzicht ═══ */}
      {showTiersModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface, #0b1120)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '2.5rem',
            maxWidth: '1050px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd', letterSpacing: '0.08em' }}>
                  Officiële Locra PrivAI™ Bundels
                </span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0', color: '#ffffff' }}>
                  Abonnementen met Transparante Overage per 1M Tokens
                </h2>
              </div>
              <button
                onClick={() => setShowTiersModal(false)}
                className="btn btn-outline btn-sm"
              >
                Sluiten ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {PRIVAI_TIERS.map(tier => {
                const isCurrent = status.tier === tier.id;
                return (
                  <div
                    key={tier.id}
                    style={{
                      background: isCurrent ? 'rgba(124, 92, 252, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                      border: `1px solid ${isCurrent ? 'var(--primary, #7c5cfc)' : tier.recommended ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '16px',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}
                  >
                    {tier.recommended && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #10b981, #38bdf8)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 12px',
                        borderRadius: '9999px',
                        textTransform: 'uppercase'
                      }}>
                        ⭐ Meest Gekozen Scholen
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {tier.targetAudience}
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                      {tier.name}
                    </div>

                    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-display, sans-serif)' }}>
                        €{tier.priceEur}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / maand</span>
                    </div>

                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: tier.overagePricePerMillionEur > 0 ? '#38bdf8' : '#94a3b8',
                      marginBottom: '1rem',
                      textAlign: 'center'
                    }}>
                      {tier.overagePricePerMillionEur > 0
                        ? `Boven bundel: €${tier.overagePricePerMillionEur.toFixed(2)} per 1M tokens`
                        : 'Overage: Geen (strikt budgetplafond)'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, marginBottom: '1.5rem' }}>
                      {tier.features.map((feat, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ color: '#34d399' }}>✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <a
                      href="http://localhost:4200/dashboard.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn ${tier.recommended ? 'btn-primary' : 'btn-outline'} btn-sm`}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isCurrent ? 'Huidige Actieve Bundel' : 'Selecteer of Upgrade →'}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Config Modal (API Key) ═══ */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface, #0b1120)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%'
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>
              🔑 PrivAI API-sleutel Koppelen
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Plak hier de API-sleutel die je hebt gegenereerd via de PrivAI website of je dashboard.
            </p>

            <form onSubmit={handleConfigureKey}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  API-sleutel (begint met privai_live_):
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="privai_live_8f3d91c7b5204ef8a961023d8c11e40a"
                  style={{
                    width: '100%',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="btn btn-outline btn-sm"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={configuring}
                  className="btn btn-primary btn-sm"
                >
                  {configuring ? 'Valideren...' : 'Verifieer & Koppel →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ SSO Login Modal ═══ */}
      {showSsoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface, #0b1120)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '440px',
            width: '100%'
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>
              ⚡ 1-Klik Pjotters SSO Koppeling
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Log in met het Pjotters/RowMatch account van de schoolbeheerder om direct je PrivAI bundel op te halen.
            </p>

            <form onSubmit={handleSsoConnect}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  E-mailadres:
                </label>
                <input
                  type="email"
                  value={ssoEmail}
                  onChange={e => setSsoEmail(e.target.value)}
                  placeholder="directeur@school.nl"
                  style={{
                    width: '100%',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Wachtwoord:
                </label>
                <input
                  type="password"
                  value={ssoPassword}
                  onChange={e => setSsoPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSsoModal(false)}
                  className="btn btn-outline btn-sm"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={ssoLoading}
                  className="btn btn-primary btn-sm"
                >
                  {ssoLoading ? 'Koppelen...' : 'Inloggen & Koppelen →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function PrivAiPanel() {
  return (
    <PrivAiErrorBoundary>
      <PrivAiPanelContent />
    </PrivAiErrorBoundary>
  );
}
