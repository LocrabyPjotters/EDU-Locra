import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function QuotasPanel() {
  const [activeTab, setActiveTab] = useState<'klassen'|'gebruikers'>('klassen');
  const token = useAuthStore(state => state.token);
  const [classesData, setClassesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/quotas', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setClassesData(data.classes || []);
          setUsersData(data.users || []);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [token]);

  const data = activeTab === 'klassen' ? classesData : usersData;

  if (loading) {
    return <div style={{ padding: '2rem' }}>Laden...</div>;
  }

  return (
    <div className="panel-content">
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Quotas & Modellen Toegang</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Beheer welke modellen en hoeveel limiet specifieke klassen, groepen of individuele personen krijgen. Dit overschrijft de standaard instellingen.</p>
        </div>
        <div>
          <button className="btn btn-primary">+ Uitzondering Toevoegen</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'klassen' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('klassen')}
          style={activeTab !== 'klassen' ? { background: 'transparent' } : {}}
        >
          Klassen & Groepen
        </button>
        <button 
          className={`btn ${activeTab === 'gebruikers' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('gebruikers')}
          style={activeTab !== 'gebruikers' ? { background: 'transparent' } : {}}
        >
          Individuele Gebruikers
        </button>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-surface-hover)' }}>
            <tr>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Naam</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Specifieke Quota</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Daglimiet</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Maandlimiet</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Toegestane Modellen</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '1rem' }}>
                  <input type="checkbox" checked={row.customQuotaEnabled} readOnly style={{ accentColor: 'var(--primary)' }} />
                </td>
                <td style={{ padding: '1rem' }}>
                  {row.customQuotaEnabled ? (
                    <input 
                      type="number" 
                      defaultValue={row.daily} 
                      style={{ 
                        width: '80px', 
                        padding: '0.25rem 0.5rem', 
                        background: 'var(--bg-surface)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: 'white', 
                        borderRadius: '4px' 
                      }} 
                    />
                  ) : <span style={{ color: 'var(--text-secondary)' }}>Standaard</span>}
                </td>
                <td style={{ padding: '1rem' }}>
                  {row.customQuotaEnabled ? (
                    <input 
                      type="number" 
                      defaultValue={row.monthly} 
                      style={{ 
                        width: '100px', 
                        padding: '0.25rem 0.5rem', 
                        background: 'var(--bg-surface)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: 'white', 
                        borderRadius: '4px' 
                      }} 
                    />
                  ) : <span style={{ color: 'var(--text-secondary)' }}>Standaard</span>}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {row.models.map((m: string) => (
                      <span key={m} style={{ 
                        background: 'rgba(99, 102, 241, 0.1)', 
                        color: 'var(--primary)', 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem',
                        fontWeight: 600 
                      }}>
                        {m}
                      </span>
                    ))}
                    <button style={{ 
                      background: 'var(--bg-surface)', 
                      border: '1px dashed rgba(255,255,255,0.2)', 
                      color: 'var(--text-secondary)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}>
                      + Aanpassen
                    </button>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <button className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-surface)' }}>Opslaan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
