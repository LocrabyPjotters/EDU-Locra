import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  isActive: boolean;
}

export default function TemplatesPanel() {
  const token = useAuthStore(state => state.token);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', prompt: '', category: 'Algemeen', icon: '💡' });

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setTemplates(await res.json());
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editId ? `/api/templates/${editId}` : '/api/templates';
    const method = editId ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });

    setForm({ name: '', description: '', prompt: '', category: 'Algemeen', icon: '💡' });
    setShowForm(false);
    setEditId(null);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit template wilt verwijderen?')) return;
    await fetch(`/api/templates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTemplates();
  };

  const startEdit = (t: Template) => {
    setForm({ name: t.name, description: t.description, prompt: t.prompt, category: t.category, icon: t.icon });
    setEditId(t.id);
    setShowForm(true);
  };

  const icons = ['💡', '📝', '🔍', '📊', '🎯', '📚', '🧮', '🔬', '🎨', '💬', '📖', '✍️', '🧠', '⚡'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Prompt Templates</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Vooraf ingestelde prompts die leerlingen als snelkoppeling kunnen gebruiken.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', description: '', prompt: '', category: 'Algemeen', icon: '💡' }); }} style={{ width: 'auto' }}>
          {showForm ? 'Annuleren' : '+ Nieuw Template'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>{editId ? 'Template Bewerken' : 'Nieuw Template Aanmaken'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label>Naam</label>
                <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Bijv. Samenvatting Schrijven" required />
              </div>
              <div className="input-group">
                <label>Categorie</label>
                <select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option>Algemeen</option>
                  <option>Schrijven</option>
                  <option>Analyseren</option>
                  <option>Wiskunde</option>
                  <option>Talen</option>
                  <option>Programmeren</option>
                  <option>Creatief</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Beschrijving</label>
              <input className="input-field" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Korte uitleg wat dit template doet" />
            </div>
            <div className="input-group">
              <label>Prompt Tekst</label>
              <textarea className="input-field" style={{ minHeight: '100px', resize: 'vertical' }} value={form.prompt} onChange={e => setForm({...form, prompt: e.target.value})} placeholder="Schrijf een samenvatting van de volgende tekst in maximaal 3 alinea's:" required />
            </div>
            <div className="input-group">
              <label>Icoon</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {icons.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm({...form, icon: ic})} style={{ width: '40px', height: '40px', borderRadius: '8px', border: form.icon === ic ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', background: form.icon === ic ? 'rgba(99,102,241,0.15)' : 'transparent', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              {editId ? 'Opslaan' : 'Aanmaken'}
            </button>
          </form>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Actieve Templates</h3>
        {templates.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Nog geen templates aangemaakt. Maak je eerste prompt template aan zodat gebruikers snel kunnen starten.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {templates.map(t => (
              <div key={t.id} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' }} className="hover-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem' }}>{t.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.category}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => startEdit(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', padding: '4px' }} title="Bewerken">✏️</button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', padding: '4px' }} title="Verwijderen">🗑️</button>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t.description}</p>
                <code style={{ fontSize: '0.75rem', color: 'var(--accent)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.prompt}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
