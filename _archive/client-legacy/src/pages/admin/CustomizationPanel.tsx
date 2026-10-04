import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useOrgStore } from '../../store/orgStore';

export default function CustomizationPanel() {
  const token = useAuthStore(state => state.token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [org, setOrg] = useState({
    name: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#06b6d4',
    systemPrompt: '',
    behaviorPrompt: '',
    aiName: '',
    welcomePageHtml: '',
    footerText: '',
    faviconUrl: '',
    logoUrl: ''
  });

  useEffect(() => {
    fetch('/api/organization/customization', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setOrg(prev => ({ ...prev, ...data }));
          useOrgStore.getState().setOrgCustomization({ aiName: data.aiName, name: data.name });
        }
      })
      .catch(err => console.error(err));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/organization/customization', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(org)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
      setSuccess('Vormgeving & AI Karakter succesvol opgeslagen.');
      useOrgStore.getState().setOrgCustomization({ aiName: org.aiName, name: org.name });
      
      // Optioneel: Update CSS variabelen live in de DOM als test
      document.documentElement.style.setProperty('--primary', org.primaryColor);
      document.documentElement.style.setProperty('--accent', org.accentColor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Vormgeving & AI Karakter</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'auto' }}>
          {saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
        </button>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '2rem' }}>⚠️ {error}</div>}
      {success && <div className="badge badge-success" style={{ marginBottom: '2rem', padding: '1rem', display: 'block', borderRadius: '8px' }}>✅ {success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* AI Persoonlijkheid */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>AI Persoonlijkheid (System Prompts & Naam)</h3>
          
          {/* AI Naam */}
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>AI Naam (bv. Locra, Nova, Socrates, Mentor)</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              De naam waarmee de AI zich voorstelt en aangesproken wordt. Dit past tevens automatisch de Academy aan (bijvoorbeeld: <strong>{org.aiName?.trim() ? `${org.aiName.trim()} Academy` : 'Locra Academy'}</strong>).
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="input-field" 
                value={org.aiName || ''}
                onChange={e => setOrg({...org, aiName: e.target.value})}
                placeholder="Locra (of bv. Nova, Socrates, Mentor)"
                style={{ maxWidth: '340px' }}
              />
              <div style={{ padding: '8px 14px', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', color: '#c7d2fe' }}>
                🎓 Academy naam: <strong>{org.aiName?.trim() ? `${org.aiName.trim()} Academy` : 'Locra Academy'}</strong>
              </div>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Globale Systeem Prompt</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Deze instructie wordt bij elk gesprek meegegeven. Bepaal hier de rol van de AI. (Bv. "Jij bent een strenge leraar. Geef nooit direct het antwoord, maar stel wedervragen.")
            </p>
            <textarea 
              className="input-field" 
              style={{ minHeight: '120px', resize: 'vertical' }}
              value={org.systemPrompt || ''}
              onChange={e => setOrg({...org, systemPrompt: e.target.value})}
              placeholder="Jij bent een behulpzame assistent voor het onderwijs..."
            />
          </div>

          <div className="input-group">
            <label>Gedragsregels (Behavior Prompt)</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Specifieke regels over formatteren, taalgebruik of verboden onderwerpen.
            </p>
            <textarea 
              className="input-field" 
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={org.behaviorPrompt || ''}
              onChange={e => setOrg({...org, behaviorPrompt: e.target.value})}
              placeholder="Schrijf altijd in Jip-en-Janneketaal. Gebruik Markdown voor opmaak."
            />
          </div>
        </div>

        {/* Branding & Kleuren */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>Huisstijl (Branding)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="input-group">
              <label>Primaire Kleur</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="color" 
                  value={org.primaryColor}
                  onChange={e => setOrg({...org, primaryColor: e.target.value})}
                  style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  className="input-field" 
                  value={org.primaryColor}
                  onChange={e => setOrg({...org, primaryColor: e.target.value})}
                />
              </div>
            </div>
            
            <div className="input-group">
              <label>Secundaire Kleur</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="color" 
                  value={org.secondaryColor}
                  onChange={e => setOrg({...org, secondaryColor: e.target.value})}
                  style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  className="input-field" 
                  value={org.secondaryColor}
                  onChange={e => setOrg({...org, secondaryColor: e.target.value})}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Accent Kleur</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="color" 
                  value={org.accentColor}
                  onChange={e => setOrg({...org, accentColor: e.target.value})}
                  style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  className="input-field" 
                  value={org.accentColor}
                  onChange={e => setOrg({...org, accentColor: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <div className="input-group">
            <label>Aangepaste Welkomsttekst (HTML toegestaan)</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Deze tekst verschijnt op het dashboard van de leerlingen/gebruikers.
            </p>
            <textarea 
              className="input-field" 
              style={{ minHeight: '120px', resize: 'vertical' }}
              value={org.welcomePageHtml || ''}
              onChange={e => setOrg({...org, welcomePageHtml: e.target.value})}
              placeholder="<h3>Welkom bij de AI assistent van onze school!</h3><p>Gebruik deze tool verantwoord.</p>"
            />
          </div>
        </div>

        {/* Footer & Branding Assets */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>Footer, Logo & Favicon</h3>
          
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Footer / Disclaimer Tekst</label>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Verschijnt onderaan elke pagina. Bijv. "AI kan fouten maken. Controleer altijd belangrijke informatie."
            </p>
            <textarea 
              className="input-field" 
              style={{ minHeight: '60px', resize: 'vertical' }}
              value={org.footerText || ''}
              onChange={e => setOrg({...org, footerText: e.target.value})}
              placeholder="AI kan fouten maken. Controleer altijd belangrijke informatie."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="input-group">
              <label>Logo URL</label>
              <input 
                type="text" 
                className="input-field" 
                value={org.logoUrl || ''}
                onChange={e => setOrg({...org, logoUrl: e.target.value})}
                placeholder="https://mijnschool.nl/logo.png"
              />
              {org.logoUrl && <img src={org.logoUrl} alt="logo preview" style={{ maxHeight: '48px', marginTop: '0.5rem', borderRadius: '4px' }} />}
            </div>
            <div className="input-group">
              <label>Favicon URL</label>
              <input 
                type="text" 
                className="input-field" 
                value={org.faviconUrl || ''}
                onChange={e => setOrg({...org, faviconUrl: e.target.value})}
                placeholder="https://mijnschool.nl/favicon.ico"
              />
              {org.faviconUrl && <img src={org.faviconUrl} alt="favicon preview" style={{ maxHeight: '32px', marginTop: '0.5rem' }} />}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
