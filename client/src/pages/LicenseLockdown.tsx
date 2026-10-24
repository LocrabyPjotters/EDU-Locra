import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function LicenseLockdown() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/settings/license/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ licenseKey })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Licentie activeren mislukt');

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithRowmatch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/network/license/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'Synchronisatie met api.rowmatch.nl mislukt');

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-container" style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', background: '#1e293b', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {!isAdmin ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</div>
            <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>Systeem in Onderhoud</h2>
            <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              Locra AI is tijdelijk niet beschikbaar. De systeembeheerder moet de applicatie opnieuw activeren. Probeer het later nog eens.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>Systeem Vergrendeld</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5' }}>
              De Locra licentiesleutel is verlopen (3-maandelijkse controle niet geslaagd) of niet meer geldig. Synchroniseer met api.rowmatch.nl of voer een nieuwe licentiesleutel in om toegang te herstellen.
            </p>

            {success ? (
              <div style={{ padding: '1rem', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderRadius: '8px', fontWeight: 'bold', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                ✅ Licentie succesvol geverifieerd via api.rowmatch.nl! Systeem wordt herstart...
              </div>
            ) : (
              <form onSubmit={handleActivate}>
                {error && <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem', padding: '0.5rem', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '6px' }}>{error}</div>}
                
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Locra Licentiesleutel</label>
                  <input 
                    type="text" 
                    required
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    placeholder="LOCRA-XXXX-XXXX-XXXX"
                    style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#475569'}
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1, marginBottom: '0.75rem' }}
                >
                  {loading ? 'Bezig met verifiëren...' : 'Activeer Nieuwe Sleutel'}
                </button>

                <button 
                  type="button" 
                  disabled={loading}
                  onClick={handleSyncWithRowmatch}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#06b6d4', fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                >
                  <span>⚡</span> Nu synchroniseren met api.rowmatch.nl
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
