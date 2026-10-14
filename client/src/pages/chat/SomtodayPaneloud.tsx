import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface SomtodayPanelProps {
  onClose: () => void;
}

export default function SomtodayPanel({ onClose }: SomtodayPanelProps) {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Login form state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  // Data state
  const [schedule, setSchedule] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'rooster' | 'cijfers' | 'huiswerk'>('rooster');

  useEffect(() => {
    checkStatus();
  }, [token]);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/somtoday/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStatus(data);
      if (data.connected) {
        fetchData();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schRes, grRes, hwRes] = await Promise.all([
        fetch('/api/somtoday/schedule', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/somtoday/grades', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/somtoday/homework', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (schRes.ok) setSchedule(await schRes.json());
      if (grRes.ok) setGrades(await grRes.json());
      if (hwRes.ok) setHomework(await hwRes.json());
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchSchools = async (q: string) => {
    setSchoolSearch(q);
    if (q.length < 2) {
      setSchools([]);
      return;
    }
    try {
      const res = await fetch(`/api/somtoday/schools?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchools(await res.json());
    } catch (err) {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) {
      setLoginError('Kies eerst een school');
      return;
    }
    
    setLoggingIn(true);
    setLoginError('');
    
    try {
      const res = await fetch('/api/somtoday/connect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          password,
          schoolUuid: selectedSchool.uuid
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');
      
      await checkStatus();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je SOMtoday wilt ontkoppelen?')) return;
    try {
      await fetch('/api/somtoday/disconnect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ connected: false });
      setSchedule([]);
      setGrades([]);
      setHomework([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !status) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '600px', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎓 SOMtoday
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {status?.connected && (
              <button onClick={handleDisconnect} className="btn btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
                Ontkoppelen
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
          </div>
        </div>

        {!status?.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '1rem' }}>Koppel je SOMtoday account</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Laat Locra je rooster, cijfers en huiswerk ophalen zodat je de AI gerichte vragen kunt stellen over je schoolwerk.
              </p>
              
              <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
                <div className="input-group" style={{ position: 'relative' }}>
                  <label>Zoek je school</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Naam van school of plaats..."
                    value={selectedSchool ? selectedSchool.naam : schoolSearch}
                    onChange={(e) => {
                      setSelectedSchool(null);
                      searchSchools(e.target.value);
                    }}
                    required
                  />
                  {!selectedSchool && schools.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-color)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                      {schools.map(s => (
                        <div 
                          key={s.uuid} 
                          style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                          onClick={() => {
                            setSelectedSchool(s);
                            setSchools([]);
                            setSchoolSearch('');
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{s.naam}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.plaats}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="input-group">
                  <label>Gebruikersnaam</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="input-group">
                  <label>Wachtwoord</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                
                {loginError && <div className="error-message">{loginError}</div>}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loggingIn || !selectedSchool}>
                  {loggingIn ? 'Aanmelden...' : 'Koppelen met SOMtoday'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <button 
                className={`btn ${activeTab === 'rooster' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('rooster')}
              >📅 Rooster</button>
              <button 
                className={`btn ${activeTab === 'cijfers' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('cijfers')}
              >📊 Cijfers</button>
              <button 
                className={`btn ${activeTab === 'huiswerk' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('huiswerk')}
              >📝 Huiswerk</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                </div>
              ) : (
                <>
                  {activeTab === 'rooster' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {schedule.length === 0 ? <p>Geen rooster gevonden voor deze week.</p> : 
                        schedule.map((item, i) => (
                          <div key={i} className="glass-panel" style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>{item.titel}</h4>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                  {new Date(item.beginDatumTijd).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })} | 
                                  {' '}{new Date(item.beginDatumTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} - 
                                  {new Date(item.eindDatumTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {(item.vakNamen?.length > 0 || item.locatie) && (
                                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                    {item.vakNamen?.map((v: string) => <span key={v} className="badge" style={{ background: 'var(--primary-color)' }}>{v}</span>)}
                                    {item.locatie && <span className="badge">{item.locatie}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                  
                  {activeTab === 'cijfers' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {grades.length === 0 ? <p>Geen cijfers gevonden.</p> : 
                        grades.map((item, i) => (
                          <div key={i} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.vak}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.omschrijving || item.type}</div>
                              {item.datumInvoer && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(item.datumInvoer).toLocaleDateString()}</div>}
                            </div>
                            <div style={{ 
                              fontSize: '1.5rem', 
                              fontWeight: 'bold', 
                              color: parseFloat(item.resultaat?.replace(',', '.')) < 5.5 ? 'var(--danger-color)' : 'var(--primary-color)' 
                            }}>
                              {item.resultaat}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                  
                  {activeTab === 'huiswerk' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {homework.length === 0 ? <p>Geen huiswerk gevonden voor deze week.</p> : 
                        homework.map((item, i) => (
                          <div key={i} className="glass-panel" style={{ padding: '1rem', borderLeft: item.afgerond ? '4px solid var(--success-color)' : '4px solid var(--primary-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0' }}>{item.vak}</h4>
                              {item.afgerond && <span title="Afgerond">✅</span>}
                            </div>
                            <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{item.titel}</div>
                            {item.omschrijving && (
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                {item.omschrijving.replace(/<[^>]*>?/gm, '')}
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
