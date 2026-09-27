import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function UsersPanel() {
  const token = useAuthStore(state => state.token);
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState('');
  const [csvData, setCsvData] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);
  
  const [editUser, setEditUser] = useState<any>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    role: 'student'
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, [token]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(newUser)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Aanmaken mislukt');
      }
      
      await fetchUsers();
      setShowAdd(false);
      setNewUser({ username: '', email: '', password: '', displayName: '', role: 'student' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload: any = {
        displayName: editUser.displayName,
        role: editUser.role,
        isActive: editUser.isActive
      };
      if (editUser.password) payload.password = editUser.password;

      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update mislukt');
      
      await fetchUsers();
      setEditUser(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivateUser = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze gebruiker wilt deactiveren? Ze kunnen dan niet meer inloggen, maar hun data blijft bewaard.')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGdprExport = (id: string) => {
    window.open(`/api/users/${id}/export?token=${token}`, '_blank');
  };

  const handleGdprDelete = async (id: string) => {
    if (!confirm('WAARSCHUWING! Dit zal alle data, inclusief gesprekken en geschiedenis van deze gebruiker PERMANENT verwijderen (GDPR Recht op Verwijdering). Dit kan niet ongedaan worden gemaakt. Doorgaan?')) return;
    try {
      const res = await fetch(`/api/users/${id}/data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Gebruiker en alle data succesvol verwijderd.');
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Verwijderen mislukt');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvData(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true);
    setImportResult(null);
    setError('');

    try {
      const res = await fetch('/api/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ csvData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import mislukt');
      setImportResult(data);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Gebruikersbeheer</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Beheer accounts, importeer via CSV en beheer AVG/GDPR-rechten.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" onClick={() => { setShowImport(!showImport); setShowAdd(false); setEditUser(null); }} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)' }}>
            {showImport ? 'Annuleren' : '📄 CSV Import'}
          </button>
          <button className="btn btn-primary" onClick={() => { setShowAdd(!showAdd); setShowImport(false); setEditUser(null); }} style={{ width: 'auto' }}>
            {showAdd ? 'Annuleren' : '+ Nieuwe Gebruiker'}
          </button>
        </div>
      </div>

      {/* User Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', background: 'var(--primary)', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Totaal</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginTop: '0.25rem' }}>{users.length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', background: 'var(--success)', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Studenten</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginTop: '0.25rem' }}>{users.filter(u => u.role === 'student').length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', background: 'var(--accent)', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Docenten</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginTop: '0.25rem' }}>{users.filter(u => u.role === 'teacher').length}</div>
        </div>
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '70px', height: '70px', background: '#f59e0b', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Admins</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginTop: '0.25rem' }}>{users.filter(u => u.role === 'admin' || u.role === 'superadmin').length}</div>
        </div>
      </div>

      {/* CSV Import Section */}
      {showImport && (
        <div className="glass-panel animate-fade-in" style={{ marginBottom: '2rem', padding: '2rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>📄 Gebruikers Importeren (CSV / Spreadsheet)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Upload een CSV-bestand of plak de inhoud hieronder. Ondersteunde kolommen: <code>username</code>, <code>email</code>, <code>naam</code>, <code>wachtwoord</code>, <code>rol</code>. 
            Zowel <code>,</code> als <code>;</code> scheidingstekens worden herkend. Nederlandse kolomnamen worden automatisch herkend.
          </p>

          {error && <div className="error-message" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button 
              onClick={() => csvFileRef.current?.click()} 
              className="btn" 
              style={{ width: 'auto', background: 'var(--bg-surface-hover)' }}
            >
              📁 CSV Bestand Kiezen
            </button>
            <input type="file" ref={csvFileRef} style={{ display: 'none' }} accept=".csv,.txt,.tsv" onChange={handleCsvFileSelect} />
            <button
              onClick={() => setCsvData('username;email;naam;wachtwoord;rol\nleerling1;leerling1@school.nl;Jan Janssen;Welkom123!;student\n')}
              className="btn"
              style={{ width: 'auto', background: 'transparent', border: '1px solid var(--bg-surface-hover)', color: 'var(--text-secondary)' }}
            >
              📋 Voorbeeld Laden
            </button>
          </div>

          <textarea 
            className="input-field" 
            style={{ minHeight: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
            value={csvData}
            onChange={e => setCsvData(e.target.value)}
            placeholder="username;email;naam;wachtwoord;rol&#10;jdoe;j.doe@school.nl;Jan Doe;Welkom1!;student&#10;mjanssen;m.janssen@school.nl;Marie Janssen;Veilig2!;teacher"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {csvData ? `${csvData.trim().split('\n').length - 1} rijen gedetecteerd` : 'Geen data'}
            </span>
            <button 
              onClick={handleImport} 
              className="btn btn-primary" 
              style={{ width: 'auto' }} 
              disabled={!csvData.trim() || importing}
            >
              {importing ? '⏳ Importeren...' : '🚀 Importeer Gebruikers'}
            </button>
          </div>

          {importResult && (
            <div className="animate-fade-in" style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>📊 Import Resultaat</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(52,211,153,0.1)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{importResult.created}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Aangemaakt</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(251,191,36,0.1)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{importResult.skipped}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overgeslagen</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{importResult.total}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Totaal</div>
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                  <strong>Fouten:</strong>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                    {importResult.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="glass-panel animate-fade-in" style={{ marginBottom: '2rem', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Nieuwe Gebruiker Toevoegen</h3>
          {error && <div className="error-message" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label>Gebruikersnaam</label>
              <input type="text" className="input-field" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Weergavenaam</label>
              <input type="text" className="input-field" required value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} />
            </div>
            <div className="input-group">
              <label>E-mail</label>
              <input type="email" className="input-field" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Wachtwoord</label>
              <input type="password" className="input-field" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Rol</label>
              <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="student">Student / Leerling</option>
                <option value="teacher">Docent / Leraar</option>
                <option value="admin">Beheerder</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Gebruiker Aanmaken</button>
            </div>
          </form>
        </div>
      )}

      {editUser && (
        <div className="glass-panel animate-fade-in" style={{ marginBottom: '2rem', padding: '2rem', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Gebruiker Bewerken: {editUser.username}</h3>
            <button className="btn" onClick={() => setEditUser(null)} style={{ background: 'transparent' }}>Sluiten</button>
          </div>
          <form onSubmit={handleEditUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label>Weergavenaam</label>
              <input type="text" className="input-field" required value={editUser.displayName} onChange={e => setEditUser({...editUser, displayName: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Rol</label>
              <select className="input-field" value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})}>
                <option value="student">Student / Leerling</option>
                <option value="teacher">Docent / Leraar</option>
                <option value="admin">Beheerder</option>
              </select>
            </div>
            <div className="input-group">
              <label>Nieuw wachtwoord (leeglaten = niet wijzigen)</label>
              <input type="password" className="input-field" value={editUser.password || ''} onChange={e => setEditUser({...editUser, password: e.target.value})} />
            </div>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '2rem' }}>
              <input type="checkbox" className="toggle" checked={editUser.isActive} onChange={e => setEditUser({...editUser, isActive: e.target.checked})} />
              <label style={{ margin: 0 }}>Account is Actief</label>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => handleGdprExport(editUser.id)} title="GDPR Data Exporteren">📥 Export Data</button>
                <button type="button" className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => handleGdprDelete(editUser.id)} title="GDPR Data Wissen">🗑️ Wissen</button>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Wijzigingen Opslaan</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="markdown-body table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Naam</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Gebruikersnaam</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Rol</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Status</th>
              <th style={{ background: 'var(--bg-surface-hover)', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><strong>{u.displayName}</strong><br/><small style={{color:'var(--text-secondary)'}}>{u.email}</small></td>
                <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{u.username}</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className={`badge ${u.role === 'superadmin' || u.role === 'admin' ? 'badge-danger' : u.role === 'teacher' ? 'badge-primary' : 'badge-success'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {u.isActive ? <span className="badge badge-success">Actief</span> : <span className="badge badge-warning">Inactief</span>}
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', width: 'auto', marginRight: '0.5rem' }}
                    onClick={() => { setShowAdd(false); setShowImport(false); setEditUser({ ...u, password: '' }); }}
                  >Bewerk</button>
                  {u.isActive && (
                    <button 
                      className="btn" 
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', width: 'auto', background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b' }}
                      onClick={() => handleDeactivateUser(u.id)}
                    >Deactiveer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
