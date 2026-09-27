import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function SettingsPanel() {
  const token = useAuthStore(state => state.token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  
  // License state
  const [licenseData, setLicenseData] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [settings, setSettings] = useState<any>({
    enableE2EEncryption: true,
    enableWatermark: true,
    enableKennisnet: false,
    kennisnetClientId: '',
    kennisnetClientSecret: '',
    maxTokensPerRequest: 4096,
    chatStorageMode: 'server',
    enableWebSearch: false,
    enableNetworkIsolation: false,
    customDomain: '',
    allowedIps: '',
    enableRateLimiting: true,
    maxPromptsPerDay: 50,
    maxPromptsPerMonth: 1000,
    enableAnonymization: false,
    dataRetentionDays: 30,
    enableAuditLogging: false,
    userCanChooseStorage: true,
    enableExamMode: false,
    enableLocalAuth: true,
    enableGuestAccess: false,
    enable2FA: false,
    registrationMode: 'admin',
    embeddingModel: 'llama3',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    smtpFromEmail: '',
    ollamaNumParallel: 1,
    ollamaMaxLoadedModels: 1,
    ollamaKeepAlive: '5m',
    ollamaContextLength: 4096
  });

  const loadLicense = () => {
    fetch('/api/settings/license', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setLicenseData(data);
          if (data.key) setLicenseKeyInput(data.key);
        }
      })
      .catch(err => console.error('Failed to load license', err));
  };

  useEffect(() => {
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSettings((prev: any) => ({ ...prev, ...data }));
      })
      .catch(err => console.error(err));

    loadLicense();
  }, [token]);

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setLicenseMsg({ type: 'error', text: 'Vul een licentiesleutel in.' });
      return;
    }
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
      if (data.license?.watermarkActive) {
        setSettings((prev: any) => ({ ...prev, enableWatermark: true, licenseTier: data.license.tier }));
      }
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
      const res = await fetch('/api/settings/license/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLicenseKeyInput('');
        setLicenseMsg({ type: 'success', text: 'Licentie ontkoppeld.' });
        loadLicense();
      }
    } catch (e: any) {
      setLicenseMsg({ type: 'error', text: 'Fout bij ontkoppelen: ' + e.message });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
      setSuccess('Instellingen succesvol opgeslagen.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isEduPlus = licenseData?.isEduPlus || ['edu-plus', 'enterprise'].includes(settings?.licenseTier);

  const tabs = [
    { id: 'general', label: 'Algemeen' },
    { id: 'security', label: 'Security & Opslag' },
    { id: 'auth', label: 'Authenticatie & Rechten' },
    { id: 'limits', label: 'Quotas & Limieten' },
    { id: 'performance', label: 'Performance & AI' },
    { id: 'license', label: 'Licentie & Systeem' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Systeem Instellingen</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Configureer de globale instellingen van deze Locra omgeving.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'auto' }}>
          {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
        </button>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="badge badge-success" style={{ marginBottom: '1rem', padding: '1rem', display: 'block', borderRadius: '8px' }}>✅ {success}</div>}

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '2rem', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3>Algemene Features</h3>
            
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableWebSearch} onChange={e => setSettings({...settings, enableWebSearch: e.target.checked})} />
              <div>
                <strong>Live Internet Zoeken</strong>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Laat Locra op het internet zoeken (DuckDuckGo integration).</div>
              </div>
            </label>

            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableExamMode} onChange={e => setSettings({...settings, enableExamMode: e.target.checked})} />
              <div>
                <strong>Examenstand Activeren</strong>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Beperkt tijdelijk alle leerlingen tot specifieke whitelisted modellen en kennisbanken.</div>
              </div>
            </label>
            
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableWatermark} onChange={e => setSettings({...settings, enableWatermark: e.target.checked})} disabled={!isEduPlus} />
              <div>
                <strong>AI Watermarking {isEduPlus ? '' : '🔒'}</strong>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Onzichtbaar watermerk injecteren in AI-antwoorden (vereist EDU Plus).</div>
              </div>
            </label>
            
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Ingebouwd Embedding Model (RAG)</label>
              <input type="text" className="input-field" value={settings.embeddingModel} onChange={e => setSettings({...settings, embeddingModel: e.target.value})} placeholder="Bijv. llama3 of nomic-embed-text" />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Model dat wordt gebruikt voor het vectoriseren van geüploade documenten.</div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3>Netwerk & Opslag</h3>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Standaard Opslaglocatie Chatgeschiedenis</label>
              <select className="input-field" value={settings.chatStorageMode} onChange={e => setSettings({...settings, chatStorageMode: e.target.value})}>
                <option value="server">Centrale Server (School Database)</option>
                <option value="local">Lokaal (Browser van Leerling)</option>
              </select>
            </div>

            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.userCanChooseStorage} onChange={e => setSettings({...settings, userCanChooseStorage: e.target.checked})} />
              <div>
                <strong>Laat leerlingen zelf hun opslaglocatie kiezen</strong>
              </div>
            </label>
            
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableAnonymization} onChange={e => setSettings({...settings, enableAnonymization: e.target.checked})} />
              <div>
                <strong>Data Anonimisering Activeren</strong>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Wist IP's, namen en headers na 24 uur in logs.</div>
              </div>
            </label>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Netwerk Isolatie IP Ranges (optioneel)</label>
              <input type="text" className="input-field" value={settings.allowedIps || ''} onChange={e => setSettings({...settings, allowedIps: e.target.value})} placeholder="Bijv. 192.168.1.0/24, 10.0.0.0/8" />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Alleen toegang toestaan vanaf het schoolnetwerk. (Komma-gescheiden)</div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Retentietijd Chatdata (Dagen)</label>
              <input type="number" className="input-field" value={settings.dataRetentionDays || ''} onChange={e => setSettings({...settings, dataRetentionDays: parseInt(e.target.value) || null})} placeholder="Ongelimiteerd" />
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3>Authenticatie Instellingen</h3>

            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableLocalAuth} onChange={e => setSettings({...settings, enableLocalAuth: e.target.checked})} />
              <div>
                <strong>Lokale accounts toestaan (E-mail / Wachtwoord)</strong>
              </div>
            </label>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Registratie Methode</label>
              <select className="input-field" value={settings.registrationMode} onChange={e => setSettings({...settings, registrationMode: e.target.value})}>
                <option value="admin">Alleen via beheerder / uitnodiging</option>
                <option value="self">Open registratie (self-service)</option>
              </select>
            </div>

            <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <input type="checkbox" checked={settings.enableKennisnet} onChange={e => setSettings({...settings, enableKennisnet: e.target.checked})} />
                <div>
                  <strong>Entree Kennisnet Login (SSO)</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Laat leerlingen en docenten inloggen via Kennisnet.</div>
                </div>
              </label>

              {settings.enableKennisnet && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Client ID</label>
                    <input type="text" className="input-field" value={settings.kennisnetClientId || ''} onChange={e => setSettings({...settings, kennisnetClientId: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Client Secret</label>
                    <input type="password" className="input-field" value={settings.kennisnetClientSecret || ''} onChange={e => setSettings({...settings, kennisnetClientSecret: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'limits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3>Quotas & Limieten</h3>
            
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="checkbox" checked={settings.enableRateLimiting} onChange={e => setSettings({...settings, enableRateLimiting: e.target.checked})} />
              <div>
                <strong>Strikte Rate Limiting Inschakelen</strong>
              </div>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Max Prompts per Dag</label>
                <input type="number" className="input-field" value={settings.maxPromptsPerDay || ''} onChange={e => setSettings({...settings, maxPromptsPerDay: parseInt(e.target.value) || null})} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Max Prompts per Maand</label>
                <input type="number" className="input-field" value={settings.maxPromptsPerMonth || ''} onChange={e => setSettings({...settings, maxPromptsPerMonth: parseInt(e.target.value) || null})} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Max Tokens per Request (Context Limit)</label>
              <input type="number" className="input-field" value={settings.maxTokensPerRequest} onChange={e => setSettings({...settings, maxTokensPerRequest: parseInt(e.target.value) || 4096})} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Standaard is 4096. Verlaag dit bij hardware limitaties.</div>
            </div>
          </div>
        )}

        {activeTab === 'license' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3>Licentie & Systeem Updates</h3>
            
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <h4>Locra Licentie</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Huidige Tier: <strong style={{ color: 'var(--primary)' }}>{licenseData?.tier?.toUpperCase() || settings?.licenseTier?.toUpperCase() || 'FREE'}</strong>
              </p>

              {licenseMsg && (
                <div className={`badge badge-${licenseMsg.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '1rem', padding: '0.75rem', display: 'block', borderRadius: '8px' }}>
                  {licenseMsg.text}
                </div>
              )}

              <form onSubmit={handleActivateLicense} style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="LOCRA-XXXX-XXXX-XXXX"
                  value={licenseKeyInput}
                  onChange={e => setLicenseKeyInput(e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  disabled={activatingLicense}
                />
                <button type="submit" className="btn btn-primary" disabled={activatingLicense} style={{ width: 'auto' }}>
                  {activatingLicense ? 'Controleren...' : 'Activeer / Update'}
                </button>
              </form>
              
              {licenseData?.key && (
                <button type="button" onClick={handleUnlinkLicense} className="btn" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'rgba(248, 113, 113, 0.1)', color: 'var(--danger)' }}>
                  Ontkoppel Licentie
                </button>
              )}
            </div>
            
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <h4>Systeem Updates</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Werk de Locra serversoftware bij naar de nieuwste versie vanaf GitHub.
              </p>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={activatingLicense} // Reusing disabled state or add updateSystem state
                onClick={async () => {
                  if (!confirm("Weet je zeker dat je de server wilt updaten en herstarten? De server zal kortstondig offline zijn.")) return;
                  try {
                    const res = await fetch('/api/admin/system/update', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert("Update gestart. Controleer de console logs en wacht tot de server herstart is.");
                    } else {
                      alert("Update fout: " + data.error);
                    }
                  } catch(e: any) {
                    alert("Fout bij aanvragen update: " + e.message);
                  }
                }}
                style={{ width: 'auto' }}
              >
                Start Systeem Update
              </button>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h3>AI & Hardware Performance (Ollama)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Optimaliseer hoe Locra de lokale Ollama AI-engine gebruikt op basis van je server hardware. Let op: deze instellingen vereisen dat de <code>ollama</code> service herstart wordt als ze globaal worden toegepast, of ze worden meegegeven per request (afhankelijk van de Ollama API).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Max Parallelle Gebruikers</label>
                <input type="number" min="1" max="16" className="input-field" value={settings.ollamaNumParallel} onChange={e => setSettings({...settings, ollamaNumParallel: parseInt(e.target.value) || 1})} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  (OLLAMA_NUM_PARALLEL) Hoeveel gebruikers tegelijkertijd een antwoord kunnen genereren zonder in de wachtrij te komen.
                  <br/><strong>Aanbeveling:</strong> M-series Macs (16GB): 1-2. Dedicated servers (64GB): 4-8.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Max Ingeladen Modellen</label>
                <input type="number" min="1" max="5" className="input-field" value={settings.ollamaMaxLoadedModels} onChange={e => setSettings({...settings, ollamaMaxLoadedModels: parseInt(e.target.value) || 1})} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  (OLLAMA_MAX_LOADED_MODELS) Aantal verschillende LLMs dat tegelijk in RAM blijft.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Context Geheugen (Tokens)</label>
                <input type="number" step="1024" min="0" className="input-field" value={settings.ollamaContextLength} onChange={e => setSettings({...settings, ollamaContextLength: parseInt(e.target.value) || 0})} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Standaard 4096 (4K). Bij 0 bepaalt Ollama het zelf. Hoe hoger, hoe meer VRAM het kost. 
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Model Keep-Alive Tijd</label>
                <input type="text" className="input-field" value={settings.ollamaKeepAlive} onChange={e => setSettings({...settings, ollamaKeepAlive: e.target.value})} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Hoe lang een model in geheugen blijft (bijv. "5m", "1h", of "-1" voor altijd).
                </div>
              </div>
            </div>
            
            <div className="glass-panel" style={{ background: 'rgba(124, 92, 252, 0.1)', border: '1px solid rgba(124, 92, 252, 0.2)', padding: '1.5rem', marginTop: '1rem' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>💡 Hoe pas je dit toe?</h4>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                Omdat de Ollama-engine onafhankelijk draait van de web-server, moet je de environment-variabelen voor Ollama doorgeven op de host. Op Linux zet je ze in de systemd service <code>/etc/systemd/system/ollama.service</code>. 
                Deze waarden worden ook bewaard zodat de Locra concurrency limiter weet hoeveel sessies hij kan starten voordat leerlingen een "denken..." wachtscherm krijgen.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
