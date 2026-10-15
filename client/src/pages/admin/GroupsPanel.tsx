import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Group {
  id: string;
  name: string;
  description: string;
  type?: 'group' | 'class';
  _count?: { members: number, studentMembers?: number, teacherMembers?: number };
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
  }
}

export default function GroupsPanel() {
  const token = useAuthStore(state => state.token);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  // New member search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      fetchMembers(selectedGroupId, (selectedGroup?.type || 'group') as 'group' | 'class');
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      // Fetch both groups and classes
      const [groupsRes, classesRes] = await Promise.all([
        fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (!groupsRes.ok) throw new Error('Kon groepen niet ophalen');
      if (!classesRes.ok) throw new Error('Kon klassen niet ophalen');
      
      const groupsData = await groupsRes.json();
      const classesData = await classesRes.json();
      
      // Merge them into a single list
      const combined = [
        ...groupsData.map((g: any) => ({ ...g, type: 'group' })),
        ...classesData.map((c: any) => ({ 
          ...c, 
          type: 'class',
          _count: { members: (c._count?.studentMembers || 0) + (c._count?.teacherMembers || 0) }
        }))
      ];
      
      // Sort by name
      combined.sort((a, b) => a.name.localeCompare(b.name));
      
      setGroups(combined);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId: string, type: 'group' | 'class') => {
    setMemberLoading(true);
    try {
      const url = type === 'class' ? `/api/classes/${groupId}/members` : `/api/groups/${groupId}/members`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fout bij ophalen leden');
      
      if (type === 'class') {
        // Map class members to common member format
        const studentMembers = (data.studentMembers || []).map((m: any) => ({
          id: m.id, userId: m.student.id, role: 'student', user: m.student
        }));
        const teacherMembers = (data.teacherMembers || []).map((m: any) => ({
          id: m.id, userId: m.teacher.id, role: 'teacher', user: m.teacher
        }));
        setMembers([...teacherMembers, ...studentMembers]);
      } else {
        setMembers(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setMemberLoading(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isEdit ? `/api/groups/${formData.id}` : '/api/groups';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setIsModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async (id: string, type: 'group' | 'class') => {
    if (!confirm(`Weet je zeker dat je deze ${type === 'class' ? 'klas' : 'groep'} wilt verwijderen? Leden blijven bestaan als gebruikers.`)) return;
    try {
      const url = type === 'class' ? `/api/classes/${id}` : `/api/groups/${id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Kon ${type === 'class' ? 'klas' : 'groep'} niet verwijderen`);
      fetchGroups();
      if (selectedGroupId === id) setSelectedGroupId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;
    
    try {
      const url = group.type === 'class' ? `/api/classes/${selectedGroupId}/members` : `/api/groups/${selectedGroupId}/members`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, role: 'member' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchMembers(selectedGroupId, group.type as 'group'|'class');
      fetchGroups(); // Update count
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    if (!confirm('Lid verwijderen?')) return;
    try {
      const url = group.type === 'class' ? `/api/classes/${selectedGroupId}/members/${userId}` : `/api/groups/${selectedGroupId}/members/${userId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Kon lid niet verwijderen');
      fetchMembers(selectedGroupId, group.type as 'group'|'class');
      fetchGroups(); // Update count
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div>Laden...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 6rem)' }}>
      {/* Linker kolom: Groepen */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Groepen & Klassen</h2>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
            setIsEdit(false);
            setFormData({ id: '', name: '', description: '' });
            setIsModalOpen(true);
          }}>+ Nieuwe Groep</button>
        </div>

        <div className="glass-panel" style={{ flex: 1, overflowY: 'auto' }}>
          {groups.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Geen groepen gevonden.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Naam</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Leden</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <tr 
                    key={group.id} 
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: selectedGroupId === group.id ? 'var(--bg-surface-hover)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 500 }}>
                        {group.name}
                        {group.type === 'class' && (
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: 'rgba(124, 92, 252, 0.2)', color: '#c4b5fd', padding: '2px 6px', borderRadius: '4px' }}>
                            Klas
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{group.description}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{group._count?.members || 0}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--primary)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ id: group.id, name: group.name, description: group.description || '' });
                          setIsEdit(true);
                          setIsModalOpen(true);
                        }}
                      >Bewerken</button>
                      <button 
                        className="btn" 
                        style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: '#ef4444' }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, group.type as 'group'|'class'); }}
                      >Verwijderen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rechter kolom: Leden */}
      {selectedGroupId && (
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column' }} className="glass-panel">
          <h3 style={{ marginBottom: '1rem' }}>Leden van {groups.find(g => g.id === selectedGroupId)?.name}</h3>
          
          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Gebruiker zoeken om toe te voegen..." 
              value={searchQuery}
              onChange={e => searchUsers(e.target.value)}
            />
            {searchLoading && (
              <div style={{ position: 'absolute', right: '10px', top: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Zoeken...
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div style={{ 
                position: 'absolute', top: '100%', left: 0, right: 0, 
                background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: '200px', overflowY: 'auto'
              }}>
                {searchResults.map(u => (
                  <div 
                    key={u.id} 
                    style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => handleAddMember(u.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                    </div>
                    <span style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>+</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {memberLoading ? <p>Laden...</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {members.map(member => (
                  <li key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{member.user.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.user.role} &bull; {member.role}</div>
                    </div>
                    <button 
                      className="btn" 
                      style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: '#ef4444' }}
                      onClick={() => handleRemoveMember(member.user.id)}
                    >&times;</button>
                  </li>
                ))}
                {members.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Deze groep heeft nog geen leden.</p>}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Groep Form Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEdit ? 'Groep Bewerken' : 'Nieuwe Groep'}</h2>
            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Naam *</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Bv. Klas 4A" />
              </div>
              <div className="input-group">
                <label>Beschrijving</label>
                <input type="text" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optioneel" />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Annuleren</button>
                <button type="submit" className="btn btn-primary">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
