import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

export default function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'account' | 'quota'>('preferences');
  const [quotaData, setQuotaData] = useState<any>(null);

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

            <div style={{ marginTop: 'auto', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
                  Annuleren
                </button>
                <button type="submit" disabled={saving} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                  {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
