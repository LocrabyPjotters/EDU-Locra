import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import UpgradePrompt from '../../components/UpgradePrompt';

interface Group {
  id: string;
  name: string;
  description: string;
  type?: 'group' | 'class';
  _count?: { members: number; studentMembers?: number; teacherMembers?: number };
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
  };
}

const avatarColor = (name: string) => {
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const avatarInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0
      }}
    >
      {avatarInitials(name || '?')}
    </div>
  );
}

export default function GroupsPanel() {
  const token = useAuthStore(state => state.token);
  const [isLocked, setIsLocked] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'class' | 'group'>('all');

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', description: '', type: 'class' });
  const [savingGroup, setSavingGroup] = useState(false);

  // Selected Group & Members
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  // Member search
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
    } else {
      setMembers([]);
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const [groupsRes, classesRes] = await Promise.all([
        fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (groupsRes.status === 403 || classesRes.status === 403) {
        setIsLocked(true);
        setLoading(false);
        return;
      }

      if (!groupsRes.ok) throw new Error('Kon groepen niet ophalen');
      if (!classesRes.ok) throw new Error('Kon klassen niet ophalen');

      const groupsData = await groupsRes.json();
      const classesData = await classesRes.json();

      const combined: Group[] = [
        ...groupsData.map((g: any) => ({ ...g, type: 'group' })),
        ...classesData.map((c: any) => ({
          ...c,
          type: 'class',
          _count: { members: (c._count?.studentMembers || 0) + (c._count?.teacherMembers || 0) }
        }))
      ];

      combined.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(combined);

      // Selecteer standaard de eerste groep als er nog geen geselecteerd is
      if (!selectedGroupId && combined.length > 0) {
        setSelectedGroupId(combined[0].id);
      }
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
        const studentMembers = (data.studentMembers || []).map((m: any) => ({
          id: m.id,
          userId: m.student.id,
          role: 'student',
          user: m.student
        }));
        const teacherMembers = (data.teacherMembers || []).map((m: any) => ({
          id: m.id,
          userId: m.teacher.id,
          role: 'teacher',
          user: m.teacher
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
    setSavingGroup(true);
    try {
      const targetType = formData.type || 'group';
      let url = '';
      let method = '';

      if (isEdit) {
        url = targetType === 'class' ? `/api/classes/${formData.id}` : `/api/groups/${formData.id}`;
        method = 'PUT';
      } else {
        url = targetType === 'class' ? '/api/classes' : '/api/groups';
        method = 'POST';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');

      setIsModalOpen(false);
      await fetchGroups();
      if (data.id) setSelectedGroupId(data.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string, type: 'group' | 'class', name: string) => {
    if (!confirm(`Weet je zeker dat je ${type === 'class' ? 'de klas' : 'de groep'} "${name}" wilt verwijderen? Leden blijven bestaan als gebruikers.`)) {
      return;
    }
    try {
      const url = type === 'class' ? `/api/classes/${id}` : `/api/groups/${id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Kon ${type === 'class' ? 'klas' : 'groep'} niet verwijderen`);
      
      const remaining = groups.filter(g => g.id !== id);
      setGroups(remaining);
      if (selectedGroupId === id) {
        setSelectedGroupId(remaining[0]?.id || null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
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

  const handleAddMember = async (user: any) => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    try {
      const isClass = group.type === 'class';
      const url = isClass ? `/api/classes/${selectedGroupId}/members` : `/api/groups/${selectedGroupId}/members`;
      
      const payload: any = { userId: user.id };
      if (isClass) {
        payload.role = user.role === 'teacher' ? 'teacher' : 'student';
      } else {
        payload.role = 'member';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toevoegen mislukt');

      await fetchMembers(selectedGroupId, group.type as 'group' | 'class');
      await fetchGroups();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    if (!confirm(`Weet je zeker dat je ${memberName} uit deze ${group.type === 'class' ? 'klas' : 'groep'} wilt verwijderen?`)) {
      return;
    }

    try {
      const url = group.type === 'class'
        ? `/api/classes/${selectedGroupId}/members/${userId}`
        : `/api/groups/${selectedGroupId}/members/${userId}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Kon lid niet verwijderen');

      await fetchMembers(selectedGroupId, group.type as 'group' | 'class');
      await fetchGroups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchesType = typeFilter === 'all' || g.type === typeFilter;
      const matchesSearch =
        search.trim() === '' ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [groups, typeFilter, search]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const stats = useMemo(() => {
    const total = groups.length;
    const classesCount = groups.filter(g => g.type === 'class').length;
    const groupsCount = groups.filter(g => g.type === 'group').length;
    const totalMembersCount = groups.reduce((acc, curr) => acc + (curr._count?.members || 0), 0);
    return { total, classesCount, groupsCount, totalMembersCount };
  }, [groups]);

  if (isLocked) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        <UpgradePrompt
          featureName="Klassen- & Groepenbeheer"
          icon="🧑‍🤝‍🧑"
          requiredTier="edu-plus"
          description="Beheer klassen en groepen binnen de school. Wijs leerlingen en docenten toe aan specifieke klassen en stel gerichte AI-rechten in."
          benefits={[
            'Organiseer leerlingen per klas (bijv. 4VWO-A, 3HAVO-B)',
            'Koppel docenten en mentoren aan hun eigen vakgroepen',
            'Differentieer AI-toegang en modelkeuze per leerjaar',
            'Synchronisatie met schoolroosters en administratie'
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 'calc(100vh - 7rem)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#f8fafc' }}>
            🧑‍🤝‍🧑 Klassen & Groepen
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
            Organiseer leerlingen en docenten in klassen (zoals 4VWO-A) en vak-/projectgroepen.
          </p>
        </div>
        <button
          onClick={() => {
            setIsEdit(false);
            setFormData({ id: '', name: '', description: '', type: 'class' });
            setIsModalOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
          }}
        >
          <span>+</span> Nieuwe Klas of Groep
        </button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#6366f1', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>📚</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Totaal Aangemaakt</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#8b5cf6', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🎓</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c4b5fd', lineHeight: 1 }}>{stats.classesCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Schoolklassen</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#ec4899', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>👥</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f472b6', lineHeight: 1 }}>{stats.groupsCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Vak- & Projectgroepen</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#10b981', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🧑‍🎓</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6ee7b7', lineHeight: 1 }}>{stats.totalMembersCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Leden Toegewezen</div>
        </div>
      </div>

      {/* ── Filters & Search ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>🔍</span>
          <input
            type="text"
            placeholder="Zoek op naam of beschrijving..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '0.75rem 1rem 0.75rem 2.25rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#f8fafc',
              fontSize: '0.88rem',
              width: '100%',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setTypeFilter('all')}
            style={{
              background: typeFilter === 'all' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: typeFilter === 'all' ? '#c7d2fe' : 'var(--text-secondary)',
              border: typeFilter === 'all' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            Alles ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('class')}
            style={{
              background: typeFilter === 'class' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
              color: typeFilter === 'class' ? '#ddd6fe' : 'var(--text-secondary)',
              border: typeFilter === 'class' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            🎓 Klassen ({stats.classesCount})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            style={{
              background: typeFilter === 'group' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
              color: typeFilter === 'group' ? '#fbcfe8' : 'var(--text-secondary)',
              border: typeFilter === 'group' ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            👥 Groepen ({stats.groupsCount})
          </button>
        </div>
      </div>

      {/* ── Main Split View ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', flex: 1 }}>
        {/* Left: Groups list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              ⏳ Klassen & groepen inladen...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '16px',
              border: '1px dashed rgba(255,255,255,0.08)',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>Geen klassen of groepen gevonden</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Maak een nieuwe klas aan met de knop hierboven.</div>
            </div>
          ) : (
            filteredGroups.map(group => {
              const isSelected = selectedGroupId === group.id;
              const isClass = group.type === 'class';

              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderRadius: '16px',
                    background: isSelected
                      ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.08))'
                      : 'rgba(255,255,255,0.02)',
                    border: isSelected
                      ? '1px solid rgba(99, 102, 241, 0.45)'
                      : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: isClass ? 'rgba(139, 92, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                        border: `1px solid ${isClass ? 'rgba(139, 92, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0
                      }}
                    >
                      {isClass ? '🎓' : '👥'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>
                          {group.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            background: isClass ? 'rgba(139, 92, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                            color: isClass ? '#c4b5fd' : '#f472b6',
                            border: `1px solid ${isClass ? 'rgba(139, 92, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)'}`
                          }}
                        >
                          {isClass ? 'Klas' : 'Groep'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {group.description || 'Geen beschrijving'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '4px 9px',
                        borderRadius: '8px',
                        color: '#cbd5e1',
                        fontWeight: 600
                      }}
                    >
                      👥 {group._count?.members || 0} leden
                    </span>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setFormData({
                          id: group.id,
                          name: group.name,
                          description: group.description || '',
                          type: group.type || 'group'
                        });
                        setIsEdit(true);
                        setIsModalOpen(true);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                      title="Bewerken"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id, group.type as 'group' | 'class', group.name);
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                      title="Verwijderen"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Members Panel */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.07)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            minHeight: '480px'
          }}
        >
          {selectedGroup ? (
            <>
              {/* Header of selected group */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{selectedGroup.type === 'class' ? '🎓' : '👥'}</span>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                      {selectedGroup.name}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {members.length} {members.length === 1 ? 'lid' : 'leden'} geregistreerd
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    background: selectedGroup.type === 'class' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                    color: selectedGroup.type === 'class' ? '#c4b5fd' : '#f472b6'
                  }}
                >
                  {selectedGroup.type === 'class' ? 'Schoolklas' : 'Groep'}
                </span>
              </div>

              {/* Add member search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Zoek een leerling of docent om toe te voegen..."
                  value={searchQuery}
                  onChange={e => searchUsers(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                {searchLoading && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Zoeken...
                  </div>
                )}

                {/* Dropdown results */}
                {searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'rgba(15, 23, 42, 0.98)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '14px',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 100,
                      padding: '4px'
                    }}
                  >
                    {searchResults.map(user => {
                      const alreadyMember = members.some(m => m.userId === user.id);

                      return (
                        <div
                          key={user.id}
                          onClick={() => !alreadyMember && handleAddMember(user)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: alreadyMember ? 'default' : 'pointer',
                            opacity: alreadyMember ? 0.5 : 1,
                            background: 'transparent',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => !alreadyMember && (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)')}
                          onMouseLeave={e => !alreadyMember && (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar name={user.displayName} size={28} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f8fafc' }}>{user.displayName}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{user.email || user.username}</div>
                            </div>
                          </div>

                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: alreadyMember ? '#94a3b8' : 'var(--primary)' }}>
                            {alreadyMember ? 'Al lid' : '+ Toevoegen'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Members List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {memberLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    ⏳ Leden inladen...
                  </div>
                ) : members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '6px' }}>👥</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Nog geen leden in deze {selectedGroup.type === 'class' ? 'klas' : 'groep'}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Gebruik de zoekbalk hierboven om leerlingen of docenten toe te voegen.</div>
                  </div>
                ) : (
                  members.map(member => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={member.user?.displayName || 'Gebruiker'} size={32} />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                            {member.user?.displayName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {member.user?.role === 'teacher' ? '👨‍🏫 Docent' : '🎒 Leerling'}
                            {member.role === 'owner' ? ' · Eigenaar' : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user.id, member.user.displayName)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                        title="Verwijder uit groep"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
              Selecteer een klas of groep links om de leden te bekijken en te beheren.
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '1.75rem',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                {isEdit ? 'Klas of Groep Bewerken' : 'Nieuwe Klas of Groep'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isEdit && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                    Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'class' })}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: formData.type === 'class' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                        background: formData.type === 'class' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                        color: formData.type === 'class' ? '#ddd6fe' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      🎓 Schoolklas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'group' })}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: formData.type === 'group' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                        background: formData.type === 'group' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255,255,255,0.03)',
                        color: formData.type === 'group' ? '#fbcfe8' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      👥 Projectgroep
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                  Naam *
                </label>
                <input
                  required
                  type="text"
                  placeholder={formData.type === 'class' ? 'Bijv. 4VWO-A of 3HAVO-1' : 'Bijv. Debatclub of Wiskunde Olympiade'}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                  Beschrijving (optioneel)
                </label>
                <textarea
                  placeholder="Korte omschrijving van de klas of groep..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '75px',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {savingGroup ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
