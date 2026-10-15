import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function AuditLogsPanel() {
  const token = useAuthStore(state => state.token);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Handle new paginated response format
        setLogs(Array.isArray(data) ? data : (data.logs || []));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) fetchLogs();
  }, [token]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Audit Logboek</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Alle beheerdersacties en beveiligingsgebeurtenissen worden hier vastgelegd.</p>
        </div>
        <button className="btn" onClick={fetchLogs} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          Vernieuwen
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="markdown-body table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Datum & Tijd</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Gebruiker</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Niveau</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Actie</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>IP Adres</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Geen logboekvermeldingen gevonden. Zorg dat audit logging is ingeschakeld in de instellingen.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {new Date(log.createdAt).toLocaleString('nl-NL')}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {log.user ? <strong>{log.user.displayName}</strong> : <span style={{ color: 'var(--text-muted)' }}>Systeem</span>}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="badge" style={{
                      background: log.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : log.severity === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: log.severity === 'critical' ? '#f87171' : log.severity === 'warning' ? '#fbbf24' : '#60a5fa',
                      border: '1px solid',
                      borderColor: log.severity === 'critical' ? 'rgba(239, 68, 68, 0.5)' : log.severity === 'warning' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(59, 130, 246, 0.5)'
                    }}>
                      {log.severity || 'info'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span className="badge badge-primary">{log.action}</span>
                      {log.category && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.category}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                    {log.ipAddress || '-'}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
