import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function ReportingPanel() {
  const [activeTab, setActiveTab] = useState<'klassen'|'groepen'>('klassen');
  const token = useAuthStore(state => state.token);
  const [mockClassData, setMockClassData] = useState<any[]>([]);
  const [mockGroupData, setMockGroupData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/reporting', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setMockClassData(data.classes || []);
          setMockGroupData(data.groups || []);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [token]);

  const data = activeTab === 'klassen' ? mockClassData : mockGroupData;

  if (loading) {
    return <div style={{ padding: '2rem' }}>Laden...</div>;
  }

  return (
    <div className="panel-content">
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Uitgebreide Rapportage</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Geanonimiseerde gebruiksstatistieken op groepsniveau. Individueel leerlinggebruik is afgeschermd volgens het privacybeleid.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" style={{ background: 'var(--bg-surface)' }}>Exporteer CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'klassen' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('klassen')}
          style={activeTab !== 'klassen' ? { background: 'transparent' } : {}}
        >
          Klassen
        </button>
        <button 
          className={`btn ${activeTab === 'groepen' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('groepen')}
          style={activeTab !== 'groepen' ? { background: 'transparent' } : {}}
        >
          Groepen
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: 'var(--primary)', filter: 'blur(40px)', opacity: 0.2 }} />
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totaal Prompts ({activeTab})</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
            {data.reduce((acc, row) => acc + row.totalPrompts, 0).toLocaleString()}
          </p>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: 'var(--accent)', filter: 'blur(40px)', opacity: 0.2 }} />
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gemiddeld per {activeTab === 'klassen' ? 'leerling' : 'lid'}</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', background: 'linear-gradient(135deg, #fff, #7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
            {Math.round(data.reduce((acc, row) => acc + row.totalPrompts, 0) / data.reduce((acc, row) => acc + (('students' in row ? row.students : 0) || ('members' in row ? row.members : 0) || 0), 0) || 0)}
          </p>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: 'var(--success)', filter: 'blur(40px)', opacity: 0.2 }} />
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meest gebruikte model</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)', lineHeight: 1.2 }}>
            {data[0]?.primaryModel || 'N/A'}
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-surface-hover)' }}>
            <tr>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Naam</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Aantal {activeTab === 'klassen' ? 'leerlingen' : 'leden'}</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Totaal Prompts</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gem. per persoon</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tokens Gebruikt</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Primair Model</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Populaire Onderwerpen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '1rem' }}>{('students' in row ? row.students : 0) || ('members' in row ? row.members : 0)}</td>
                <td style={{ padding: '1rem' }}>{row.totalPrompts.toLocaleString()}</td>
                <td style={{ padding: '1rem' }}>{row.avgPrompts}</td>
                <td style={{ padding: '1rem' }}>{row.totalTokens}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    color: 'var(--primary)', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem',
                    fontWeight: 600 
                  }}>
                    {row.primaryModel}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {row.topTopics?.map((t: any, idx: number) => (
                      <span key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {t.topic} ({t.count})
                      </span>
                    )) || <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Geen data</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
