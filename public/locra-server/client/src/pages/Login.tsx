import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const token = useAuthStore(state => state.token);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      navigate('/chat'); // default redirect
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');

      setAuth(data.token, data.user);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Left side - Branding & Info */}
      <div style={{ 
        flex: 1, 
        display: 'none', 
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4rem',
        position: 'relative',
        overflow: 'hidden'
      }} className="login-sidebar">
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(124, 92, 252, 0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', zIndex: 1 }}><span className="text-gradient">Locra</span> AI Platform</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '500px', lineHeight: '1.6', zIndex: 1 }}>
          Een veilige, privacyvriendelijke en slimme AI-omgeving voor het onderwijs. Jouw data blijft altijd op de school.
        </p>
        
        <div style={{ marginTop: '4rem', display: 'flex', gap: '2rem', zIndex: 1 }}>
          <div className="stat-card" style={{ flex: 1, background: 'rgba(30, 41, 59, 0.4)' }}>
            <span className="stat-label">Privacy</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>100% Lokaal</span>
          </div>
          <div className="stat-card" style={{ flex: 1, background: 'rgba(30, 41, 59, 0.4)' }}>
            <span className="stat-label">Status</span>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>Beveiligd</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="page-wrapper" style={{ maxWidth: '440px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(56, 189, 248, 0.2))', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2rem' }}>🎓</span>
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welkom bij Locra</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Log in om te beginnen met leren en ontdekken</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
            {error && <div className="error-message">
              <span>⚠️</span> {error}
            </div>}

            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📚</span> Inloggen via Entree / Kennisnet
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>OF GEBRUIK EEN LOKAAL ACCOUNT</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <div className="input-group">
              <label>Gebruikersnaam of Leerlingnummer</label>
              <input 
                type="text" 
                className="input-field" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Bijv. 123456"
              />
            </div>
            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Wachtwoord</label>
                <a href="/forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>Wachtwoord vergeten?</a>
              </div>
              <input 
                type="password" 
                className="input-field" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
              {submitting ? 'Authenticeren...' : 'Inloggen'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Powered by Pjotters &middot; Privacy First
          </div>
        </div>
      </div>
    </div>
  );
}
