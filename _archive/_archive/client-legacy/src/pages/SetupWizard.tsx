import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

export default function SetupWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    licenseKey: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        setIsSetup(data.isSetup);
        if (data.isSetup) {
          navigate('/login');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Kan de server niet bereiken. Zorg dat de backend draait.');
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Installatie mislukt');

      setAuth(data.token, data.user);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="center-container">Loading...</div>;
  if (isSetup) return null;

  return (
    <div className="center-container">
      <div className="page-wrapper">
        <div className="header-text">
          <h1><span className="text-gradient">Locra</span> {t('setup')}</h1>
          <p>Installeer en configureer uw lokale AI omgeving</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel">
          {error && <div className="error-message">{error}</div>}

          <h3 style={{ marginBottom: '1rem' }}>Organisatie details</h3>
          <div className="input-group">
            <label>Organisatienaam</label>
            <input 
              type="text" 
              className="input-field" 
              required
              value={formData.orgName}
              onChange={e => setFormData({...formData, orgName: e.target.value})}
              placeholder="Bijv. Scholengemeenschap X"
            />
          </div>
          <div className="input-group">
            <label>Licentiesleutel (Optioneel voor educatie)</label>
            <input 
              type="text" 
              className="input-field" 
              value={formData.licenseKey}
              onChange={e => setFormData({...formData, licenseKey: e.target.value})}
              placeholder="Pjotters Licentie"
            />
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Beheerder (Superadmin)</h3>
          <div className="input-group">
            <label>Gebruikersnaam</label>
            <input 
              type="text" 
              className="input-field" 
              required
              value={formData.adminUsername}
              onChange={e => setFormData({...formData, adminUsername: e.target.value})}
              placeholder="admin"
            />
          </div>
          <div className="input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              className="input-field" 
              required
              value={formData.adminEmail}
              onChange={e => setFormData({...formData, adminEmail: e.target.value})}
              placeholder="admin@school.nl"
            />
          </div>
          <div className="input-group">
            <label>Wachtwoord</label>
            <input 
              type="password" 
              className="input-field" 
              required
              minLength={8}
              value={formData.adminPassword}
              onChange={e => setFormData({...formData, adminPassword: e.target.value})}
              placeholder="Minimaal 8 tekens"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '1.5rem' }}>
            {submitting ? 'Installeren...' : 'Voltooien'}
          </button>
        </form>
      </div>
    </div>
  );
}
