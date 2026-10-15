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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e1b4b, #0f172a)',
      color: '#f8fafc',
      padding: '2rem',
      fontFamily: '"Inter", sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '750px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '3rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decoratieve blob in the background of the card */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: '#6366f1',
          filter: 'blur(100px)',
          opacity: 0.3,
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)' }}>
              <span style={{ fontSize: '2rem', color: '#fff' }}>✨</span>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Welkom bij Locra AI
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem', margin: 0 }}>Configureer je lokale, privacy-vriendelijke AI-omgeving.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '2rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* Kolom 1: Organisatie */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#818cf8' }}>🏢</span> Organisatie
                </h3>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Naam van de Organisatie</label>
                  <input 
                    type="text" 
                    required
                    value={formData.orgName}
                    onChange={e => setFormData({...formData, orgName: e.target.value})}
                    placeholder="Bijv. Scholengemeenschap X"
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.2s', fontSize: '0.95rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Locra Licentiesleutel (Verplicht)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.licenseKey}
                    onChange={e => setFormData({...formData, licenseKey: e.target.value})}
                    placeholder="LOCRA-XXXX-XXXX-XXXX"
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.2s', fontSize: '0.95rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>
              </div>

              {/* Kolom 2: Beheerder */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#818cf8' }}>👑</span> Beheerder (Superadmin)
                </h3>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Gebruikersnaam</label>
                  <input 
                    type="text" 
                    required
                    value={formData.adminUsername}
                    onChange={e => setFormData({...formData, adminUsername: e.target.value})}
                    placeholder="admin"
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.2s', fontSize: '0.95rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>E-mailadres</label>
                  <input 
                    type="email" 
                    required
                    value={formData.adminEmail}
                    onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                    placeholder="admin@school.nl"
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.2s', fontSize: '0.95rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Wachtwoord</label>
                  <input 
                    type="password" 
                    required
                    minLength={8}
                    value={formData.adminPassword}
                    onChange={e => setFormData({...formData, adminPassword: e.target.value})}
                    placeholder="Minimaal 8 tekens"
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.2s', fontSize: '0.95rem' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="submit" 
                disabled={submitting} 
                style={{ 
                  padding: '0.85rem 2rem', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                  color: '#fff', 
                  border: 'none', 
                  fontWeight: 600, 
                  fontSize: '1rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s, opacity 0.2s, boxShadow 0.2s',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                }}
                onMouseEnter={e => !submitting && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => !submitting && (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {submitting ? 'Installatie uitvoeren...' : 'Voltooi Installatie 🚀'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
