import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Model {
  id: string;
  ollamaName: string;
  displayName: string;
  isActive: boolean;
  routingTier: string;
  creditCost: number;
  thinkingCreditCost: number;
  provider: string;
}

export default function ModelsPanel() {
  const token = useAuthStore(state => state.token);
  const [models, setModels] = useState<Model[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  // Settings
  const [settings, setSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Form states
  const [newOllamaModel, setNewOllamaModel] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customProvider, setCustomProvider] = useState('openrouter');
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchStatus();
    fetchSettings();
  }, []);

  const fetchModels = async () => {
    const res = await fetch('/api/models', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setModels(await res.json());
  };

  const fetchStatus = async () => {
    const res = await fetch('/api/models/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setStatus(await res.json());
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setSettings(await res.json());
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          openRouterApiKey: settings.openRouterApiKey,
          openAiApiKey: settings.openAiApiKey
        })
      });
    } catch (e) {
      console.error(e);
    }
    setSavingSettings(false);
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOllamaModel) return;
    setPulling(true);
    setPullProgress(0);

    const interval = setInterval(() => {
      setPullProgress(prev => Math.min(prev + Math.random() * 5, 95));
    }, 500);

    try {
      const res = await fetch('/api/models/pull', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ modelName: newOllamaModel })
      });
      if (res.ok) {
        setPullProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setNewOllamaModel('');
          setPulling(false);
          setPullProgress(0);
          fetchModels();
        }, 800);
      } else {
        throw new Error();
      }
    } catch (e) {
      clearInterval(interval);
      setPulling(false);
      setPullProgress(0);
      alert('Fout tijdens pullen');
    }
  };

  const handleAddCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customModelId || !customProvider) return;
    setAddingCustom(true);
    try {
      const res = await fetch('/api/models/custom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          modelName: customModelId, 
          displayName: customModelName || customModelId,
          provider: customProvider
        })
      });
      if (res.ok) {
        setCustomModelId('');
        setCustomModelName('');
        fetchModels();
      }
    } catch (e) {
      console.error(e);
    }
    setAddingCustom(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit model wilt verwijderen?')) return;
    try {
      await fetch(`/api/models/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchModels();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>AI Modellen & API's</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Beheer lokale Ollama modellen en externe API koppelingen zoals OpenRouter.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className="btn" 
            style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.875rem' }}
            onClick={() => {
              fetchModels();
              fetchStatus();
            }}
          >
            🔄 Vernieuwen
          </button>
          {status && (
            <div style={{ background: status.status === 'running' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-pill)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: `1px solid ${status.status === 'running' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}` }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.status === 'running' ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 10px ${status.status === 'running' ? 'var(--success)' : 'var(--danger)'}` }} />
              Ollama {status.status === 'running' ? 'Online' : 'Offline'}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Lokale Modellen (Ollama) */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>Nieuw lokaal model (Ollama / HuggingFace)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Download een model naar de lokale server.
          </p>
          <form onSubmit={handlePull} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Bijv. llama3.1:8b"
              value={newOllamaModel}
              onChange={e => setNewOllamaModel(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={pulling} style={{ width: 'auto' }}>
              {pulling ? 'Pulling...' : 'Installeren'}
            </button>
          </form>
          {pulling && (
            <div style={{ marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${pullProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>
          )}
        </div>

        {/* Custom API Models */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>Nieuw API model (OpenRouter / OpenAI)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Voeg een cloud-model toe via een API-sleutel.
          </p>
          <form onSubmit={handleAddCustomModel} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="input-field" 
                value={customProvider} 
                onChange={e => setCustomProvider(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Model ID (bijv. nvidia/nemotron-3...)"
                value={customModelId}
                onChange={e => setCustomModelId(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Weergavenaam (optioneel)"
                value={customModelName}
                onChange={e => setCustomModelName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={addingCustom} style={{ width: 'auto' }}>
                Toevoegen
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3>API Sleutels</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Koppel externe providers om geavanceerde cloud-modellen te gebruiken. OpenRouter ondersteunt ook Deep Thinking (Reasoning).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>OpenRouter API Key</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="sk-or-v1-..."
              value={settings.openRouterApiKey || ''}
              onChange={e => setSettings({...settings, openRouterApiKey: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>OpenAI API Key</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="sk-proj-..."
              value={settings.openAiApiKey || ''}
              onChange={e => setSettings({...settings, openAiApiKey: e.target.value})}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ width: 'auto' }}>
            {savingSettings ? 'Opslaan...' : 'API Sleutels Opslaan'}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3>Geïnstalleerde Modellen</h3>
        {models.length === 0 ? (
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Nog geen modellen toegevoegd.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-surface-hover)' }}>
                  <th style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Model / Provider</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Weergavenaam</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tier</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Credits</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--bg-surface-hover)', opacity: m.isActive ? 1 : 0.5 }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <code>{m.ollamaName}</code>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {m.provider}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ padding: '0.35rem 0.5rem', width: '100%' }}
                        value={m.displayName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setModels(prev => prev.map(model => model.id === m.id ? { ...model, displayName: newName } : model));
                        }}
                        onBlur={async (e) => {
                          await fetch(`/api/models/${m.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ displayName: e.target.value })
                          });
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <select 
                        className="input-field" 
                        style={{ padding: '0.35rem 0.5rem', width: 'auto' }}
                        value={m.routingTier}
                        onChange={async (e) => {
                          const newTier = e.target.value;
                          setModels(prev => prev.map(model => model.id === m.id ? { ...model, routingTier: newTier } : model));
                          await fetch(`/api/models/${m.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ routingTier: newTier })
                          });
                        }}
                      >
                        <option value="light">Snel (Light)</option>
                        <option value="standard">Standaard</option>
                        <option value="heavy">Denken (Heavy)</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          className="input-field" 
                          style={{ width: '60px', padding: '0.35rem' }} 
                          value={m.creditCost} 
                          title="Normale kosten"
                          onChange={e => setModels(prev => prev.map(model => model.id === m.id ? { ...model, creditCost: parseInt(e.target.value) || 1 } : model))}
                          onBlur={async (e) => {
                            await fetch(`/api/models/${m.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ creditCost: parseInt(e.target.value) })
                            });
                          }}
                        />
                        <span style={{ color: 'var(--text-secondary)' }}>/</span>
                        <input 
                          type="number" 
                          className="input-field" 
                          style={{ width: '60px', padding: '0.35rem' }} 
                          value={m.thinkingCreditCost} 
                          title="Kosten met Deep Thinking"
                          onChange={e => setModels(prev => prev.map(model => model.id === m.id ? { ...model, thinkingCreditCost: parseInt(e.target.value) || 3 } : model))}
                          onBlur={async (e) => {
                            await fetch(`/api/models/${m.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ thinkingCreditCost: parseInt(e.target.value) })
                            });
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '0.35rem 0.75rem', background: 'rgba(248, 113, 113, 0.1)', color: 'var(--danger)', fontSize: '0.875rem' }}
                        onClick={() => handleDelete(m.id)}
                      >
                        Verwijder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
