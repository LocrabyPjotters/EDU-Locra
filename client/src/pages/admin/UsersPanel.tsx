import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import UserProfileModal from '../../components/UserProfileModal';

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  superadmin: { label: 'Superadmin', emoji: '👑', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  admin:      { label: 'Beheerder',  emoji: '🔑', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  teacher:    { label: 'Docent',     emoji: '📚', color: '#7dd3fc', bg: 'rgba(125,211,252,0.1)', border: 'rgba(125,211,252,0.25)' },
  confidant:  { label: 'VP',         emoji: '🛡️',color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.25)' },
  student:    { label: 'Leerling',   emoji: '🎒', color: '#6ee7b7', bg: 'rgba(110,231,183,0.1)', border: 'rgba(110,231,183,0.25)' },
};

const roleMeta = (role: string) =>
  ROLE_META[role] ?? { label: role, emoji: '👤', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' };

const avatarInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const avatarColor = (name: string) => {
  const colors = ['#6366f1','#ec4899','#10b981','#f59e0b','#3b82f6','#8b5cf6','#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
      boxShadow: `0 0 0 2px rgba(0,0,0,0.3)`
    }}>
      {avatarInitials(name || '?')}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const m = roleMeta(role);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: m.bg, border: `1px solid ${m.border}`, color: m.color,
      padding: '3px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700
    }}>
      {m.emoji} {m.label}
    </span>
  );
}

function StatCard({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: color, filter: 'blur(40px)', opacity: 0.18 }} />
      <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{emoji}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', zIndex: 200,
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease'
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '95vw',
        background: 'rgba(15,15,25,0.97)', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        backdropFilter: 'blur(20px)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
  color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box'
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function UsersPanel() {
  const token = useAuthStore(state => state.token);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Panels
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit' | 'import' | null>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [profileModalUser, setProfileModalUser] = useState<UserRecord | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Forms
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', displayName: '', role: 'student' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // CSV import
  const [csvData, setCsvData] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');
  const csvFileRef = useRef<HTMLInputElement>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchUsers(); }, [token]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter(u => statusFilter === 'active' ? u.isActive : !u.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.displayName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, statusFilter, search]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    setNewUser({ username: '', email: '', password: '', displayName: '', role: 'student' });
    setFormError('');
    setDrawerMode('add');
  };

  const openEdit = (u: UserRecord) => {
    setEditUser({ ...u, password: '' });
    setFormError('');
    setDrawerMode('edit');
  };

  const closeDrawer = () => setDrawerMode(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt');
      await fetchUsers();
      closeDrawer();
    } catch (err: any) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload: any = { displayName: editUser.displayName, role: editUser.role, isActive: editUser.isActive };
      if (editUser.password) payload.password = editUser.password;
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update mislukt');
      await fetchUsers();
      closeDrawer();
    } catch (err: any) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (u: UserRecord) => {
    if (!confirm(`Weet je zeker dat je "${u.displayName}" wilt deactiveren? Ze kunnen dan niet meer inloggen, maar hun data blijft bewaard.`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleForceLogout = async (u: UserRecord) => {
    if (!confirm(`Weet je zeker dat je alle actieve sessies van "${u.displayName}" geforceerd wilt beëindigen?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}/revoke-sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert(`Gebruiker ${u.displayName} is overal uitgelogd.`);
      }
    } catch (err) { console.error(err); }
  };

  const handleGdprExport = (id: string) => window.open(`/api/users/${id}/export?token=${token}`, '_blank');

  const handleGdprDelete = async (id: string, name: string) => {
    if (!confirm(`⚠️ WAARSCHUWING: Dit verwijdert ALLE data van "${name}" permanent (GDPR). Kan niet ongedaan worden gemaakt. Doorgaan?`)) return;
    try {
      const res = await fetch(`/api/users/${id}/data`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { fetchUsers(); closeDrawer(); }
      else { const d = await res.json(); alert(d.error || 'Verwijderen mislukt'); }
    } catch (err) { console.error(err); }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvData(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true); setImportResult(null); setImportError('');
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
    } catch (err: any) { setImportError(err.message); }
    finally { setImporting(false); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Gebruikers totaal',     value: users.length,                                        color: '#6366f1', emoji: '👥' },
    { label: 'Actieve accounts',      value: users.filter(u => u.isActive).length,                color: '#10b981', emoji: '✅' },
    { label: 'Leerlingen',            value: users.filter(u => u.role === 'student').length,      color: '#10b981', emoji: '🎒' },
    { label: 'Docenten',              value: users.filter(u => u.role === 'teacher').length,      color: '#3b82f6', emoji: '📚' },
    { label: 'Vertrouwenspersonen',   value: users.filter(u => u.role === 'confidant').length,    color: '#ec4899', emoji: '🛡️' },
    { label: 'Beheerders',            value: users.filter(u => ['admin','superadmin'].includes(u.role)).length, color: '#f59e0b', emoji: '🔑' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#f8fafc' }}>
            👥 Gebruikersbeheer
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
            Beheer accounts, importeer via CSV en stel AVG/GDPR-rechten in.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setImportResult(null); setCsvData(''); setImportError(''); setDrawerMode('import'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            📄 CSV Import
          </button>
          <button
            onClick={openAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--primary)', border: 'none',
              color: '#fff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem'
            }}
          >
            + Nieuwe Gebruiker
          </button>
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Filters & Search ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Zoek op naam, gebruikersnaam of e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '36px' }}
          />
        </div>
        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: '160px', cursor: 'pointer' }}
        >
          <option value="all">Alle rollen</option>
          <option value="student">🎒 Leerling</option>
          <option value="teacher">📚 Docent</option>
          <option value="confidant">🛡️ VP</option>
          <option value="admin">🔑 Beheerder</option>
        </select>
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: '140px', cursor: 'pointer' }}
        >
          <option value="all">Alle statussen</option>
          <option value="active">✅ Actief</option>
          <option value="inactive">⛔ Inactief</option>
        </select>
        {/* Count */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {filtered.length} van {users.length}
        </div>
      </div>

      {/* ── Users list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', padding: '2rem' }}>
          <div style={{ width: 20, height: 20, border: '2px solid rgba(99,102,241,0.4)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Gebruikers laden...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
          <div style={{ fontWeight: 600 }}>Geen gebruikers gevonden</div>
          <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>Pas de filters aan of voeg een nieuwe gebruiker toe.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(u => (
            <UserCard
              key={u.id}
              user={u}
              onEdit={openEdit}
              onDeactivate={handleDeactivate}
              onForceLogout={handleForceLogout}
              onAiProfile={() => setProfileModalUser(u)}
            />
          ))}
        </div>
      )}

      {/* ── Drawers ───────────────────────────────────────────────────────── */}

      {/* Add user */}
      <Drawer open={drawerMode === 'add'} onClose={closeDrawer} title="✨ Nieuwe Gebruiker Toevoegen">
        <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {formError && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>⚠️ {formError}</div>}
          <Field label="Gebruikersnaam">
            <input style={inputStyle} required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="bijv. jdoe" />
          </Field>
          <Field label="Weergavenaam">
            <input style={inputStyle} required value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="Jan Doe" />
          </Field>
          <Field label="E-mailadres">
            <input style={inputStyle} type="email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="jan@school.nl" />
          </Field>
          <Field label="Wachtwoord">
            <input style={inputStyle} type="password" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Minimaal 8 tekens" />
          </Field>
          <Field label="Rol">
            <select style={inputStyle} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="student">🎒 Leerling</option>
              <option value="teacher">📚 Docent</option>
              <option value="confidant">🛡️ Vertrouwenspersoon (VP)</option>
              <option value="admin">🔑 Beheerder</option>
            </select>
          </Field>
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ width: '100%', background: 'var(--primary)', border: 'none', color: '#fff', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '⏳ Aanmaken...' : '✅ Gebruiker Aanmaken'}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Edit user */}
      <Drawer open={drawerMode === 'edit' && !!editUser} onClose={closeDrawer} title={
        editUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={editUser.displayName} size={30} />
            <span>{editUser.displayName}</span>
          </div>
        ) : 'Bewerken'
      }>
        {editUser && (
          <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {formError && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>⚠️ {formError}</div>}

            <Field label="Weergavenaam">
              <input style={inputStyle} required value={editUser.displayName} onChange={e => setEditUser({ ...editUser, displayName: e.target.value })} />
            </Field>
            <Field label="Rol">
              <select style={inputStyle} value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
                <option value="student">🎒 Leerling</option>
                <option value="teacher">📚 Docent</option>
                <option value="confidant">🛡️ Vertrouwenspersoon (VP)</option>
                <option value="admin">🔑 Beheerder</option>
              </select>
            </Field>
            <Field label="Nieuw Wachtwoord (leeglaten = niet wijzigen)">
              <input style={inputStyle} type="password" value={editUser.password || ''} onChange={e => setEditUser({ ...editUser, password: e.target.value })} placeholder="Nieuw wachtwoord..." />
            </Field>

            {/* Account actief toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Account Actief</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>Inactieve gebruikers kunnen niet inloggen.</div>
              </div>
              <button
                type="button"
                onClick={() => setEditUser({ ...editUser, isActive: !editUser.isActive })}
                style={{
                  width: 44, height: 24, borderRadius: '999px', border: 'none', cursor: 'pointer',
                  background: editUser.isActive ? '#10b981' : 'rgba(255,255,255,0.12)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: editUser.isActive ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block'
                }} />
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '⏳ Opslaan...' : '💾 Wijzigingen Opslaan'}
            </button>

            {/* GDPR / AVG sectie */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                🛡️ AVG / GDPR Acties
              </div>
              <button
                type="button"
                onClick={() => handleGdprExport(editUser.id)}
                style={{ width: '100%', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textAlign: 'left' }}
              >
                📥 Data Exporteren (JSON)
              </button>
              <button
                type="button"
                onClick={() => handleGdprDelete(editUser.id, editUser.displayName)}
                style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textAlign: 'left' }}
              >
                🗑️ Alle Data Permanent Wissen
              </button>
            </div>
          </form>
        )}
      </Drawer>

      {/* CSV Import drawer */}
      <Drawer open={drawerMode === 'import'} onClose={closeDrawer} title="📄 Gebruikers Importeren (CSV)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Upload een CSV-bestand of plak de inhoud hieronder.<br />
            Kolommen: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>username</code>, <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>email</code>, <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>naam</code>, <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>wachtwoord</code>, <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '4px' }}>rol</code>
          </p>

          {importError && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>⚠️ {importError}</div>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => csvFileRef.current?.click()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
            >
              📁 Bestand Kiezen
            </button>
            <button
              onClick={() => setCsvData('username;email;naam;wachtwoord;rol\nleerling1;l1@school.nl;Jan Janssen;Welkom123!;student\n')}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              📋 Voorbeeld
            </button>
            <input type="file" ref={csvFileRef} style={{ display: 'none' }} accept=".csv,.txt,.tsv" onChange={handleCsvFile} />
          </div>

          <textarea
            style={{ ...inputStyle, minHeight: '180px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.78rem' }}
            value={csvData}
            onChange={e => setCsvData(e.target.value)}
            placeholder={'username;email;naam;wachtwoord;rol\njdoe;j.doe@school.nl;Jan Doe;Welkom1!;student'}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {csvData.trim() ? `${csvData.trim().split('\n').length - 1} rijen gedetecteerd` : 'Geen data'}
            </span>
            <button
              onClick={handleImport}
              disabled={!csvData.trim() || importing}
              style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', opacity: (!csvData.trim() || importing) ? 0.5 : 1 }}
            >
              {importing ? '⏳ Importeren...' : '🚀 Importeer'}
            </button>
          </div>

          {importResult && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px', color: '#6ee7b7' }}>✅ Import Resultaat</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Aangemaakt', value: importResult.created, color: '#34d399' },
                  { label: 'Overgeslagen', value: importResult.skipped, color: '#fbbf24' },
                  { label: 'Totaal', value: importResult.total, color: '#a5b4fc' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {importResult.errors?.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#f87171' }}>
                  <strong>Fouten:</strong>
                  <ul style={{ marginTop: '4px', paddingLeft: '18px' }}>
                    {importResult.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>

      {/* AI Profile modal */}
      {profileModalUser && (
        <UserProfileModal
          userId={profileModalUser.id}
          userName={profileModalUser.username}
          userDisplayName={profileModalUser.displayName}
          userRole={profileModalUser.role}
          onClose={() => setProfileModalUser(null)}
          onProfileUpdated={fetchUsers}
        />
      )}
    </div>
  );
}

// ─── User card (row) ──────────────────────────────────────────────────────────
function UserCard({
  user, onEdit, onDeactivate, onForceLogout, onAiProfile
}: {
  user: UserRecord;
  onEdit: (u: UserRecord) => void;
  onDeactivate: (u: UserRecord) => void;
  onForceLogout: (u: UserRecord) => void;
  onAiProfile: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '14px', padding: '14px 18px',
        transition: 'all 0.18s ease', cursor: 'default'
      }}
    >
      {/* Avatar */}
      <Avatar name={user.displayName} size={40} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{user.displayName}</span>
          <RoleBadge role={user.role} />
          {!user.isActive && (
            <span style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '2px 7px', borderRadius: '999px', fontWeight: 700 }}>
              Inactief
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          @{user.username}
          {user.email ? ` · ${user.email}` : ''}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <ActionBtn
          onClick={onAiProfile}
          title="AI-Profiel Bekijken"
          color="#6366f1"
          colorAlpha="rgba(99,102,241,0.15)"
          colorBorder="rgba(99,102,241,0.3)"
        >
          🧠
        </ActionBtn>
        <ActionBtn
          onClick={() => onEdit(user)}
          title="Bewerken"
          color="#94a3b8"
          colorAlpha="rgba(148,163,184,0.1)"
          colorBorder="rgba(148,163,184,0.2)"
        >
          ✏️
        </ActionBtn>
        <ActionBtn
          onClick={() => onForceLogout(user)}
          title="Forceer Uitloggen op Alle Apparaten"
          color="#ef4444"
          colorAlpha="rgba(239,68,68,0.12)"
          colorBorder="rgba(239,68,68,0.3)"
        >
          🛡️
        </ActionBtn>
        {user.isActive && (
          <ActionBtn
            onClick={() => onDeactivate(user)}
            title="Deactiveren"
            color="#f59e0b"
            colorAlpha="rgba(245,158,11,0.1)"
            colorBorder="rgba(245,158,11,0.25)"
          >
            ⛔
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, title, color, colorAlpha, colorBorder, children }: {
  onClick: () => void; title: string; color: string; colorAlpha: string; colorBorder: string; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov ? colorAlpha : 'transparent',
        border: `1px solid ${hov ? colorBorder : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
        transition: 'all 0.15s ease', color
      }}
    >
      {children}
    </button>
  );
}
