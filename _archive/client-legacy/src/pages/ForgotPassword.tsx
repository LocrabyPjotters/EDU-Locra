import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis.');

      setSuccess('Als dit e-mailadres bekend is, ontvang je spoedig een link om je wachtwoord te herstellen.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-base)', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="page-wrapper" style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Wachtwoord Vergeten</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Vul je e-mailadres in om een reset-link te ontvangen.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
          {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}
          {success && <div className="badge badge-success" style={{ marginBottom: '1.5rem', display: 'block', padding: '1rem', borderRadius: '8px' }}>✅ {success}</div>}

          {!success && (
            <>
              <div className="input-group" style={{ marginBottom: '2rem' }}>
                <label>E-mailadres</label>
                <input 
                  type="email" 
                  className="input-field" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Bijv. student@school.nl"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                {submitting ? 'Aanvragen...' : 'Reset Link Aanvragen'}
              </button>
            </>
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              ← Terug naar inloggen
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
