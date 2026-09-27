import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Ongeldige of ontbrekende reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }
    
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis bij het resetten.');

      setSuccess('Wachtwoord succesvol gewijzigd! Je kunt nu inloggen met je nieuwe wachtwoord.');
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
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Nieuw Wachtwoord</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Stel een nieuw wachtwoord in voor je account.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
          {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>⚠️ {error}</div>}
          
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div className="badge badge-success" style={{ marginBottom: '1.5rem', display: 'block', padding: '1rem', borderRadius: '8px' }}>✅ {success}</div>
              <button onClick={() => navigate('/login')} type="button" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                Naar Inloggen
              </button>
            </div>
          ) : (
            <>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label>Nieuw Wachtwoord</label>
                <input 
                  type="password" 
                  className="input-field" 
                  required
                  disabled={!token}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '2rem' }}>
                <label>Bevestig Wachtwoord</label>
                <input 
                  type="password" 
                  className="input-field" 
                  required
                  disabled={!token}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting || !token} style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                {submitting ? 'Opslaan...' : 'Wachtwoord Opslaan'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
