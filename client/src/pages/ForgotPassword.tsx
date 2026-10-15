import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setEmailNotice(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis.');

      setSuccess(data.message || 'Als dit account bekend is, ontvang je spoedig een e-mail met een link om je wachtwoord te herstellen.');
      if (data.emailError) {
        setEmailNotice(data.emailError);
      }
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
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>Wachtwoord Vergeten</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Vul je e-mailadres of gebruikersnaam in om een herstellink te ontvangen.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
          {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}
          {success && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="badge badge-success" style={{ display: 'block', padding: '1rem', borderRadius: '10px', lineHeight: 1.5 }}>
                ✅ {success}
              </div>
              {emailNotice && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', color: '#fef08a', fontSize: '0.82rem', lineHeight: 1.4 }}>
                  ℹ️ {emailNotice}
                </div>
              )}
            </div>
          )}

          {!success && (
            <>
              <div className="input-group" style={{ marginBottom: '2rem' }}>
                <label>E-mailadres of Gebruikersnaam</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Bijv. student@school.nl of jansen_p"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                {submitting ? 'Controleren...' : 'Reset Link Aanvragen'}
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
