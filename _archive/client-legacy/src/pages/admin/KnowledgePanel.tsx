import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function KnowledgePanel() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  
  const [kbs, setKbs] = useState<any[]>([]);
  const [activeKb, setActiveKb] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin', 'teacher', 'student']);

  const roles = [
    { id: 'admin', label: 'Beheerders' },
    { id: 'teacher', label: 'Docenten' },
    { id: 'student', label: 'Leerlingen' }
  ];

  useEffect(() => {
    fetchKbs();
  }, []);

  const fetchKbs = async () => {
    const res = await fetch('/api/knowledge', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setKbs(await res.json());
  };

  const handleCreateKb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbName) return;
    
    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newKbName, description: newKbDesc, allowedRoles })
    });
    setNewKbName('');
    setNewKbDesc('');
    setShowCreateModal(false);
    fetchKbs();
  };

  const selectKb = async (kb: any) => {
    setActiveKb(kb);
    const res = await fetch(`/api/knowledge/${kb.id}/documents`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setDocs(await res.json());
  };

  const handleRoleToggle = (roleId: string) => {
    if (allowedRoles.includes(roleId)) {
      if (roleId === 'admin') return; // Admins always have access
      setAllowedRoles(allowedRoles.filter(r => r !== roleId));
    } else {
      setAllowedRoles([...allowedRoles, roleId]);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeKb) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/knowledge/${activeKb.id}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed with status ${res.status}`);
      }
      
      selectKb(activeKb); // refresh docs
    } catch (err: any) {
      alert(`Upload mislukt: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Kennisbanken (RAG)
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Beheer documenten en specifieke toegang voor groepen.
          </p>
        </div>
        
        {!activeKb && user?.role === 'admin' && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', boxShadow: '0 4px 15px rgba(124, 92, 252, 0.3)' }}
          >
            + Nieuwe Kennisbank
          </button>
        )}
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '24px', animation: 'scaleIn 0.2s ease-out' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Nieuwe Kennisbank Aanmaken</h3>
            <form onSubmit={handleCreateKb} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Naam</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="bijv. Interne Richtlijnen Docenten"
                  value={newKbName}
                  onChange={e => setNewKbName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Omschrijving</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Korte omschrijving van de documenten..."
                  value={newKbDesc}
                  onChange={e => setNewKbDesc(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500 }}>Toegang (RBAC)</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {roles.map(role => {
                    const isSelected = allowedRoles.includes(role.id);
                    return (
                      <div 
                        key={role.id}
                        onClick={() => handleRoleToggle(role.id)}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          borderRadius: '20px',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                          background: isSelected ? 'rgba(124, 92, 252, 0.2)' : 'rgba(0,0,0,0.2)',
                          cursor: role.id === 'admin' ? 'not-allowed' : 'pointer',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSelected && <span style={{ marginRight: '6px' }}>✓</span>}
                        {role.label}
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  Selecteer welke rollen deze documenten mogen bevragen. Beheerders hebben altijd toegang.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn" style={{ background: 'rgba(255,255,255,0.05)' }}>Annuleren</button>
                <button type="submit" className="btn btn-primary">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {!activeKb ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {kbs.length === 0 ? (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', opacity: 0.5, display: 'block', marginBottom: '1rem' }}>🗂️</span>
              <h3>Nog geen kennisbanken</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Maak er een aan om documenten te uploaden.</p>
            </div>
          ) : (
            kbs.map(kb => (
              <div 
                key={kb.id} 
                className="glass-panel"
                style={{ 
                  padding: '1.5rem', 
                  borderRadius: '20px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => selectKb(kb)}
              >
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(124, 92, 252, 0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
                
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📚 {kb.name}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', height: '40px', overflow: 'hidden' }}>
                  {kb.description || 'Geen beschrijving...'}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {kb.allowedRoles && JSON.parse(kb.allowedRoles).map((role: string) => (
                      <span key={role} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>
                        {role}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {kb._count?.documents || 0} docs
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', position: 'relative' }}>
          <button 
            onClick={() => setActiveKb(null)} 
            className="btn" 
            style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
          
          <div style={{ marginBottom: '2rem', paddingRight: '4rem' }}>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{activeKb.name}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{activeKb.description}</p>
          </div>

          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>Geüploade Documenten</h4>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>BESTAND</th>
                      <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>TYPE</th>
                      <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Geen documenten in deze kennisbank.
                        </td>
                      </tr>
                    ) : (
                      docs.map(doc => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>
                              {doc.fileType === 'pdf' ? '📄' : doc.fileType.includes('doc') ? '📝' : '📎'}
                            </span>
                            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{doc.fileType.toUpperCase()}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ 
                              padding: '4px 10px',
                              borderRadius: '20px',
                              background: doc.status === 'processing' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                              color: doc.status === 'processing' ? 'var(--accent)' : '#4ade80',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {doc.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {user?.role === 'admin' && (
              <div style={{ width: '300px' }}>
                <div style={{ background: 'linear-gradient(145deg, rgba(124, 92, 252, 0.1), rgba(56, 189, 248, 0.05))', borderRadius: '16px', padding: '1.5rem', border: '1px dashed rgba(124, 92, 252, 0.3)', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>☁️</span>
                  <h4 style={{ marginBottom: '0.5rem' }}>Nieuw Document</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Upload PDF, Word of TXT bestanden naar de vector database.</p>
                  
                  <label className="btn btn-primary" style={{ display: 'inline-block', width: '100%', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                    {uploading ? 'Bezig met verwerken...' : 'Kies Bestand'}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleUpload}
                      disabled={uploading}
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.txt,.md"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
