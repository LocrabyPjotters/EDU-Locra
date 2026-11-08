import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Zap,
  Shield,
  Brain,
  KeyRound,
  Mail,
  Database,
  Search,
  Save,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  Lock,
  Globe,
  Layers,
  Cpu,
  GraduationCap,
  Clock
} from 'lucide-react';

// ── Herbruikbare Sub-componenten ─────────────────────────────────────────────

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  locked = false,
  lockedMsg = '',
  badge = ''
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
  lockedMsg?: string;
  badge?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '1.25rem',
      padding: '1.1rem 1.25rem',
      background: 'rgba(255, 255, 255, 0.025)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      transition: 'background 0.2s ease, border-color 0.2s ease'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.92rem',
          color: locked ? 'rgba(255, 255, 255, 0.45)' : 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <span>{label}</span>
          {badge && (
            <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              {badge}
            </span>
          )}
          {locked && (
            <span style={{ fontSize: '0.68rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              EDU PLUS
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem', lineHeight: 1.5 }}>
            {locked && lockedMsg ? lockedMsg : description}
          </div>
        )}
      </div>

      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => !locked && onChange(e.target.checked)}
          disabled={locked}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute',
          cursor: locked ? 'not-allowed' : 'pointer',
          top: 0, left: 0, right: 0, bottom: 0,
          background: checked && !locked ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          transition: 'all 0.25s ease'
        }}>
          <span style={{
            position: 'absolute',
            height: '18px',
            width: '18px',
            left: checked ? '22px' : '3px',
            bottom: '3px',
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.25s ease',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }} />
        </span>
      </label>
    </div>
  );
}

function SettingInput({
  label,
  description,
  value,
  onChange,
  type = 'text',
  placeholder = ''
}: {
  label: string;
  description?: string;
  value: string | number;
  onChange: (v: any) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
        {label}
      </label>
      <input
        type={type}
        className="input-field"
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? (parseInt(e.target.value) || null) : e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.65rem 0.9rem',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.22)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'var(--text-primary)',
          fontSize: '0.88rem',
          boxSizing: 'border-box',
          outline: 'none'
        }}
      />
      {description && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.45 }}>
          {description}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children
}: {
  icon: string | React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '18px',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      marginBottom: '1.25rem'
    }}>
      <div style={{ paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          <span style={{ fontSize: '1.25rem' }}>{icon}</span> {title}
        </h3>
        {description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.35rem', marginBottom: 0, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── GitHub Backup Section Component ──────────────────────────────────────────

function GithubBackupSection({ token, showToast }: { token: string; showToast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = React.useState({ repoOwner: '', repoName: '', ghToken: '', branch: 'main' });
  const [pushing, setPushing] = React.useState(false);
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.repoOwner || !form.repoName || !form.ghToken) {
      showToast('error', '❌ Vul repohouder, reponaam en GitHub token in');
      return;
    }
    setPushing(true);
    try {
      const res = await fetch('/api/admin/backup/push-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const d = await res.json();
      if (!res.ok) showToast('error', '❌ ' + d.error);
      else showToast('success', '🐙 ' + d.message);
    } catch {
      showToast('error', '❌ Netwerkfout bij GitHub push');
    } finally {
      setPushing(false);
    }
  };

  return (
    <form onSubmit={handlePush} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>GitHub Gebruikersnaam / Org</label>
          <input className="input-field" value={form.repoOwner} onChange={e => setF('repoOwner', e.target.value)} placeholder="bijv. mijnschool-it" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Repository Naam</label>
          <input className="input-field" value={form.repoName} onChange={e => setF('repoName', e.target.value)} placeholder="bijv. locra-backups" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>GitHub Token (PAT)</label>
          <input className="input-field" type="password" value={form.ghToken} onChange={e => setF('ghToken', e.target.value)} placeholder="ghp_..." autoComplete="off" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>Branch</label>
          <input className="input-field" value={form.branch} onChange={e => setF('branch', e.target.value)} placeholder="main" style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={pushing}
          className="btn"
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #24292e, #3d4450)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            fontWeight: 700,
            cursor: pushing ? 'not-allowed' : 'pointer',
            opacity: pushing ? 0.7 : 1,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>🐙</span> {pushing ? 'Bezig met pushen...' : 'Nu naar GitHub Pushen'}
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Opslag als <code>locra-backups/backup-{'{datum}'}.json</code>
        </span>
      </div>
    </form>
  );
}

// ── Hoofd Settings Component ──────────────────────────────────────────────────

export default function SettingsPanel() {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState('features');
  const [searchQuery, setSearchQuery] = useState('');

  const [licenseData, setLicenseData] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState<any>({
    // Features
    enableWebSearch: false,
    enableAttachments: true,
    enableSharedChats: true,
    enableCollabChats: true,
    enableFeedback: true,
    enableReporting: true,
    enableWatermark: true,
    enablePlagiarismCheck: false,
    enableLearningGoals: false,
    enablePlugins: false,
    enableCaching: false,
    enableTelemetry: false,
    enableExamMode: false,
    enableAutoUpdate: true,
    // Credits
    enableCredits: false,
    defaultCreditsPerUser: 100,
    creditResetInterval: 'monthly',
    // Security & Storage
    chatStorageMode: 'server',
    userCanChooseStorage: true,
    enableAnonymization: false,
    dataRetentionDays: '',
    enableAuditLogging: false,
    enableE2EEncryption: true,
    enableNetworkIsolation: false,
    enableOpenPCC: false,
    openPccBackend: 'cloud',
    openPccAttestation: true,
    customDomain: '',
    allowedIps: '',
    // Auth
    enableLocalAuth: true,
    enableGuestAccess: false,
    enable2FA: false,
    enableKennisnet: false,
    kennisnetClientId: '',
    kennisnetClientSecret: '',
    registrationMode: 'admin',
    enableSomtoday: false,
    somtodayBaseUrl: '',
    // Limits
    enableRateLimiting: true,
    maxPromptsPerDay: 50,
    maxPromptsPerMonth: 1000,
    maxThinkingPerDay: '',
    maxTokensPerRequest: 4096,
    maxConcurrency: 6,
    queueTimeoutSec: 45,
    allowTeachersToOverrideQuota: false,
    maxTeacherOverrideQuota: '',
    // RAG
    embeddingModel: 'llama3',
    ragChunkSize: 250,
    ragChunkOverlap: 60,
    ragMinScore: 0.25,
    ragTopN: 5,
    // Performance (Ollama)
    ollamaNumParallel: 1,
    ollamaMaxLoadedModels: 1,
    ollamaKeepAlive: '5m',
    ollamaContextLength: 4096,
    // Email & SMTP Verification
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    smtpFromEmail: '',
    smtpVerified: false,
    // Schooltijden & Beschikbaarheid
    activeTimeStart: '',
    activeTimeEnd: '',
    activeDays: '[1,2,3,4,5]',
    // Backup
    enableAutoBackup: false,
    backupIntervalHours: 24,
    backupRetentionDays: 30,
    // API integrations
    apiIntegrationEnabled: false,
    openAiApiKey: '',
    anthropicApiKey: '',
    huggingFaceApiKey: '',
    openRouterApiKey: '',
    currentApiCost: 0,
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadLicense = () => {
    fetch('/api/settings/license', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setLicenseData(data);
          if (data.key) setLicenseKeyInput(data.key);
        }
      }).catch(() => {});
  };

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (!data.error) setSettings((prev: any) => ({ ...prev, ...data })); })
      .catch(() => {});
    loadLicense();
  }, [token]);

  const set = (key: string, val: any) => setSettings((prev: any) => ({ ...prev, [key]: val }));

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
      showToast('success', '✅ Instellingen succesvol opgeslagen!');
    } catch (err: any) {
      showToast('error', '❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) { setLicenseMsg({ type: 'error', text: 'Vul een licentiesleutel in.' }); return; }
    setActivatingLicense(true);
    setLicenseMsg(null);
    try {
      const res = await fetch('/api/settings/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ licenseKey: licenseKeyInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Licentieactivatie mislukt');
      setLicenseMsg({ type: 'success', text: `✓ Licentie succesvol gekoppeld! ${data.license?.tier?.toUpperCase()} is actief.` });
      loadLicense();
    } catch (err: any) {
      setLicenseMsg({ type: 'error', text: err.message });
    } finally {
      setActivatingLicense(false);
    }
  };

  const handleUnlinkLicense = async () => {
    if (!confirm('Weet je zeker dat je de licentie wilt ontkoppelen?')) return;
    try {
      const res = await fetch('/api/settings/license/unlink', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) { setLicenseKeyInput(''); setLicenseMsg({ type: 'success', text: 'Licentie ontkoppeld.' }); loadLicense(); }
    } catch (e: any) { setLicenseMsg({ type: 'error', text: 'Fout: ' + e.message }); }
  };

  const [smtpCodeInput, setSmtpCodeInput] = useState('');
  const [smtpSendingCode, setSmtpSendingCode] = useState(false);
  const [smtpVerifyingCode, setSmtpVerifyingCode] = useState(false);
  const [smtpCodeSentInfo, setSmtpCodeSentInfo] = useState<string | null>(null);

  const handleSendSmtpCode = async () => {
    setSmtpSendingCode(true);
    setSmtpCodeSentInfo(null);
    try {
      const res = await fetch('/api/settings/smtp/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass,
          smtpFromEmail: settings.smtpFromEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kon verificatiecode niet verzenden');
      setSmtpCodeSentInfo(data.message || 'Verificatiecode verzonden naar je e-mailadres.');
      showToast('success', '📧 6-cijferige verificatiecode is verzonden naar ' + (data.sentTo || 'je e-mail'));
    } catch (e: any) {
      showToast('error', '❌ ' + e.message);
    } finally {
      setSmtpSendingCode(false);
    }
  };

  const handleVerifySmtpCode = async () => {
    if (!smtpCodeInput.trim() || smtpCodeInput.trim().length !== 6) {
      showToast('error', 'Vul de volledige 6-cijferige code in');
      return;
    }
    setSmtpVerifyingCode(true);
    try {
      const res = await fetch('/api/settings/smtp/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: smtpCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verificatie mislukt');
      setSettings((prev: any) => ({ ...prev, smtpVerified: true }));
      setSmtpCodeInput('');
      setSmtpCodeSentInfo(null);
      showToast('success', '🎉 ' + (data.message || 'SMTP Server succesvol geverifieerd! Chat-inzage is nu actief.'));
    } catch (e: any) {
      showToast('error', '❌ ' + e.message);
    } finally {
      setSmtpVerifyingCode(false);
    }
  };

  const isEduPlus = licenseData?.isEduPlus || ['edu-plus', 'enterprise'].includes(settings?.licenseTier);

  // 6 Georganiseerde Hoofdcategorieën
  const categories = [
    {
      id: 'features',
      label: 'Algemeen & Functies',
      icon: <Zap size={18} />,
      badge: 'Platform',
      desc: 'Modules, streaming & caching'
    },
    {
      id: 'security',
      label: 'Beveiliging & Privacy',
      icon: <Shield size={18} />,
      badge: 'AVG / SIVON',
      desc: 'Chatopslag, watermerk & PII'
    },
    {
      id: 'ai_models',
      label: 'AI Modellen & API\'s',
      icon: <Brain size={18} />,
      badge: 'Modellen',
      desc: 'Cloud API keys, RAG & hardware'
    },
    {
      id: 'auth',
      label: 'Authenticatie & SSO',
      icon: <KeyRound size={18} />,
      badge: 'Koppelingen',
      desc: 'Kennisnet Entree & SOMtoday'
    },
    {
      id: 'email',
      label: 'E-mail & Meldingen',
      icon: <Mail size={18} />,
      badge: 'SMTP',
      desc: 'Mailserver & wachtwoord-resets'
    },
    {
      id: 'backup_license',
      label: 'Back-up & Licentie',
      icon: <Database size={18} />,
      badge: 'Beheer',
      desc: 'Exports, GitHub sync & licentie'
    }
  ];

  return (
    <form onSubmit={handleSave} style={{ position: 'relative' }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#fff', padding: '0.85rem 1.4rem', borderRadius: '12px',
          fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            ⚙️ Systeem Instellingen
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', marginBottom: 0, maxWidth: '650px', fontSize: '0.92rem' }}>
            Centraal beheer van privacy, onderwijsmodules, AI providers en schoolkoppelingen.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              borderRadius: '12px',
              padding: '0.7rem 1.6rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.35)'
            }}
          >
            <Save size={16} />
            <span>{saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* Category Navigation (Left Sidebar) */}
        <div style={{
          width: '100%',
          maxWidth: '300px',
          flex: '1 1 260px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem'
        }}>
          {categories.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '0.95rem 1.15rem',
                  borderRadius: '14px',
                  background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(6, 182, 212, 0.12))' : 'rgba(255, 255, 255, 0.025)',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid rgba(255, 255, 255, 0.05)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: isActive ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {cat.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div style={{ fontWeight: isActive ? 700 : 600, fontSize: '0.92rem', color: isActive ? '#fff' : 'var(--text-primary)' }}>
                      {cat.label}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.desc}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Quick link to Functiebeheer dashboard */}
          <div style={{
            marginTop: '0.75rem',
            padding: '1rem',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.05))',
            border: '1px solid rgba(99, 102, 241, 0.25)'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', marginBottom: '0.25rem' }}>
              ⚡ Functies & Modules
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
              Gedetailleerde toggles voor web-zoeken, leerdoelen & quizzen beheren?
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/features')}
              className="btn btn-ghost"
              style={{
                width: '100%',
                fontSize: '0.78rem',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#a5b4fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <span>Naar Functiebeheer</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Content Pane (Right Column) */}
        <div style={{ flex: '1 1 500px', minWidth: 0 }}>

          {/* ═════════ 1. ALGEMEEN & FUNCTIES ═════════ */}
          {activeCategory === 'features' && (
            <div>
              <SectionCard
                icon="⚡"
                title="Platform Functies & Gedrag"
                description="Schakel basisfuncties in of uit voor alle gebruikers binnen de school."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <SettingToggle
                    label="CO-OP Groepskamers (Multiplayer)"
                    description="Laat leerlingen en docenten realtime samenwerken in gedeelde werkruimtes met AI."
                    checked={settings.enableCollabChats !== false}
                    onChange={v => set('enableCollabChats', v)}
                    badge="Aanbevolen"
                  />
                  <SettingToggle
                    label="Bestandsbijlagen & Document Uploads"
                    description="Sta gebruikers toe PDF's, Word-documenten en bronbestanden toe te voegen."
                    checked={settings.enableAttachments}
                    onChange={v => set('enableAttachments', v)}
                  />
                  <SettingToggle
                    label="Gedeelde Chats (Deellinks)"
                    description="Maak het mogelijk om unieke weblinks te genereren van chatgesprekken."
                    checked={settings.enableSharedChats}
                    onChange={v => set('enableSharedChats', v)}
                  />
                  <SettingToggle
                    label="Feedback Systeem (Duimpjes)"
                    description="Verzamel kwaliteitsfeedback van leerlingen op AI-antwoorden."
                    checked={settings.enableFeedback}
                    onChange={v => set('enableFeedback', v)}
                  />
                  <SettingToggle
                    label="Examenmodus (Vergrendelde Omgeving)"
                    description="Schakelt internet en externe hulpbronnen tijdelijk uit voor toetsafnames."
                    checked={settings.enableExamMode}
                    onChange={v => set('enableExamMode', v)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon="🚀"
                title="Performance, Caching & Caching-Nodes"
                description="Optimaliseer responstijden en lokale serverbelasting."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <SettingToggle
                    label="Prompt Caching Inschakelen"
                    description="Hergebruik eerdere AI-antwoorden voor identieke vragen om serverkracht te besparen."
                    checked={settings.enableCaching}
                    onChange={v => set('enableCaching', v)}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                    <SettingInput
                      label="Max. Gelijktijdige Verzoeken"
                      description="Aantal parallelle AI-aanvragen dat de server gelijktijdig verwerkt."
                      value={settings.maxConcurrency}
                      onChange={v => set('maxConcurrency', v)}
                      type="number"
                      placeholder="6"
                    />
                    <SettingInput
                      label="Wachtrij Timeout (Seconden)"
                      description="Maximale wachttijd voor in de wachtrij geplaatste aanvragen."
                      value={settings.queueTimeoutSec}
                      onChange={v => set('queueTimeoutSec', v)}
                      type="number"
                      placeholder="45"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon="🏫"
                title="Schooltijden & Beschikbaarheid"
                description="Beperk toegang tot de AI-assistent tot officiële schooluren of schooldagen."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Stel de openingstijden van de AI in. Buiten deze uren en op niet-geselecteerde dagen krijgen leerlingen een vriendelijke melding dat de schoolserver gesloten is. (Laat leeg om 24/7 toegang te verlenen).
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <SettingInput
                      label="Begintijd School (bijv. 08:30)"
                      value={settings.activeTimeStart || ''}
                      onChange={v => set('activeTimeStart', v)}
                      placeholder="08:30"
                    />
                    <SettingInput
                      label="Eindtijd School (bijv. 16:30)"
                      value={settings.activeTimeEnd || ''}
                      onChange={v => set('activeTimeEnd', v)}
                      placeholder="16:30"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      Actieve Schooldagen
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[
                        { day: 1, label: 'Ma' },
                        { day: 2, label: 'Di' },
                        { day: 3, label: 'Wo' },
                        { day: 4, label: 'Do' },
                        { day: 5, label: 'Vr' },
                        { day: 6, label: 'Za' },
                        { day: 0, label: 'Zo' },
                      ].map(({ day, label }) => {
                        let currentDays: number[] = [1, 2, 3, 4, 5];
                        try {
                          if (settings.activeDays) currentDays = JSON.parse(settings.activeDays);
                        } catch {}
                        const isSelected = currentDays.includes(day);

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? currentDays.filter(d => d !== day)
                                : [...currentDays, day];
                              set('activeDays', JSON.stringify(updated));
                            }}
                            style={{
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                              background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                              color: isSelected ? '#fff' : 'var(--text-secondary)',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              fontSize: '0.82rem'
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* AI-Gebruikersprofilering & Personalisatie */}
              <SectionCard
                icon="🧠"
                title="AI-Gebruikersprofilering & Personalisatie"
                description="Laat de AI op de achtergrond een pedagogisch profiel opbouwen (interesses, denkniveau, leervoorkeur) om antwoorden en voorbeelden perfect af te stemmen op de leerling."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Automatische AI-Profielopbouw Inschakelen"
                    description="AI destilleert discreet interesses en leervoorkeuren uit gevoerde chats (volledig asynchroon op de achtergrond zonder vertraging)."
                    checked={settings.enableUserProfileBuilding}
                    onChange={v => set('enableUserProfileBuilding', v)}
                    badge={settings.enableUserProfileBuilding ? "Ingeschakeld" : "Uit"}
                  />

                  {settings.enableUserProfileBuilding && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '1.25rem',
                      borderRadius: '14px',
                      background: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#818cf8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        📋 Welke dimensies mag de AI bijhouden?
                      </div>

                      <SettingToggle
                        label="Interesses & Passies"
                        description="Hobby's, sport, games, boeken en favoriete onderwerpen (worden gebruikt voor herkenbare voorbeelden)."
                        checked={settings.profileTrackInterests !== false}
                        onChange={v => set('profileTrackInterests', v)}
                      />

                      <SettingToggle
                        label="Leerstijl & Denkniveau"
                        description="Leervoorkeuren zoals beelddenken, stapsgewijze uitleg, behoefte aan metaforen of abstractie."
                        checked={settings.profileTrackLearningStyle !== false}
                        onChange={v => set('profileTrackLearningStyle', v)}
                      />

                      <SettingToggle
                        label="Sterke vakken & Moeilijkheden"
                        description="Vakgebieden waar de leerling in uitblinkt of juist extra geduld en verheldering bij kan gebruiken."
                        checked={settings.profileTrackStrengthsWeaknesses !== false}
                        onChange={v => set('profileTrackStrengthsWeaknesses', v)}
                      />

                      <SettingToggle
                        label="Toekomstdromen & Leerdoelen"
                        description="Opleidingsdoelen, beroepswensen en eindexamendoelen."
                        checked={settings.profileTrackGoals !== false}
                        onChange={v => set('profileTrackGoals', v)}
                      />

                      <SettingToggle
                        label="Communicatiestijl & Toon"
                        description="Voorkeur voor informele toon, subtiele humor of juist zakelijke beknoptheid."
                        checked={settings.profileTrackPersonality !== false}
                        onChange={v => set('profileTrackPersonality', v)}
                      />

                      <div style={{ margin: '0.75rem 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />

                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#818cf8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        🛡️ Privacy & Inzage Rechten
                      </div>

                      <SettingToggle
                        label="Leerling mag eigen AI-profiel inzien"
                        description="Toont het tabblad 'Mijn AI-Profiel' in de gebruikersinstellingen van de leerling."
                        checked={settings.profileStudentCanView !== false}
                        onChange={v => set('profileStudentCanView', v)}
                      />

                      <SettingToggle
                        label="Leerling mag items verwijderen / corrigeren"
                        description="Geeft de leerling de optie om onjuiste interesses of observaties zelfstandig te wissen."
                        checked={settings.profileStudentCanEdit !== false}
                        onChange={v => set('profileStudentCanEdit', v)}
                      />

                      <SettingToggle
                        label="Docenten mogen leerlingprofielen inzien"
                        description="Geeft vakdocenten en mentoren inzicht in de leervoorkeuren van hun klassen ter begeleiding."
                        checked={settings.profileTeacherCanView !== false}
                        onChange={v => set('profileTeacherCanView', v)}
                      />
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═════════ 2. BEVEILIGING, PRIVACY & AVG ═════════ */}
          {activeCategory === 'security' && (
            <div>
              <SectionCard
                icon="🛡️"
                title="AVG / SIVON Privacy & Chatopslag"
                description="Beheer hoe en waar berichten van leerlingen en medewerkers worden bewaard."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                      Opslaglocatie van Chatberichten
                    </label>
                    <select
                      className="input-field"
                      value={settings.chatStorageMode}
                      onChange={e => set('chatStorageMode', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.9rem',
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.22)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    >
                      <option value="server">Centrale Server (School Database - Volledig Gecontroleerd)</option>
                      <option value="local">Alleen Lokaal (In de browser van de gebruiker - Zero Server Data)</option>
                    </select>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Bij 'Alleen Lokaal' worden gesprekken na de sessie direct gewist van het geheugen en niet in de database opgeslagen.
                    </p>
                  </div>

                  <SettingToggle
                    label="Gebruiker mag zelf opslagvoorkeur kiezen"
                    description="Geeft leerlingen en docenten een schuifje in de chat om opslag naar de server uit te zetten."
                    checked={settings.userCanChooseStorage}
                    onChange={v => set('userCanChooseStorage', v)}
                  />
                  <SettingToggle
                    label="Onzichtbaar Steganografisch EDU Watermerk"
                    description="Markeert alle AI-uitvoer met een onzichtbare school- en sessiehandtekening voor fraude- en plagiaatpreventie."
                    checked={settings.enableWatermark}
                    onChange={v => set('enableWatermark', v)}
                    badge="Actief"
                  />
                  <SettingToggle
                    label="Automatische PII-Anonimisering (AVG)"
                    description="Vervangt namen, BSN, e-mailadressen en telefoonnummers automatisch door anonieme placeholders vóór verzending naar AI."
                    checked={settings.enableAnonymization}
                    onChange={v => set('enableAnonymization', v)}
                    badge="AVG / GDPR"
                  />
                  <SettingToggle
                    label="End-to-End Database Encryptie"
                    description="Versleutelt chatberichten in rust op de schijf met AES-256."
                    checked={settings.enableE2EEncryption}
                    onChange={v => set('enableE2EEncryption', v)}
                  />
                  <SettingInput
                    label="Bewaartermijn Gesprekken (Dagen)"
                    description="Automatisch verwijderen van berichten na dit aantal dagen. Laat leeg voor onbeperkt."
                    value={settings.dataRetentionDays}
                    onChange={v => set('dataRetentionDays', v)}
                    type="number"
                    placeholder="Onbeperkt (bijv. 90 of 365)"
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon="🛡️"
                title="Locra Enclave Shield™ & OpenPCC Hardware TEE"
                description="Confidential Computing op basis van AMD SEV-SNP en Apple OpenPCC Secure Enclave isolatie."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Locra Enclave Shield™ (OpenPCC TEE) Activeren"
                    description="Schakelt hardwarematige confidential computing en enclave-isolatie in voor deze onderwijsinstelling."
                    checked={settings.enableOpenPCC}
                    onChange={v => set('enableOpenPCC', v)}
                    badge="Hardware TEE"
                  />

                  {settings.enableOpenPCC && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                          Enclave Infrastructure Backend
                        </label>
                        <select
                          className="input-field"
                          value={settings.openPccBackend || 'cloud'}
                          onChange={e => set('openPccBackend', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.9rem',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.22)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            outline: 'none'
                          }}
                        >
                          <option value="cloud">PrivAI Cloud Enclave (Equinix AM4 Amsterdam - AMD SEV-SNP)</option>
                          <option value="local">Lokale TEE hardware-omgeving (School Server Secure Enclave / On-Prem TEE Socket)</option>
                        </select>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                          Bij 'PrivAI Cloud Enclave' wordt het model gedraaid binnen gecertificeerde AMD SEV-SNP hardware in Amsterdam. Bij 'Lokaal' wordt een on-premise TEE socket of Apple Silicon Secure Enclave aangesproken.
                        </p>
                      </div>

                      <SettingToggle
                        label="Cryptografische Hardware Attestation Verifiëren"
                        description="Valideert de cryptografische handtekening van de chip bij elke inferentie-call voor gegarandeerde integriteit."
                        checked={settings.openPccAttestation !== false}
                        onChange={v => set('openPccAttestation', v)}
                        badge="SEV-SNP Signed"
                      />
                    </>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                icon="🌐"
                title="Netwerkisolatie & IP Toegangsbeperkingen"
                description="Beperk toegang tot vertrouwde schoolnetwerken of specifieke IP-ranges."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Strikte Netwerkisolatie Activeren"
                    description="Blokkeert alle verzoeken buiten het schoolnetwerk."
                    checked={settings.enableNetworkIsolation}
                    onChange={v => set('enableNetworkIsolation', v)}
                  />
                  <SettingInput
                    label="Toegestane IP-adressen (Komma-gescheiden)"
                    description="Bijv. 192.168.1.0/24, 82.161.44.12. Laat leeg om elk IP toe te laten."
                    value={settings.allowedIps}
                    onChange={v => set('allowedIps', v)}
                    placeholder="192.168.1.0/24, 10.0.0.0/8"
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═════════ 3. AI MODELLEN & CLOUD API'S ═════════ */}
          {activeCategory === 'ai_models' && (
            <div>
              <SectionCard
                icon="☁️"
                title="Cloud AI Providers & API-sleutels"
                description="Gebruik externe cloudmodellen als fallback of voor zware taken."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Externe Cloud API's Inschakelen"
                    description="Sta toe dat geautoriseerde modellen via cloudproviders worden aangeroepen."
                    checked={settings.apiIntegrationEnabled}
                    onChange={v => set('apiIntegrationEnabled', v)}
                  />

                  {settings.apiIntegrationEnabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                      <SettingInput
                        label="OpenAI API Key"
                        value={settings.openAiApiKey}
                        onChange={v => set('openAiApiKey', v)}
                        type="password"
                        placeholder="sk-..."
                      />
                      <SettingInput
                        label="Anthropic Claude API Key"
                        value={settings.anthropicApiKey}
                        onChange={v => set('anthropicApiKey', v)}
                        type="password"
                        placeholder="sk-ant-..."
                      />
                      <SettingInput
                        label="OpenRouter API Key"
                        value={settings.openRouterApiKey}
                        onChange={v => set('openRouterApiKey', v)}
                        type="password"
                        placeholder="sk-or-..."
                      />
                      <SettingInput
                        label="HuggingFace Token"
                        value={settings.huggingFaceApiKey}
                        onChange={v => set('huggingFaceApiKey', v)}
                        type="password"
                        placeholder="hf_..."
                      />
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                icon="📚"
                title="Kennisbank (RAG) & Vector Instellingen"
                description="Configureer hoe lesbrieven, PTA's en schoolhandleidingen worden verwerkt en opgevraagd."
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <SettingInput
                    label="Chunk Grootte (Tokens)"
                    description="Grootte van opgedeelde documentfragmenten."
                    value={settings.ragChunkSize}
                    onChange={v => set('ragChunkSize', v)}
                    type="number"
                    placeholder="250"
                  />
                  <SettingInput
                    label="Chunk Overlap (Tokens)"
                    description="Aantal overlappende tokens tussen opeenvolgende fragmenten."
                    value={settings.ragChunkOverlap}
                    onChange={v => set('ragChunkOverlap', v)}
                    type="number"
                    placeholder="60"
                  />
                  <SettingInput
                    label="Minimale Relevantiescore (0-1)"
                    description="Drempelwaarde voor semantische zoekmatches."
                    value={settings.ragMinScore}
                    onChange={v => set('ragMinScore', v)}
                    placeholder="0.25"
                  />
                  <SettingInput
                    label="Top N Fragmenten"
                    description="Aantal bronpassages dat maximaal aan de prompt wordt toegevoegd."
                    value={settings.ragTopN}
                    onChange={v => set('ragTopN', v)}
                    type="number"
                    placeholder="5"
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon="⚙️"
                title="Lokale Ollama Server Tunings"
                description="Geheugen- en parallelisatie-instellingen voor de lokale AI server."
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <SettingInput
                    label="Parallelle Verzoeken per Model"
                    value={settings.ollamaNumParallel}
                    onChange={v => set('ollamaNumParallel', v)}
                    type="number"
                    placeholder="1"
                  />
                  <SettingInput
                    label="Max. Geladen Modellen in VRAM"
                    value={settings.ollamaMaxLoadedModels}
                    onChange={v => set('ollamaMaxLoadedModels', v)}
                    type="number"
                    placeholder="1"
                  />
                  <SettingInput
                    label="Keep-Alive Duur in Geheugen"
                    value={settings.ollamaKeepAlive}
                    onChange={v => set('ollamaKeepAlive', v)}
                    placeholder="5m"
                  />
                  <SettingInput
                    label="Context Lengte (Tokens)"
                    value={settings.ollamaContextLength}
                    onChange={v => set('ollamaContextLength', v)}
                    type="number"
                    placeholder="4096"
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═════════ 4. AUTHENTICATIE & KOPPELINGEN ═════════ */}
          {activeCategory === 'auth' && (
            <div>
              <SectionCard
                icon="🔑"
                title="Aanmeldmethoden & Registratie"
                description="Beheer hoe leerlingen en docenten toegang krijgen tot Locra."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Lokale Gebruikersnaam & Wachtwoord Login"
                    description="Standaard inlogmethode met database-accounts."
                    checked={settings.enableLocalAuth}
                    onChange={v => set('enableLocalAuth', v)}
                  />
                  <SettingToggle
                    label="Tweestapsverificatie (2FA) Verplichten"
                    description="Vereist een authenticator app (TOTP) voor beheerders en docenten."
                    checked={settings.enable2FA}
                    onChange={v => set('enable2FA', v)}
                  />
                  <SettingToggle
                    label="Gasttoegang Toestaan (Openbare Demo)"
                    description="Laat bezoekers een proefgesprek voeren zonder account."
                    checked={settings.enableGuestAccess}
                    onChange={v => set('enableGuestAccess', v)}
                  />

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                      Account Registratiemodus
                    </label>
                    <select
                      className="input-field"
                      value={settings.registrationMode}
                      onChange={e => set('registrationMode', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.9rem',
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.22)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    >
                      <option value="admin">Alleen Beheerder (Geen zelfregistratie)</option>
                      <option value="school_domain">Alleen met Schooldomein e-mail (bijv. @school.nl)</option>
                      <option value="open">Open Zelfregistratie</option>
                    </select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon="🏫"
                title="Kennisnet Entree Federatie (SSO)"
                description="Single Sign-On koppeling met landelijke onderwijsportalen (SURF / Kennisnet)."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="Entree Federatie Inschakelen"
                    description="Laat docenten en leerlingen inloggen met hun vertrouwde schoolinlog."
                    checked={settings.enableKennisnet}
                    onChange={v => set('enableKennisnet', v)}
                    badge="SIVON"
                  />
                  {settings.enableKennisnet && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                      <SettingInput
                        label="Entree Client ID"
                        value={settings.kennisnetClientId}
                        onChange={v => set('kennisnetClientId', v)}
                        placeholder="locra-school-client-id"
                      />
                      <SettingInput
                        label="Entree Client Secret"
                        value={settings.kennisnetClientSecret}
                        onChange={v => set('kennisnetClientSecret', v)}
                        type="password"
                        placeholder="••••••••••••"
                      />
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                icon="📅"
                title="SOMtoday API Koppeling"
                description="Synchroniseer lesroosters, huiswerkopdrachten en vakken direct met de chat."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <SettingToggle
                    label="SOMtoday Integratie Activeren"
                    description="Toont het SOMtoday rooster en huiswerkpaneel direct in de chat."
                    checked={settings.enableSomtoday}
                    onChange={v => set('enableSomtoday', v)}
                  />
                  {settings.enableSomtoday && (
                    <SettingInput
                      label="SOMtoday School Base URL"
                      description="Bijvoorbeeld: https://somtoday.nl of school-specifieke API endpoint"
                      value={settings.somtodayBaseUrl}
                      onChange={v => set('somtodayBaseUrl', v)}
                      placeholder="https://api.somtoday.nl"
                    />
                  )}
                </div>
              </SectionCard>

              <SectionCard
                icon="💼"
                title="Microsoft Teams & Google Classroom Integratie"
                description="Laat leerlingen en docenten direct binnen hun vertrouwde omgeving werken via een embedded tabblad."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Voeg Locra toe als aangepast tabblad (Web App) in Microsoft Teams kanalen of koppel deep-links in Google Classroom opdrachten. Dankzij de parameter <code>?embedded=true</code> past de interface zich automatisch naadloos aan zonder storende headers.
                  </p>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase' }}>
                      📋 Gegenereerde Embed URLs voor Teams & Classroom:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>💬 <strong>Chat & AI-Werkplek:</strong></span>
                        <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                          {window.location.origin}/chat?embedded=true
                        </code>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>👥 <strong>CO-OP Groepswerk Studio:</strong></span>
                        <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                          {window.location.origin}/coop?embedded=true
                        </code>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🎒 <strong>Mijn Opdrachtenportaal:</strong></span>
                        <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                          {window.location.origin}/student?embedded=true
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═════════ 5. E-MAIL & NOTIFICATIES ═════════ */}
          {activeCategory === 'email' && (
            <div>
              <SectionCard
                icon="📧"
                title="SMTP E-mailserver Configuratie"
                description="Noodzakelijk voor wachtwoord-reset mails, auditwaarschuwingen en welkomstmails."
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <SettingInput
                    label="SMTP Host"
                    value={settings.smtpHost || ''}
                    onChange={v => set('smtpHost', v)}
                    placeholder="smtp.mijnschool.nl"
                  />
                  <SettingInput
                    label="SMTP Poort"
                    value={settings.smtpPort || ''}
                    onChange={v => set('smtpPort', v)}
                    type="number"
                    placeholder="587"
                  />
                  <SettingInput
                    label="SMTP Gebruikersnaam"
                    value={settings.smtpUser || ''}
                    onChange={v => set('smtpUser', v)}
                    placeholder="no-reply@mijnschool.nl"
                  />
                  <SettingInput
                    label="SMTP Wachtwoord"
                    value={settings.smtpPass || ''}
                    onChange={v => set('smtpPass', v)}
                    type="password"
                    placeholder="••••••••••••"
                  />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <SettingInput
                      label="Afzenderadres (From Header)"
                      value={settings.smtpFromEmail || ''}
                      onChange={v => set('smtpFromEmail', v)}
                      placeholder="Locra Onderwijs <no-reply@mijnschool.nl>"
                    />
                  </div>
                </div>

                {/* SMTP Test Button */}
                <div style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>Verbinding testen</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Stuurt direct een test e-mail naar jouw beheerdersaccount om de mailserver te valideren.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/smtp/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({
                            smtpHost: settings.smtpHost,
                            smtpPort: settings.smtpPort,
                            smtpUser: settings.smtpUser,
                            smtpPass: settings.smtpPass,
                            smtpFromEmail: settings.smtpFromEmail
                          })
                        });
                        const d = await res.json();
                        if (res.ok) showToast('success', '✅ ' + (d.message || 'Testmail succesvol verstuurd!'));
                        else showToast('error', '❌ ' + (d.error || 'SMTP test mislukt'));
                      } catch {
                        showToast('error', '❌ Netwerkfout bij SMTP test');
                      }
                    }}
                    className="btn"
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    📬 Test E-mail Verzenden
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                icon="🔒"
                title="SMTP Verificatie & Chat-Inzage Beveiliging"
                description="Verplicht voor beheerders en vertrouwenspersonen om versleutelde gesprekken in te zien."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    borderRadius: '12px',
                    background: settings.smtpVerified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: settings.smtpVerified ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        color: settings.smtpVerified ? '#4ade80' : '#f87171'
                      }}>
                        {settings.smtpVerified ? (
                          <>
                            <CheckCircle size={18} /> SMTP Server Geverifieerd
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} /> SMTP Server Niet Geverifieerd
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {settings.smtpVerified
                          ? 'Chat-inzage door beheerders en vertrouwenspersonen is toegestaan. Leerlingen ontvangen altijd een notificatie.'
                          : 'Chat-inzage is geblokkeerd totdat de e-mailserver succesvol is geverifieerd met een 6-cijferige testcode.'}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={smtpSendingCode}
                      onClick={handleSendSmtpCode}
                      style={{
                        padding: '0.6rem 1.15rem',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: smtpSendingCode ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {smtpSendingCode ? 'Verzenden...' : '📩 Verificatiecode Sturen'}
                    </button>
                  </div>

                  {smtpCodeSentInfo && (
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      fontSize: '0.82rem',
                      color: '#38bdf8'
                    }}>
                      {smtpCodeSentInfo}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-cijferige code"
                      value={smtpCodeInput}
                      onChange={e => setSmtpCodeInput(e.target.value.replace(/\D/g, ''))}
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#fff',
                        fontSize: '1rem',
                        letterSpacing: '3px',
                        width: '160px',
                        textAlign: 'center',
                        fontFamily: 'monospace'
                      }}
                    />

                    <button
                      type="button"
                      disabled={smtpVerifyingCode || smtpCodeInput.length !== 6}
                      onClick={handleVerifySmtpCode}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '10px',
                        background: smtpCodeInput.length === 6 ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255, 255, 255, 0.06)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: (smtpVerifyingCode || smtpCodeInput.length !== 6) ? 'not-allowed' : 'pointer',
                        opacity: (smtpVerifyingCode || smtpCodeInput.length !== 6) ? 0.5 : 1
                      }}
                    >
                      {smtpVerifyingCode ? 'Controleren...' : '✓ Code Valideren & Activeren'}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 Bij elke aanpassing in de SMTP-host, poort of gebruikersnaam vervalt de verificatiestatus automatisch. Dit garandeert dat notificatiemails naar leerlingen altijd betrouwbaar verzonden kunnen worden.
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═════════ 6. BACK-UP, LIMITEN & LICENTIE ═════════ */}
          {activeCategory === 'backup_license' && (
            <div>
              {/* Licentiestatus */}
              <SectionCard
                icon="🎓"
                title="Locra Licentiestatus & Activatie"
                description="Bekijk en activeer jouw schoollicentie voor EDU Plus functionaliteiten."
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '20px',
                    background: isEduPlus ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255, 255, 255, 0.1)',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    color: '#fff'
                  }}>
                    {licenseData?.tier?.toUpperCase() || settings?.licenseTier?.toUpperCase() || 'EDU BASIC'}
                  </div>
                  {isEduPlus && (
                    <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle size={15} /> Alle EDU Plus functies zijn actief
                    </span>
                  )}
                </div>

                {licenseMsg && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: licenseMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: licenseMsg.type === 'success' ? '#34d399' : '#f87171',
                    border: `1px solid ${licenseMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    fontSize: '0.88rem'
                  }}>
                    {licenseMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="LOCRA-XXXX-XXXX-XXXX"
                    value={licenseKeyInput}
                    onChange={e => setLicenseKeyInput(e.target.value)}
                    style={{ flex: '1 1 250px', fontFamily: 'monospace' }}
                    disabled={activatingLicense}
                  />
                  <button
                    type="button"
                    onClick={handleActivateLicense}
                    className="btn btn-primary"
                    disabled={activatingLicense}
                    style={{ padding: '0.65rem 1.4rem', whiteSpace: 'nowrap', borderRadius: '10px' }}
                  >
                    {activatingLicense ? 'Controleren...' : '🔑 Licentie Activeren'}
                  </button>
                </div>

                {licenseData?.key && (
                  <button
                    type="button"
                    onClick={handleUnlinkLicense}
                    style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}
                  >
                    Licentie van deze server ontkoppelen
                  </button>
                )}
              </SectionCard>

              {/* Directe Back-ups */}
              <SectionCard
                icon="⬇️"
                title="Directe Gegevensback-up Downloaden"
                description="Exporteer jouw complete schoolinstallatie veilig voor lokale archivering of rampenherstel."
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '14px' }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🗄️</div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#fff' }}>SQLite Database (.db)</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                      Volledige binaire backup van alle tabellen, gebruikers en configuraties.
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const token = useAuthStore.getState().token;
                        const res = await fetch('/api/admin/backup/download', { headers: { Authorization: `Bearer ${token}` } });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `locra-backup-${new Date().toISOString().slice(0, 10)}.db`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } else {
                          alert('Download mislukt');
                        }
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', borderRadius: '10px', fontSize: '0.85rem' }}
                    >
                      Download .db Bestand
                    </button>
                  </div>

                  <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px' }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📋</div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#fff' }}>JSON Exporteren</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                      Leesbaar tekstformaat voor compliance, rapportages en datamigraties.
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const token = useAuthStore.getState().token;
                        const res = await fetch('/api/admin/backup/export-json', { headers: { Authorization: `Bearer ${token}` } });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `locra-export-${new Date().toISOString().slice(0, 10)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } else {
                          alert('Export mislukt');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Download .json Export
                    </button>
                  </div>
                </div>
              </SectionCard>

              {/* GitHub Externe Sync */}
              <SectionCard
                icon="🐙"
                title="Externe GitHub Backup Sync"
                description="Automatisch of handmatig JSON-backups wegschrijven naar een privé GitHub repository."
              >
                <GithubBackupSection token={token || ''} showToast={showToast} />
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
