import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function CodeMatchPanel() {
  const token = useAuthStore(state => state.token);
  
  const [settings, setSettings] = useState({
    enableCodeMatch: true,
    codeMatchAccessMode: 'all',
    codeMatchAllowedClasses: '[]',
    codeMatchAllowedGroups: '[]',
    codeMatchOrgRequirement: '',
    githubClientId: '',
    githubClientSecret: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      // Fetch org settings
      const orgRes = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (orgRes.ok) {
        const data = await orgRes.json();
        setSettings({
          enableCodeMatch: data.enableCodeMatch ?? true,
          codeMatchAccessMode: data.codeMatchAccessMode || 'all',
          codeMatchAllowedClasses: data.codeMatchAllowedClasses || '[]',
          codeMatchAllowedGroups: data.codeMatchAllowedGroups || '[]',
          codeMatchOrgRequirement: data.codeMatchOrgRequirement || '',
          githubClientId: data.githubClientId || '',
          githubClientSecret: data.githubClientSecret || ''
        });
      }
      
      // Fetch classes
      const classRes = await fetch('/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (classRes.ok) {
        setClasses(await classRes.json());
      }
      
      // Fetch groups
      const groupRes = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (groupRes.ok) {
        setGroups(await groupRes.json());
      }
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Kon instellingen niet laden.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Opslaan mislukt');
      setMessage({ text: 'Instellingen opgeslagen!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (e) {
      setMessage({ text: 'Fout bij opslaan van instellingen.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleClass = (classId: string) => {
    const current = JSON.parse(settings.codeMatchAllowedClasses || '[]');
    const next = current.includes(classId) 
      ? current.filter((id: string) => id !== classId)
      : [...current, classId];
    setSettings({ ...settings, codeMatchAllowedClasses: JSON.stringify(next) });
  };

  const toggleGroup = (groupId: string) => {
    const current = JSON.parse(settings.codeMatchAllowedGroups || '[]');
    const next = current.includes(groupId) 
      ? current.filter((id: string) => id !== groupId)
      : [...current, groupId];
    setSettings({ ...settings, codeMatchAllowedGroups: JSON.stringify(next) });
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Laden...</div>;

  const selectedClasses = JSON.parse(settings.codeMatchAllowedClasses || '[]');
  const selectedGroups = JSON.parse(settings.codeMatchAllowedGroups || '[]');

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ background: 'linear-gradient(135deg, #4ade80, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CodeMatch Instellingen
            </span>
            <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>BETA</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Beheer toegang en integraties voor de programmeeromgeving.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
        </button>
      </div>

      {message.text && (
        <div style={{ padding: '1rem', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: message.type === 'error' ? '#ef4444' : '#22c55e', borderRadius: '12px', marginBottom: '2rem', border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}` }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Algemeen */}
        <div className="panel" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Algemene Instellingen
          </h3>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '1.5rem' }}>
            <input 
              type="checkbox" 
              checked={settings.enableCodeMatch}
              onChange={e => setSettings({...settings, enableCodeMatch: e.target.checked})}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>CodeMatch Inschakelen</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Zet de hele module aan of uit voor de organisatie.</div>
            </div>
          </label>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Vereiste GitHub Organisatie (Optioneel)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="bijv. mijnschool-ict"
              value={settings.codeMatchOrgRequirement}
              onChange={e => setSettings({...settings, codeMatchOrgRequirement: e.target.value})}
              disabled={!settings.enableCodeMatch}
            />
            <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Als je dit invult, moeten gebruikers lid zijn van deze GitHub organisatie om CodeMatch te gebruiken.
            </p>
          </div>
        </div>

        {/* GitHub OAuth Configuratie */}
        <div className="panel" style={{ padding: '2rem', opacity: settings.enableCodeMatch ? 1 : 0.5, pointerEvents: settings.enableCodeMatch ? 'auto' : 'none' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub OAuth Integratie
          </h3>
          
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#60a5fa' }}>Stappenplan GitHub OAuth App aanmaken:</div>
            <ol style={{ margin: '0 0 1rem 0', paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
              <li>Ga naar <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>GitHub Developer Settings → OAuth Apps</a></li>
              <li>Klik rechtsboven op <strong>New OAuth App</strong></li>
              <li style={{ marginTop: '6px' }}>
                <strong>Application name:</strong> Bijv. <code>Locra CodeMatch</code>
              </li>
              <li style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span><strong>Homepage URL:</strong></span>
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px', color: '#38bdf8' }}>{window.location.origin}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    setCopiedField('homepage');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                >
                  {copiedField === 'homepage' ? '✓ Gekopieerd' : 'Kopieer'}
                </button>
              </li>
              <li style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span><strong>Authorization callback URL:</strong></span>
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px', color: '#38bdf8' }}>{window.location.origin}/api/codematch/github/callback</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/codematch/github/callback`);
                    setCopiedField('callback');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                >
                  {copiedField === 'callback' ? '✓ Gekopieerd' : 'Kopieer'}
                </button>
              </li>
              <li style={{ marginTop: '6px' }}>Klik op <strong>Register application</strong>, genereer een <em>Client Secret</em> en plak beide velden hieronder.</li>
            </ol>

            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 14px', borderRadius: '8px', color: '#fbbf24', fontSize: '0.82rem' }}>
              <strong>⚠️ Belangrijk bij 'The redirect_uri is not associated with this application':</strong>
              <div style={{ marginTop: '4px' }}>
                GitHub controleert de callback URL tot op het poortnummer en hostadres exact. Als je inlogt via <code>{window.location.origin}</code>, moet in GitHub de Authorization callback URL ook letterlijk met <code>{window.location.origin}</code> beginnen (dus let op: <code>localhost</code> vs <code>127.0.0.1</code> of eventueel een Cloudflare tunnel URL).
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Client ID</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Bijv. Ov23lif1PVoxQxtNOdhV"
                value={settings.githubClientId}
                onChange={e => setSettings({...settings, githubClientId: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Client Secret</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="••••••••••••••••••••••••••••••••••••••••"
                value={settings.githubClientSecret}
                onChange={e => setSettings({...settings, githubClientSecret: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Toegang & Rechten */}
        <div className="panel" style={{ padding: '2rem', opacity: settings.enableCodeMatch ? 1 : 0.5, pointerEvents: settings.enableCodeMatch ? 'auto' : 'none' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔒</span> Toegang & Rechten
          </h3>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>Wie mag CodeMatch gebruiken?</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ flex: 1, padding: '1rem', border: settings.codeMatchAccessMode === 'all' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', background: settings.codeMatchAccessMode === 'all' ? 'rgba(99,102,241,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', gap: '12px' }}>
                <input 
                  type="radio" 
                  name="accessMode" 
                  checked={settings.codeMatchAccessMode === 'all'}
                  onChange={() => setSettings({...settings, codeMatchAccessMode: 'all'})}
                  style={{ marginTop: '4px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: settings.codeMatchAccessMode === 'all' ? '#fff' : 'var(--text-primary)' }}>Alle Gebruikers</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Iedereen met een account mag CodeMatch gebruiken (docenten en studenten).</div>
                </div>
              </label>
              
              <label style={{ flex: 1, padding: '1rem', border: settings.codeMatchAccessMode === 'restricted' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', background: settings.codeMatchAccessMode === 'restricted' ? 'rgba(99,102,241,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', gap: '12px' }}>
                <input 
                  type="radio" 
                  name="accessMode" 
                  checked={settings.codeMatchAccessMode === 'restricted'}
                  onChange={() => setSettings({...settings, codeMatchAccessMode: 'restricted'})}
                  style={{ marginTop: '4px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: settings.codeMatchAccessMode === 'restricted' ? '#fff' : 'var(--text-primary)' }}>Specifieke Klassen/Groepen</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alleen geselecteerde klassen of groepen hebben toegang.</div>
                </div>
              </label>
            </div>
          </div>

          {settings.codeMatchAccessMode === 'restricted' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Klassen met toegang</h4>
                {classes.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>Geen klassen gevonden.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '8px' }}>
                    {classes.map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedClasses.includes(c.id)}
                          onChange={() => toggleClass(c.id)}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Groepen met toegang</h4>
                {groups.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>Geen groepen gevonden.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '8px' }}>
                    {groups.map(g => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedGroups.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                        />
                        <span>{g.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
       <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 14px', borderRadius: '8px', color: '#fbbf24', fontSize: '0.82rem' }}>
              <strong>⚠️ CodeMatch tijdelijk enkel te gebruiken met Github wegens Storage limieten.</strong>
              <div style={{ marginTop: '4px' }}>
               Dit komt doordat code files veel storage innemen. We werken aan een oplossing om ook lokaal opslaan mogelijk te maken en andere services als Github aan te bieden.</div>
            </div>
    </div>
  );
}
