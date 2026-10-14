import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

// ── Herbruikbare sub-componenten ─────────────────────────────────────────────

function SettingToggle({ label, description, checked, onChange, locked = false, lockedMsg = '' }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; locked?: boolean; lockedMsg?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: locked ? 'rgba(255,255,255,0.4)' : '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {label}
          {locked && <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>EDU PLUS</span>}
        </div>
        {description && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', lineHeight: 1.5 }}>{locked && lockedMsg ? lockedMsg : description}</div>}
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={e => !locked && onChange(e.target.checked)} disabled={locked} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', cursor: locked ? 'not-allowed' : 'pointer', top: 0, left: 0, right: 0, bottom: 0,
          background: checked && !locked ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.1)',
          borderRadius: '24px', transition: 'all 0.25s ease'
        }}>
          <span style={{
            position: 'absolute', height: '18px', width: '18px', left: checked ? '22px' : '3px', bottom: '3px',
            background: '#fff', borderRadius: '50%', transition: 'left 0.25s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
        </span>
      </label>
    </div>
  );
}

function SettingInput({ label, description, value, onChange, type = 'text', placeholder = '' }: {
  label: string; description?: string; value: string | number; onChange: (v: any) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>{label}</label>
      <input
        type={type}
        className="input-field"
        value={value}
        onChange={e => onChange(type === 'number' ? (parseInt(e.target.value) || null) : e.target.value)}
        placeholder={placeholder}
      />
      {description && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem', lineHeight: 1.5 }}>{description}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
        <span style={{ fontSize: '1.3rem' }}>{icon}</span> {title}
      </h3>
      {description && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>{description}</p>}
    </div>
  );
}

// ── GitHub Backup Component ───────────────────────────────────────────────────
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
    } catch { showToast('error', '❌ Netwerkfout'); }
    finally { setPushing(false); }
  };

  return (
    <form onSubmit={handlePush} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>GitHub Gebruikersnaam / Org</label>
          <input className="input-field" value={form.repoOwner} onChange={e => setF('repoOwner', e.target.value)} placeholder="bijv. mijnschool-it" />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>Repository Naam</label>
          <input className="input-field" value={form.repoName} onChange={e => setF('repoName', e.target.value)} placeholder="bijv. locra-backups" />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>GitHub Personal Access Token</label>
          <input className="input-field" type="password" value={form.ghToken} onChange={e => setF('ghToken', e.target.value)} placeholder="ghp_..." autoComplete="off" />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Vereist <code>repo</code> scope. Maak aan via <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: '#a5b4fc' }}>github.com/settings/tokens</a>
          </p>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>Branch</label>
          <input className="input-field" value={form.branch} onChange={e => setF('branch', e.target.value)} placeholder="main" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="submit" disabled={pushing} style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', background: 'linear-gradient(135deg, #24292e, #3d4450)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, cursor: pushing ? 'not-allowed' : 'pointer', opacity: pushing ? 0.7 : 1, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🐙 {pushing ? 'Bezig met pushen...' : 'Nu naar GitHub Pushen'}
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Bestand wordt opgeslagen als <code>locra-backups/backup-{'{datum}'}.json</code>
        </span>
      </div>
    </form>
  );
}

// ── Hoofd Component ──────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const token = useAuthStore(state => state.token);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('features');
  
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
    // Email
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    smtpFromEmail: '',
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const isEduPlus = licenseData?.isEduPlus || ['edu-plus', 'enterprise'].includes(settings?.licenseTier);

  const tabs = [
    { id: 'features', label: '🔧 Functies' },
    { id: 'security', label: '🔒 Beveiliging' },
    { id: 'auth', label: '🔑 Authenticatie' },
    { id: 'limits', label: '⚖️ Limieten' },
    { id: 'rag', label: '📚 RAG & AI' },
    { id: 'imagegen', label: '🎨 Afbeeldingen' },
    { id: 'loadbalancing', label: '⚖️ AI Servers' },
    { id: 'federation', label: '🌍 Federatie' },
    { id: 'performance', label: '⚡ Performance' },
    { id: 'integrations', label: '☁️ Cloud API' },
    { id: 'email', label: '📧 E-mail' },
    { id: 'backup', label: '💾 Backup' },
    { id: 'license', label: '🎓 Licentie' },
  ];

  return (
    <form onSubmit={handleSave} style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          padding: '1rem 1.5rem', borderRadius: '14px', fontWeight: 600, fontSize: '0.9rem',
          backdropFilter: 'blur(12px)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          animation: 'slideInRight 0.3s ease'
        }}>
          {toast.text}
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Systeem Instellingen
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: '0.4rem', marginBottom: 0 }}>
            Configureer alle aspecten van jouw Locra omgeving.
          </p>
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ borderRadius: '12px', padding: '0.75rem 2rem', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
          {saving ? '⏳ Opslaan...' : '💾 Wijzigingen Opslaan'}
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none', cursor: 'pointer', fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: '0.82rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
              boxShadow: activeTab === tab.id ? '0 4px 15px rgba(99,102,241,0.3)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* ── FUNCTIES ── */}
        {activeTab === 'features' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.1))',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span> Nieuw: Uitgebreid Functiebeheer
                </h4>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Beheer platformmodules, live internet zoeken (met PII-privacyfilter), quizzen en meer via het speciale dashboard.
                </p>
              </div>
              <a
                href="/admin/features"
                style={{
                  background: '#6366f1',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Naar Functiebeheer →
              </a>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🔧" title="Algemene Functies" description="Schakel de basisfuncties in of uit voor alle gebruikers." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingToggle label="Live Internet Zoeken" description="Laat Locra via DuckDuckGo op het internet zoeken." checked={settings.enableWebSearch} onChange={v => set('enableWebSearch', v)} />
                <SettingToggle label="Bijlagen & Bestandsuploads" description="Leerlingen kunnen bestanden meesturen in de chat." checked={settings.enableAttachments} onChange={v => set('enableAttachments', v)} />
                <SettingToggle label="Gedeelde Gesprekken" description="Gebruikers kunnen een link naar hun chat delen." checked={settings.enableSharedChats} onChange={v => set('enableSharedChats', v)} />
                <SettingToggle label="Samenwerkingsgesprekken" description="Meerdere gebruikers kunnen in dezelfde chat deelnemen." checked={settings.enableCollabChats} onChange={v => set('enableCollabChats', v)} />
                <SettingToggle label="Feedback op AI-antwoorden" description="Duim omhoog/omlaag knoppen op berichten." checked={settings.enableFeedback} onChange={v => set('enableFeedback', v)} />
                <SettingToggle label="Rapportage" description="Analytics en gespreksrapporten voor beheerders." checked={settings.enableReporting} onChange={v => set('enableReporting', v)} />
                <SettingToggle label="Plugins & Uitbreidingen" description="Externe plugins voor extra Locra-functionaliteit." checked={settings.enablePlugins} onChange={v => set('enablePlugins', v)} />
                <SettingToggle label="Antwoord Caching" description="Sla identieke vragen op voor snellere reacties." checked={settings.enableCaching} onChange={v => set('enableCaching', v)} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🎓" title="Onderwijs & Privacy Functies" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingToggle label="Leerlingen Co-op" description="Sta leerlingen toe om zelf een Groepschat/Co-op te maken en medeleerlingen uit te nodigen." checked={settings.allowStudentCoop} onChange={v => set('allowStudentCoop', v)} />
                <SettingToggle label="Quiz Modus" description="De AI kan leerlingen overhoren en scoren op basis van documenten." checked={settings.enableQuizMode} onChange={v => set('enableQuizMode', v)} />
                <SettingToggle label="Opstel-Coach Modus" description="De AI kijkt ingezonden opstellen na en geeft gestructureerde feedback." checked={settings.enableEssayCoach} onChange={v => set('enableEssayCoach', v)} />
                <SettingInput label="Trefwoordfilter (Blocked Keywords)" description="Woorden gescheiden door komma's waar de AI niet op mag reageren." value={settings.blockedKeywords || ''} onChange={v => set('blockedKeywords', v)} placeholder="bijv: scheldwoord1, geweld, pesten" />
                
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>🕒 Tijdslot & Beschikbaarheid</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <SettingInput label="Start Tijd" description="Vanaf wanneer AI beschikbaar is (bijv. 08:00)" value={settings.activeTimeStart || ''} onChange={v => set('activeTimeStart', v)} placeholder="08:00" />
                    <SettingInput label="Eind Tijd" description="Tot wanneer AI beschikbaar is (bijv. 17:00)" value={settings.activeTimeEnd || ''} onChange={v => set('activeTimeEnd', v)} placeholder="17:00" />
                  </div>
                  <SettingInput label="Actieve Dagen (1=Ma, 5=Vr)" description="Vul in als bijv. [1,2,3,4,5] voor schooldagen." value={settings.activeDays || ''} onChange={v => set('activeDays', v)} placeholder="[1,2,3,4,5]" />
                </div>

                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }}></div>

                <SettingToggle label="AI Watermarking" description="Onzichtbaar steganografisch watermerk in alle AI-antwoorden." checked={settings.enableWatermark} onChange={v => set('enableWatermark', v)} locked={!isEduPlus} lockedMsg="Vereist EDU Plus licentie." />
                <SettingToggle label="Plagiaatdetectie" description="Vergelijk inzendingen automatisch op AI-gegenereerde inhoud." checked={settings.enablePlagiarismCheck} onChange={v => set('enablePlagiarismCheck', v)} locked={!isEduPlus} lockedMsg="Vereist EDU Plus licentie." />
                <SettingToggle label="Leerdoelen & Modules" description="Beheer leerlingvoortgang via de Academy module." checked={settings.enableLearningGoals} onChange={v => set('enableLearningGoals', v)} />
                <SettingToggle label="Examenstand" description="Blokkeert internet en bijlagen voor alle leerlingen tijdelijk." checked={settings.enableExamMode} onChange={v => set('enableExamMode', v)} />
                <SettingToggle label="Anonieme Telemetrie" description="Stuur anonieme gebruiksstatistieken ter verbetering van Locra." checked={settings.enableTelemetry} onChange={v => set('enableTelemetry', v)} />
                <SettingToggle label="Automatische Updates" description="Locra controleert automatisch op nieuwe versies." checked={settings.enableAutoUpdate} onChange={v => set('enableAutoUpdate', v)} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="⚡" title="Limieten & Credits" description="Stel de standaard limieten in voor de gehele organisatie. Per klas of persoon kun je hogere limieten instellen via het Limieten paneel." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Org-brede standaard limieten — ALTIJD zichtbaar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <SettingInput
                    label="⚡ Standaard Credits / maand"
                    description="Basis-limiet per gebruiker. Hogere per-klas of per-persoon limieten overschrijven dit."
                    value={settings.defaultCreditsPerUser}
                    onChange={v => set('defaultCreditsPerUser', v)}
                    type="number"
                    placeholder="100"
                  />
                  <SettingInput
                    label="📅 Max. chats / dag (org)"
                    description="Standaard maximaal aantal chats per dag per gebruiker. 0 = onbeperkt."
                    value={settings.maxPromptsPerDay || ''}
                    onChange={v => set('maxPromptsPerDay', v)}
                    type="number"
                    placeholder="50"
                  />
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>🔄 Reset Interval</label>
                    <select className="input-field" value={settings.creditResetInterval} onChange={e => set('creditResetInterval', e.target.value)}>
                      <option value="daily">Dagelijks</option>
                      <option value="monthly">Maandelijks</option>
                      <option value="never">Nooit (handmatig)</option>
                    </select>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Hoe vaak de limiet wordt gereset
                    </p>
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <SettingToggle label="Credits Systeem Inschakelen" description="Elke modelaanroep kost credits. Beheer wie hoeveel mag gebruiken." checked={settings.enableCredits} onChange={v => set('enableCredits', v)} />
                  <SettingToggle label="Rate Limiting Inschakelen" description="Handhaaf de daglimieten actief voor alle gebruikers." checked={settings.enableRateLimiting} onChange={v => set('enableRateLimiting', v)} />
                </div>

                {/* Docent rechten */}
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '10px' }}>
                  <SettingToggle label="👩‍🏫 Docenten mogen limieten voor hun klas aanpassen" checked={settings.allowTeachersToOverrideQuota} onChange={v => set('allowTeachersToOverrideQuota', v)} />
                  {settings.allowTeachersToOverrideQuota && (
                    <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem' }}>
                      <SettingInput label="Maximum instelling door docent" description="Docenten kunnen nooit meer instellen dan dit getal." value={settings.maxTeacherOverrideQuota || ''} onChange={v => set('maxTeacherOverrideQuota', v)} type="number" placeholder="Onbeperkt" />
                    </div>
                  )}
                </div>

                {/* Link naar QuotasPanel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', fontSize: '0.82rem', color: 'rgba(165,180,252,0.85)' }}>
                  <span style={{ fontSize: '1rem' }}>🎛️</span>
                  <span style={{ flex: 1 }}>
                    <strong>Per klas of persoon</strong> een hogere of lagere limiet instellen?
                    Ga naar het <strong>Limieten & Modeltoegang</strong> paneel voor individuele overschrijvingen.
                  </span>
                  <a href="/admin/quotas" style={{ padding: '0.35rem 0.8rem', borderRadius: '7px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', border: '1px solid rgba(99,102,241,0.3)', whiteSpace: 'nowrap' }}>
                    Limieten beheren →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ── BEVEILIGING ── */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="💾" title="Chatopslag" description="Bepaal waar en hoe gesprekken worden opgeslagen." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>Standaard Opslaglocatie</label>
                  <select className="input-field" value={settings.chatStorageMode} onChange={e => set('chatStorageMode', e.target.value)}>
                    <option value="server">Centrale Server (School Database)</option>
                    <option value="local">Lokaal (Browser Leerling)</option>
                    <option value="hybrid">Hybride (Gebruiker kiest)</option>
                  </select>
                </div>
                <SettingToggle label="Leerlingen kiezen zelf opslaglocatie" checked={settings.userCanChooseStorage} onChange={v => set('userCanChooseStorage', v)} />
                <SettingToggle label="Data Anonimisering" description="Wist IP's, namen en headers automatisch na 24u in logs." checked={settings.enableAnonymization} onChange={v => set('enableAnonymization', v)} />
                <SettingToggle label="Audit Logging" description="Sla elke actie van beheerders en docenten op in een logboek." checked={settings.enableAuditLogging} onChange={v => set('enableAuditLogging', v)} />
                <SettingToggle label="End-to-End Versleuteling" description="Berichten worden versleuteld opgeslagen (AES-256)." checked={settings.enableE2EEncryption} onChange={v => set('enableE2EEncryption', v)} />
                <SettingInput label="Bewaarperiode Chatdata (Dagen)" description="Na hoeveel dagen worden oude gesprekken automatisch verwijderd? Leeg = nooit." value={settings.dataRetentionDays || ''} onChange={v => set('dataRetentionDays', v)} type="number" placeholder="Onbeperkt" />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🌐" title="Netwerk & Toegang" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SettingToggle label="Netwerk Isolatie" description="Blokkeert alle externe verbindingen buiten de schoolinfrastructuur." checked={settings.enableNetworkIsolation} onChange={v => set('enableNetworkIsolation', v)} />
                <SettingToggle label="Open PCC Modus" description="Voldoet aan de eisen voor Open Privacy & Compliance Control." checked={settings.enableOpenPCC} onChange={v => set('enableOpenPCC', v)} />
                <SettingInput label="IP Whitelist (Netwerktoegang)" description="Alleen toegang vanuit deze IP-ranges. Komma-gescheiden. Leeg = iedereen." value={settings.allowedIps || ''} onChange={v => set('allowedIps', v)} placeholder="192.168.1.0/24, 10.0.0.0/8" />
                <SettingInput label="Custom Domein" description="Eigen domeinnaam voor Locra (bijv. chat.mijnschool.nl)." value={settings.customDomain || ''} onChange={v => set('customDomain', v)} placeholder="chat.mijnschool.nl" />
              </div>
            </div>
          </div>
        )}

        {/* ── AUTHENTICATIE ── */}
        {activeTab === 'auth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🔑" title="Loginmethoden" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingToggle label="Lokale Accounts (E-mail + Wachtwoord)" checked={settings.enableLocalAuth} onChange={v => set('enableLocalAuth', v)} />
                <SettingToggle label="Gast Toegang (Zonder Account)" description="Bezoekers kunnen chatten zonder in te loggen (geen chatgeschiedenis)." checked={settings.enableGuestAccess} onChange={v => set('enableGuestAccess', v)} />
                <SettingToggle label="Tweestapsverificatie (2FA)" description="Verplicht TOTP-app of e-mailcode bij inloggen." checked={settings.enable2FA} onChange={v => set('enable2FA', v)} />
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>Registratie Methode</label>
                  <select className="input-field" value={settings.registrationMode} onChange={e => set('registrationMode', e.target.value)}>
                    <option value="admin">Alleen via beheerder / uitnodiging</option>
                    <option value="self">Open registratie (iedereen mag aanmelden)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🏫" title="Entree Kennisnet (SSO)" description="Laat leerlingen en docenten inloggen via hun schoolaccount." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SettingToggle label="Kennisnet SSO Inschakelen" checked={settings.enableKennisnet} onChange={v => set('enableKennisnet', v)} />
                {settings.enableKennisnet && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                    <SettingInput label="Client ID" value={settings.kennisnetClientId || ''} onChange={v => set('kennisnetClientId', v)} />
                    <SettingInput label="Client Secret" value={settings.kennisnetClientSecret || ''} onChange={v => set('kennisnetClientSecret', v)} type="password" />
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="📅" title="SOMtoday Koppeling" description="Synchroniseer rooster en cijfers via de SOMtoday API." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SettingToggle label="SOMtoday Integratie Inschakelen" checked={settings.enableSomtoday} onChange={v => set('enableSomtoday', v)} />
                {settings.enableSomtoday && (
                  <SettingInput label="SOMtoday School URL" description="Bijv. 'bonhoeffer-college' (de naam die voor .somtoday.nl staat)." value={settings.somtodayBaseUrl || ''} onChange={v => set('somtodayBaseUrl', v)} placeholder="mijnschool" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LIMIETEN ── */}
        {activeTab === 'limits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="⚖️" title="Globale Quotas" description="Maximale AI-aanvragen voor de gehele organisatie. Individuele gebruikers & klassen instelbaar via het Quotas menu." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SettingToggle label="Rate Limiting Inschakelen" checked={settings.enableRateLimiting} onChange={v => set('enableRateLimiting', v)} />
                {settings.enableRateLimiting && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                    <SettingInput label="Max per Dag" value={settings.maxPromptsPerDay || ''} onChange={v => set('maxPromptsPerDay', v)} type="number" placeholder="50" />
                    <SettingInput label="Max per Maand" value={settings.maxPromptsPerMonth || ''} onChange={v => set('maxPromptsPerMonth', v)} type="number" placeholder="1000" />
                    <SettingInput label="Max Deep Thinking per Dag" description="0 = uitgeschakeld" value={settings.maxThinkingPerDay || ''} onChange={v => set('maxThinkingPerDay', v)} type="number" placeholder="5" />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <SettingInput label="Max Tokens per Request" description="Standaard 4096. Bij M3 Pro: max 8192." value={settings.maxTokensPerRequest} onChange={v => set('maxTokensPerRequest', v)} type="number" />
                  <SettingInput label="Max Gelijktijdige Sessies" description="Hoeveel gebruikers tegelijk streamen." value={settings.maxConcurrency} onChange={v => set('maxConcurrency', v)} type="number" />
                  <SettingInput label="Wachtrij Timeout (sec)" description="Hoelang iemand wacht voor een time-out." value={settings.queueTimeoutSec} onChange={v => set('queueTimeoutSec', v)} type="number" />
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="👩‍🏫" title="Docent Quota Rechten" description="Sta docenten toe zelf quota in te stellen voor hun klassen." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingToggle label="Docenten mogen klasse-quota aanpassen" checked={settings.allowTeachersToOverrideQuota} onChange={v => set('allowTeachersToOverrideQuota', v)} />
                {settings.allowTeachersToOverrideQuota && (
                  <SettingInput label="Maximum Instelling door Docent" description="Docenten kunnen niet boven deze waarde per dag instellen." value={settings.maxTeacherOverrideQuota || ''} onChange={v => set('maxTeacherOverrideQuota', v)} type="number" placeholder="Onbeperkt" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── RAG & AI ── */}
        {activeTab === 'rag' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="📚" title="Kennisbank (RAG) Instellingen" description="Stel in hoe documenten worden verwerkt en opgezocht." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <SettingInput label="Embedding Model" description="Ollama model dat documenten verwerkt naar vectoren." value={settings.embeddingModel} onChange={v => set('embeddingModel', v)} placeholder="llama3 of nomic-embed-text" />
                <SettingInput label="Helper Model (Titels & Sorteren)" description="Ollama model voor o.a. de 'Sorteer met AI' functie en titel generatie." value={settings.orgHelperModel} onChange={v => set('orgHelperModel', v)} placeholder="qwen3.5:9b" />
                <SettingInput label="Chunk Grootte (Woorden)" description="Hoe groot elke tekstbrok is. Standaard: 250." value={settings.ragChunkSize} onChange={v => set('ragChunkSize', v)} type="number" />
                <SettingInput label="Chunk Overlap (Woorden)" description="Hoeveel overlap tussen brokken voor context. Standaard: 60." value={settings.ragChunkOverlap} onChange={v => set('ragChunkOverlap', v)} type="number" />
                <SettingInput label="Minimale Relevantiescore (0-1)" description="Brokken onder deze score worden genegeerd. Standaard: 0.25." value={settings.ragMinScore} onChange={v => set('ragMinScore', v)} placeholder="0.25" />
                <SettingInput label="Max Aantal Brokken naar AI" description="Hoeveel relevante stukken tekst de AI meekrijgt. Standaard: 5." value={settings.ragTopN} onChange={v => set('ragTopN', v)} type="number" />
              </div>
            </div>
          </div>
        )}

        {/* ── AFBEELDINGEN GENEREREN ── */}
        {activeTab === 'imagegen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🎨" title="Afbeeldingen Genereren" description="Koppel een API voor Text-to-Image functionaliteit." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <SettingInput label="OpenAI API Key (DALL-E)" description="Vul je OpenAI API-sleutel in voor het genereren van afbeeldingen (optioneel)." value={settings.imageGenApiKey || ''} onChange={v => set('imageGenApiKey', v)} type="password" />
                <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', marginTop: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#60a5fa' }}><strong>Let op:</strong> Momenteel werken we via cloud API's. Binnenkort kun je ook lokale modellen (zoals Stable Diffusion via A1111) koppelen voor gratis en onbeperkte generaties!</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AI SERVERS (LOAD BALANCING) ── */}
        {activeTab === 'loadbalancing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="⚖️" title="AI Servers (Load Balancing)" description="Koppel meerdere Ollama servers om de chat-belasting te verdelen." />
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Deze functie is zojuist geactiveerd op de backend! De database kiest nu willekeurig een actieve server uit de `OllamaNode` tabel bij elk verzoek.</p>
                <p><i>De beheerders-UI voor het toevoegen van servers komt in een volgende update.</i></p>
              </div>
            </div>
          </div>
        )}

        {/* ── FEDERATION ── */}
        {activeTab === 'federation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🌍" title="Locra Federatie" description="Koppel jouw Locra-instantie aan andere scholen om veilig lesmateriaal te delen." />
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Jouw server kan nu veilig communiceren met andere Locra backends!</p>
                <p><i>De interface voor het uitwisselen van lesmateriaal via de `LocraNode` tabel wordt momenteel gebouwd.</i></p>
              </div>
            </div>
          </div>
        )}

        {/* ── PERFORMANCE ── */}
        {activeTab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.04))', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: 0, marginBottom: 0, lineHeight: 1.6 }}>
                💡 <strong>Let op:</strong> Ollama draait onafhankelijk van Locra. Sommige waarden (zoals NUM_PARALLEL) moeten ook als omgevingsvariabelen worden ingesteld in de Ollama service om echt effect te hebben. De waarden hier worden gebruikt als limieten voor de Locra wachtrij.
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="⚡" title="Ollama Performance Tuning" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <SettingInput label="Max Parallelle Gebruikers" description="OLLAMA_NUM_PARALLEL — Aanbeveling: M3 Pro 18GB = 2, Server 64GB = 6." value={settings.ollamaNumParallel} onChange={v => set('ollamaNumParallel', v || 1)} type="number" />
                </div>
                <div>
                  <SettingInput label="Max Ingeladen Modellen" description="OLLAMA_MAX_LOADED_MODELS — Hoeveel LLMs tegelijk in RAM." value={settings.ollamaMaxLoadedModels} onChange={v => set('ollamaMaxLoadedModels', v || 1)} type="number" />
                </div>
                <div>
                  <SettingInput label="Context Geheugen (Tokens)" description="OLLAMA_CONTEXT_LENGTH — 0 = auto. Standaard: 4096." value={settings.ollamaContextLength} onChange={v => set('ollamaContextLength', v || 0)} type="number" />
                </div>
                <div>
                  <SettingInput label="Model Keep-Alive Duur" description="Hoe lang model in RAM blijft. Bijv: 5m, 1h, -1 (altijd)." value={settings.ollamaKeepAlive} onChange={v => set('ollamaKeepAlive', v)} placeholder="5m" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CLOUD API ── */}
        {activeTab === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="☁️" title="Cloud API Integraties" description="Verbind externe AI-providers voor aanvullende modellen." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingToggle label="Cloud API Integraties Inschakelen" description="Maakt gebruik van externe providers naast de lokale Ollama modellen." checked={settings.apiIntegrationEnabled} onChange={v => set('apiIntegrationEnabled', v)} />
                {settings.apiIntegrationEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginTop: '0.5rem' }}>
                    <SettingInput label="OpenAI API Key" value={settings.openAiApiKey || ''} onChange={v => set('openAiApiKey', v)} type="password" placeholder="sk-..." />
                    <SettingInput label="Anthropic API Key (Claude)" value={settings.anthropicApiKey || ''} onChange={v => set('anthropicApiKey', v)} type="password" placeholder="sk-ant-..." />
                    <SettingInput label="HuggingFace API Key (Open Source + Image Gen)" value={settings.huggingFaceApiKey || ''} onChange={v => set('huggingFaceApiKey', v)} type="password" placeholder="hf_..." />
                    <SettingInput label="OpenRouter API Key (Multi-model toegang)" value={settings.openRouterApiKey || ''} onChange={v => set('openRouterApiKey', v)} type="password" placeholder="sk-or-..." />
                  </div>
                )}
              </div>
            </div>
            {settings.apiIntegrationEnabled && (
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <SectionHeader icon="💰" title="API Kostenmonitoring" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'Huidige Kosten (Maand)', value: `€${(settings.currentApiCost || 0).toFixed(2)}`, color: '#6366f1' },
                    { label: 'Schatting Volgende Maand', value: `€${((settings.currentApiCost || 0) * 1.2).toFixed(2)}`, color: '#06b6d4' },
                    { label: 'Schatting Dit Jaar', value: `€${((settings.currentApiCost || 0) * 13).toFixed(2)}`, color: '#f59e0b' },
                  ].map(stat => (
                    <div key={stat.label} style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.3)', borderRadius: '14px', border: `1px solid ${stat.color}30` }}>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{stat.label}</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── E-MAIL ── */}
        {activeTab === 'email' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <SectionHeader icon="📧" title="SMTP E-mailconfiguratie" description="Vereist voor wachtwoord-reset e-mails en meldingen." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <SettingInput label="SMTP Host" value={settings.smtpHost || ''} onChange={v => set('smtpHost', v)} placeholder="smtp.gmail.com" />
              <SettingInput label="SMTP Poort" value={settings.smtpPort || ''} onChange={v => set('smtpPort', v)} type="number" placeholder="587" />
              <SettingInput label="SMTP Gebruikersnaam" value={settings.smtpUser || ''} onChange={v => set('smtpUser', v)} placeholder="no-reply@mijnschool.nl" />
              <SettingInput label="SMTP Wachtwoord" value={settings.smtpPass || ''} onChange={v => set('smtpPass', v)} type="password" />
              <div style={{ gridColumn: '1 / -1' }}>
                <SettingInput label="Afzenderadres (From)" value={settings.smtpFromEmail || ''} onChange={v => set('smtpFromEmail', v)} placeholder="Locra <no-reply@mijnschool.nl>" />
              </div>
            </div>
            {/* SMTP Test knop */}
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
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
                    if (res.ok) showToast('success', '✅ ' + (d.message || 'Testmail verstuurd!'));
                    else showToast('error', '❌ ' + (d.error || 'SMTP test mislukt'));
                  } catch { showToast('error', '❌ Netwerkfout bij SMTP test'); }
                }}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                📬 Test SMTP Verbinding
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Stuurt een testmail naar je eigen beheerder-e-mailadres.
              </span>
            </div>
          </div>
        )}


        {/* ── BACKUP ── */}
        {activeTab === 'backup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Directe downloads */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="⬇️" title="Nu Backup Maken" description="Download direct een back-up van je Locra installatie." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🗄️</div>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>SQLite Database</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Volledige database backup (.db bestand). Herstelbaar met <code>prisma db push</code>.
                  </div>
                  <button
                    onClick={async () => {
                      const token = useAuthStore.getState().token;
                      const res = await fetch('/api/admin/backup/download', { headers: { Authorization: `Bearer ${token}` } });
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `locra-backup-${new Date().toISOString().slice(0,10)}.db`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } else {
                        alert('Download mislukt');
                      }
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    ⬇️ Database Downloaden
                  </button>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '14px' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📋</div>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>JSON Export</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Exporteer gebruikers, gesprekken en instellingen als leesbaar JSON-bestand.
                  </div>
                  <button
                    onClick={async () => {
                      const token = useAuthStore.getState().token;
                      const res = await fetch('/api/admin/backup/export-json', { headers: { Authorization: `Bearer ${token}` } });
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `locra-export-${new Date().toISOString().slice(0,10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } else {
                        alert('Export mislukt');
                      }
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    ⬇️ JSON Exporteren
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-backup instellingen */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🔄" title="Automatische Back-ups" description="Sla periodiek een back-up op van de database." />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SettingToggle label="Automatische Back-ups Inschakelen" checked={settings.enableAutoBackup} onChange={v => set('enableAutoBackup', v)} />
                {settings.enableAutoBackup && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                    <SettingInput label="Back-up Interval (Uren)" value={settings.backupIntervalHours} onChange={v => set('backupIntervalHours', v)} type="number" placeholder="24" />
                    <SettingInput label="Bewaarperiode (Dagen)" value={settings.backupRetentionDays} onChange={v => set('backupRetentionDays', v)} type="number" placeholder="30" />
                  </div>
                )}
              </div>
            </div>

            {/* GitHub Backup */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🐙" title="Backup naar GitHub" description="Push een JSON-export naar een privé GitHub repository voor externe opslag en versiebeheer." />
              <GithubBackupSection token={token || ''} showToast={showToast} />
            </div>
          </div>
        )}


        {/* ── LICENTIE ── */}
        {activeTab === 'license' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: isEduPlus ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.06))' : 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: `1px solid ${isEduPlus ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
              <SectionHeader icon="🎓" title="Locra Licentie" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', background: isEduPlus ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                  {licenseData?.tier?.toUpperCase() || settings?.licenseTier?.toUpperCase() || 'FREE'}
                </div>
                {isEduPlus && <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>✅ EDU Plus functies beschikbaar</span>}
              </div>
              {licenseMsg && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '10px', background: licenseMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: licenseMsg.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${licenseMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {licenseMsg.text}
                </div>
              )}
              <form onSubmit={handleActivateLicense} style={{ display: 'flex', gap: '0.75rem' }}>
                <input type="text" className="input-field" placeholder="LOCRA-XXXX-XXXX-XXXX" value={licenseKeyInput} onChange={e => setLicenseKeyInput(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} disabled={activatingLicense} />
                <button type="submit" className="btn btn-primary" disabled={activatingLicense} style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                  {activatingLicense ? '⏳ Controleren...' : '🔑 Activeer / Update'}
                </button>
              </form>
              {licenseData?.key && (
                <button type="button" onClick={handleUnlinkLicense} style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                  Licentie ontkoppelen
                </button>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SectionHeader icon="🔄" title="Systeem Update" description="Haal de nieuwste versie van Locra op vanuit GitHub." />
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginTop: 0 }}>
                Dit voert automatisch <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px' }}>git pull</code> → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px' }}>npm install</code> → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px' }}>npm run build</code> uit. De server herstart daarna automatisch.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!confirm('Weet je zeker dat je de server wilt updaten? De server zal kortstondig offline zijn.')) return;
                  try {
                    const res = await fetch('/api/admin/system/update', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                    const data = await res.json();
                    showToast(data.status === 'updating' ? 'success' : 'error', data.message || data.error);
                  } catch (e: any) { showToast('error', 'Fout: ' + e.message); }
                }}
                style={{ width: 'auto' }}
              >
                🚀 Start Systeem Update
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
