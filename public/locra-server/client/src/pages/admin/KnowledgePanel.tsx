import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function KnowledgePanel() {
  const token = useAuthStore(state => state.token);
  const [kbs, setKbs] = useState<any[]>([]);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  
  const [activeKb, setActiveKb] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      body: JSON.stringify({ name: newKbName, description: newKbDesc })
    });
    setNewKbName('');
    setNewKbDesc('');
    fetchKbs();
  };

  const selectKb = async (kb: any) => {
    setActiveKb(kb);
    const res = await fetch(`/api/knowledge/${kb.id}/documents`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setDocs(await res.json());
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
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Kennisbank (RAG) Beheer</h2>
      
      {!activeKb ? (
        <>
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Nieuwe Kennisbank Aanmaken</h3>
            <form onSubmit={handleCreateKb} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Naam (bijv. Biologie Leerjaar 1)"
                value={newKbName}
                onChange={e => setNewKbName(e.target.value)}
                required
              />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Omschrijving (optioneel)"
                value={newKbDesc}
                onChange={e => setNewKbDesc(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Aanmaken</button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3>Bestaande Kennisbanken</h3>
            {kbs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Nog geen kennisbanken aangemaakt.</p>
            ) : (
              <ul style={{ listStyle: 'none', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {kbs.map(kb => (
                  <li 
                    key={kb.id} 
                    style={{ 
                      padding: '1rem', 
                      background: 'var(--bg-base)', 
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--bg-surface-hover)',
                      cursor: 'pointer'
                    }}
                    onClick={() => selectKb(kb)}
                  >
                    <div>
                      <strong>{kb.name}</strong>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{kb.description}</p>
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                      {kb._count?.documents || 0} documenten
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <button onClick={() => setActiveKb(null)} className="btn" style={{ marginBottom: '1.5rem', background: 'var(--bg-surface-hover)' }}>
            &larr; Terug naar overzicht
          </button>
          
          <h3>{activeKb.name} - Documenten</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{activeKb.description}</p>

          <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--bg-surface-hover)' }}>
             <h4>Document Uploaden (PDF, Word, TXT)</h4>
             <input 
               type="file" 
               ref={fileInputRef}
               onChange={handleUpload}
               disabled={uploading}
               style={{ marginTop: '1rem', display: 'block' }}
             />
             {uploading && <p style={{ color: 'var(--primary)', marginTop: '0.5rem' }}>Bezig met uploaden...</p>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                <th style={{ padding: '0.75rem' }}>Bestandsnaam</th>
                <th style={{ padding: '0.75rem' }}>Type</th>
                <th style={{ padding: '0.75rem' }}>Grootte</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Geen documenten in deze kennisbank.
                  </td>
                </tr>
              ) : (
                docs.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                    <td style={{ padding: '0.75rem' }}>{doc.filename}</td>
                    <td style={{ padding: '0.75rem' }}>{doc.fileType.toUpperCase()}</td>
                    <td style={{ padding: '0.75rem' }}>{(Number(doc.fileSize) / 1024 / 1024).toFixed(2)} MB</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        color: doc.status === 'processing' ? 'var(--accent)' : 'var(--primary)',
                        fontSize: '0.875rem'
                      }}>
                        {doc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
