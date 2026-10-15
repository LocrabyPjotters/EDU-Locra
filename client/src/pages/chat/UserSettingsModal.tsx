import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

export default function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'account' | 'quota' | 'mobile'>('preferences');
  const [quotaData, setQuotaData] = useState<any>(null);

  // Mobile Pairing & Devices State
  const [pairData, setPairData] = useState<any>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [copiedCode, setCopiedCode] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [language, setLanguage] = useState(user?.language || 'nl');
  const [darkMode, setDarkMode] = useState(user?.darkMode || false);
  const [storagePref, setStoragePref] = useState(user?.storagePreference || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setLanguage(data.language || 'nl');
          setDarkMode(data.darkMode || false);
          setStoragePref(data.storagePreference || '');
        }
      });

    fetch('/api/users/me/quota', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) setQuotaData(data);
      });
  }, [token]);

  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch('/api/connect/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.devices) {
        setDevices(data.devices);
      }
    } catch (e) {
      console.warn('Fout bij ophalen apparaten:', e);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Weet je zeker dat je dit apparaat wilt ontkoppelen?')) return;
    try {
      const res = await fetch(`/api/connect/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Apparaat succesvol ontkoppeld uit de database!', 'success');
        setDevices(prev => prev.filter(d => d.id !== deviceId));
      } else {
        addToast(data.error || 'Kon apparaat niet ontkoppelen', 'error');
      }
    } catch (e: any) {
      addToast('Fout bij ontkoppelen: ' + e.message, 'error');
    }
  };

  const fetchPairingCode = async () => {
    setPairLoading(true);
    try {
      const res = await fetch('/api/connect/pair/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPairData(data);
        setTimeLeft(data.expiresInSeconds || 300);
      } else {
        addToast(data.error || 'Kon koppelcode niet aanmaken', 'error');
      }
    } catch (e: any) {
      addToast('Fout bij verbinden met server: ' + e.message, 'error');
    } finally {
      setPairLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mobile') {
      if (!pairData) fetchPairingCode();
      fetchDevices();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'mobile' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, timeLeft]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const payload: any = { language, darkMode };
    if (storagePref) payload.storagePreference = storagePref;
    if (password) payload.password = password;

    try {
      const res = await fetch('/api/users/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        addToast('Instellingen opgeslagen!', 'success');
        // Theme updates instantly via React states in App.tsx (if wired), or prompt reload
        if (user?.darkMode !== darkMode) {
          addToast('Thema gewijzigd. Herlaad de pagina indien nodig.', 'info');
        }
        onClose();
      } else {
        addToast('Er is een fout opgetreden bij het opslaan.', 'error');
      }
    } catch (err) {
      addToast('Netwerkfout bij opslaan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Weet je zeker dat je wilt uitloggen?')) {
      logout();
      onClose();
      navigate('/login');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{
        borderRadius: '24px', width: '600px', maxWidth: '95vw',
        padding: '0', display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: '400px'
      }}>
        {/* Sidebar */}
        <div style={{
          width: '180px',
          background: 'rgba(255,255,255,0.03)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 1rem'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.5rem 0', paddingLeft: '8px' }}>Instellingen</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              type="button"
              onClick={() => setActiveTab('preferences')}
              style={{
                background: activeTab === 'preferences' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'preferences' ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                fontWeight: activeTab === 'preferences' ? 600 : 400
              }}>
              🎨 Voorkeuren
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                background: activeTab === 'profile' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'profile' ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                fontWeight: activeTab === 'profile' ? 600 : 400
              }}>
              👤 Profiel
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('account')}
              style={{
                background: activeTab === 'account' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'account' ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                fontWeight: activeTab === 'account' ? 600 : 400
              }}>
              🔐 Account
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('quota')}
              style={{
                background: activeTab === 'quota' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'quota' ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                fontWeight: activeTab === 'quota' ? 600 : 400
              }}>
              📊 Quota & Gebruik
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('mobile')}
              style={{
                background: activeTab === 'mobile' ? 'rgba(124, 92, 252, 0.2)' : 'transparent',
                color: activeTab === 'mobile' ? '#c4b5fd' : 'var(--text-secondary)',
                border: activeTab === 'mobile' ? '1px solid rgba(124, 92, 252, 0.4)' : '1px solid transparent',
                padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                fontWeight: activeTab === 'mobile' ? 600 : 400
              }}>
              📱 Koppel App
            </button>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                textAlign: 'left'
              }}>
              🚪 Uitloggen
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {activeTab === 'preferences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.2s ease' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Weergave & Thema</h3>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.04)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input type="checkbox" checked={darkMode} onChange={e => setDarkMode(e.target.checked)} className="toggle" style={{ transform: 'scale(1.2)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>Dark Mode</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gebruik het donkere thema in de app. Ideaal voor de avonduren.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Weergavetaal</span>
                  <select value={language} onChange={e => setLanguage(e.target.value)} style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}>
                    <option value="nl">Nederlands</option>
                    <option value="en">Engels</option>
                  </select>
                </label>
              </div>
            )}

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.2s ease' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Jouw Profiel</h3>
                
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Weergavenaam</span>
                    <strong style={{ fontSize: '1.1rem' }}>{user?.displayName}</strong>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>E-mailadres</span>
                    <strong style={{ fontSize: '1rem' }}>{user?.email || 'Geen e-mail gekoppeld'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Rol</span>
                    <span style={{ background: 'rgba(124, 92, 252, 0.2)', color: '#c4b5fd', padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {user?.role === 'student' ? 'Leerling' : user?.role === 'teacher' ? 'Docent' : user?.role}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.2s ease' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Account & Beveiliging</h3>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Nieuw Wachtwoord instellen</span>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Laat leeg om niet te wijzigen"
                    style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }} 
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Privacy & Opslagvoorkeur</span>
                  <select value={storagePref} onChange={e => setStoragePref(e.target.value)} style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}>
                    <option value="">🏫 Standaard (schoolbeleid)</option>
                    <option value="server">☁️ Altijd Server (veilig opslaan)</option>
                    <option value="local">🔒 Altijd Lokaal (alleen op dit apparaat)</option>
                  </select>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Bepaalt waar jouw chatgeschiedenis wordt opgeslagen indien de school dit toelaat.
                  </span>
                </label>
              </div>
            )}

            {activeTab === 'quota' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeIn 0.2s ease' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Jouw Quota & Gebruik</h3>
                
                {quotaData ? (
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    {quotaData.enableCredits ? (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 500 }}>Credits Verbruikt</span>
                          <span style={{ fontWeight: 600 }}>{quotaData.creditsUsed} / {quotaData.totalCredits}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, (quotaData.creditsUsed / Math.max(1, quotaData.totalCredits)) * 100)}%`,
                            background: (quotaData.creditsUsed / Math.max(1, quotaData.totalCredits)) > 0.9 ? 'var(--danger)' : 'var(--primary)'
                          }} />
                        </div>
                      </div>
                    ) : null}

                    {quotaData.enableRateLimiting ? (
                      <>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 500 }}>Prompts Vandaag</span>
                            <span style={{ fontWeight: 600 }}>{quotaData.promptsToday} {quotaData.maxPromptsPerDay ? `/ ${quotaData.maxPromptsPerDay}` : ''}</span>
                          </div>
                          {quotaData.maxPromptsPerDay && (
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${Math.min(100, (quotaData.promptsToday / quotaData.maxPromptsPerDay) * 100)}%`,
                                background: (quotaData.promptsToday / quotaData.maxPromptsPerDay) > 0.9 ? 'var(--danger)' : 'var(--primary)'
                              }} />
                            </div>
                          )}
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 500 }}>Prompts Deze Maand</span>
                            <span style={{ fontWeight: 600 }}>{quotaData.promptsThisMonth} {quotaData.maxPromptsPerMonth ? `/ ${quotaData.maxPromptsPerMonth}` : ''}</span>
                          </div>
                          {quotaData.maxPromptsPerMonth && (
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${Math.min(100, (quotaData.promptsThisMonth / quotaData.maxPromptsPerMonth) * 100)}%`,
                                background: (quotaData.promptsThisMonth / quotaData.maxPromptsPerMonth) > 0.9 ? 'var(--danger)' : 'var(--primary)'
                              }} />
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}

                    {!quotaData.enableCredits && !quotaData.enableRateLimiting && (
                      <div style={{ color: 'var(--text-secondary)' }}>Er zijn geen limieten ingesteld voor jouw account.</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
                )}
              </div>
            )}

            {activeTab === 'mobile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease', textAlign: 'left', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>📱 Locra Mobiele App</h3>
                    <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px', background: 'rgba(124, 92, 252, 0.2)', color: '#c4b5fd', fontWeight: 700 }}>
                      iOS & Android
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                    ● Database Gekoppeld
                  </span>
                </div>

                {/* Stap 1: Download de App */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>1</span>
                    <strong style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>Download de Locra App</strong>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Installeer de officiële Locra app op je smartphone of tablet om overal toegang te hebben tot je school-AI.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    {/* iOS */}
                    <a
                      href="https://apps.apple.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        color: '#fff',
                        textDecoration: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🍏</span>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Download in</div>
                        <div style={{ fontWeight: 700 }}>App Store</div>
                      </div>
                    </a>

                    {/* Android */}
                    <a
                      href="https://play.google.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        color: '#fff',
                        textDecoration: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🤖</span>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ontdek op</div>
                        <div style={{ fontWeight: 700 }}>Google Play</div>
                      </div>
                    </a>

                    {/* APK Direct */}
                    <a
                      href="/downloads/locra-mobile.apk"
                      download
                      onClick={e => {
                        // Demo notification if file is not locally on disk
                        addToast('Directe APK download start...', 'info');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        color: '#fff',
                        textDecoration: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>📦</span>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Installatiebestand</div>
                        <div style={{ fontWeight: 700 }}>Direct APK</div>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Stap 2: Koppel in 1 klik via QR */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', alignSelf: 'flex-start' }}>
                    <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>2</span>
                    <strong style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>Koppel je account direct via QR</strong>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '380px' }}>
                    Open de Locra app op je telefoon, tik op <strong>Scan QR-code</strong> en richt je camera hierop. Je bent direct veilig ingelogd!
                  </p>

                  {pairLoading ? (
                    <div style={{ padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <span className="pulse-dot"></span> Beveiligde koppelcode genereren...
                    </div>
                  ) : pairData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: '#ffffff',
                        padding: '12px',
                        borderRadius: '14px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                        display: 'inline-block'
                      }}>
                        <QRCodeSVG
                          value={pairData.qrData}
                          size={150}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          level="M"
                        />
                      </div>

                      {/* Timer & Refresh */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
                        <span style={{
                          color: timeLeft < 60 ? '#f87171' : '#34d399',
                          fontWeight: 700,
                          background: 'rgba(255,255,255,0.06)',
                          padding: '3px 10px',
                          borderRadius: '999px'
                        }}>
                          ⏱️ Geldig: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>

                        <button
                          type="button"
                          onClick={() => { fetchPairingCode(); fetchDevices(); }}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        >
                          🔄 Vernieuwen
                        </button>
                      </div>

                      {/* Manual School Code */}
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '5px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Schoolcode:</span>
                        <strong style={{ fontSize: '0.82rem', color: '#818cf8', letterSpacing: '0.05em' }}>
                          {pairData.connectCode || 'LOCRA'}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pairData.connectCode || 'LOCRA');
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          style={{ background: 'none', border: 'none', color: copiedCode ? '#34d399' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.72rem' }}
                        >
                          {copiedCode ? '✓ Gekopieerd' : 'Kopieer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={fetchPairingCode} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      Genereer Koppel-QR-code
                    </button>
                  )}
                </div>

                {/* Stap 3: Gekoppelde Apparaten (In Database) */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: 'var(--primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>3</span>
                      <strong style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>Gekoppelde Apparaten</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '999px' }}>
                        {devices.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={fetchDevices}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      {devicesLoading ? 'Laden...' : '↻ Verversen'}
                    </button>
                  </div>

                  {devices.length === 0 ? (
                    <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Er zijn momenteel geen mobiele telefoons gekoppeld aan jouw account in de database.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {devices.map((device: any) => (
                        <div
                          key={device.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>
                              {device.devicePlatform === 'ios' ? '🍎' : '🤖'}
                            </span>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                                {device.deviceName}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Gekoppeld: {new Date(device.pairedAt).toLocaleDateString('nl-NL')} • v{device.appVersion || '1.0.0'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRevokeDevice(device.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          >
                            Ontkoppelen
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
                  Sluiten
                </button>
                {activeTab !== 'mobile' && (
                  <button type="submit" disabled={saving} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                    {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
