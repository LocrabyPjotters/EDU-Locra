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
  isCodeMatchOnly?: boolean;
}

const POPULAR_OPENROUTER_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', tier: 'heavy' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)', provider: 'openrouter', tier: 'heavy' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'openrouter', tier: 'heavy' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'openrouter', tier: 'light' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', provider: 'openrouter', tier: 'standard' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter', tier: 'light' }
];

export default function ModelsPanel() {
  const token = useAuthStore(state => state.token);
  const [models, setModels] = useState<Model[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  // Settings
  const [settings, setSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Form states
  const [newOllamaModel, setNewOllamaModel] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customProvider, setCustomProvider] = useState('openrouter');
  const [customRoutingTier, setCustomRoutingTier] = useState('standard');
  const [addingCustom, setAddingCustom] = useState(false);
  const [customFeedback, setCustomFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchModels();
    fetchStatus();
    fetchSettings();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setModels(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/models/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setSettings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          apiIntegrationEnabled: Boolean(settings.openRouterApiKey || settings.openAiApiKey || settings.anthropicApiKey),
          openRouterApiKey: settings.openRouterApiKey,
          openAiApiKey: settings.openAiApiKey,
          anthropicApiKey: settings.anthropicApiKey
        })
      });
      if (res.ok) {
        setSettingsFeedback({ type: 'success', message: 'API-sleutels succesvol opgeslagen! Externe modellen kunnen nu direct gebruikt worden.' });
        fetchSettings();
      } else {
        const err = await res.json();
        setSettingsFeedback({ type: 'error', message: err.error || 'Fout bij opslaan van sleutels.' });
      }
    } catch (e: any) {
      console.error(e);
      setSettingsFeedback({ type: 'error', message: 'Netwerkfout bij opslaan: ' + e.message });
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
        body: JSON.stringify({ modelName: newOllamaModel.trim() })
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
    const cleanId = customModelId.trim();
    if (!cleanId || !customProvider) return;
    setAddingCustom(true);
    setCustomFeedback(null);
    try {
      const res = await fetch('/api/models/custom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          modelName: cleanId, 
          displayName: customModelName.trim() || cleanId,
          provider: customProvider
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        // If tier was chosen, update it
        if (customRoutingTier !== 'standard' && data.id) {
          await fetch(`/api/models/${data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ routingTier: customRoutingTier })
          });
        }
        setCustomFeedback({ type: 'success', message: `Model "${cleanId}" succesvol toegevoegd en geactiveerd!` });
        setCustomModelId('');
        setCustomModelName('');
        fetchModels();
      } else {
        setCustomFeedback({ type: 'error', message: data.error || 'Kon model niet toevoegen.' });
      }
    } catch (e: any) {
      console.error(e);
      setCustomFeedback({ type: 'error', message: 'Netwerkfout: ' + e.message });
    }
    setAddingCustom(false);
  };

  const handleToggleActive = async (m: Model) => {
    const updated = !m.isActive;
    setModels(prev => prev.map(model => model.id === m.id ? { ...model, isActive: updated } : model));
    try {
      await fetch(`/api/models/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: updated })
      });
    } catch (e) {
      console.error(e);
      fetchModels();
    }
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

  const selectPopularModel = (pop: typeof POPULAR_OPENROUTER_MODELS[0]) => {
    setCustomProvider(pop.provider);
    setCustomModelId(pop.id);
    setCustomModelName(pop.name);
    setCustomRoutingTier(pop.tier);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>AI Modellen & API's</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Beheer lokale Ollama modellen en externe cloud API-modellen zoals OpenRouter, OpenAI en Anthropic.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className="btn" 
            style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.875rem' }}
            onClick={() => {
              fetchModels();
              fetchStatus();
              fetchSettings();
            }}
          >
            🔄 Vernieuwen
          </button>
          {status && (
            <div style={{ 
              background: status.status === 'running' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)', 
              padding: '0.5rem 1.25rem', 
              borderRadius: 'var(--radius-pill)', 
              fontSize: '0.875rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              border: `1px solid ${status.status === 'running' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}` 
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: status.status === 'running' ? 'var(--success)' : 'var(--danger)', 
                boxShadow: `0 0 10px ${status.status === 'running' ? 'var(--success)' : 'var(--danger)'}` 
              }} />
              Ollama {status.status === 'running' ? 'Online' : 'Offline'}
            </div>
          )}
        </div>
      </div>

      {/* API Keys Configuration Box */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🔑 API Sleutels (Cloud AI)</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Vul je API-sleutels in om cloudmodellen via OpenRouter of OpenAI te activeren. OpenRouter biedt honderden modellen (waaronder DeepSeek R1, Claude, Llama 3 en Gemini) met één centrale sleutel.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {settings.openRouterApiKey ? (
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>✓ OpenRouter Actief</span>
            ) : (
              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>OpenRouter Niet Ingesteld</span>
            )}
          </div>
        </div>

        {settingsFeedback && (
          <div style={{ 
            padding: '0.75rem 1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem', 
            fontSize: '0.875rem',
            background: settingsFeedback.type === 'success' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
            border: `1px solid ${settingsFeedback.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
            color: settingsFeedback.type === 'success' ? '#34d399' : '#f87171'
          }}>
            {settingsFeedback.type === 'success' ? '✅ ' : '⚠️ '} {settingsFeedback.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              OpenRouter API Key {settings.openRouterApiKey && <span style={{ color: 'var(--success)' }}>●</span>}
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="sk-or-v1-..."
              value={settings.openRouterApiKey || ''}
              onChange={e => setSettings({...settings, openRouterApiKey: e.target.value})}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Aanbevolen voor DeepSeek R1, Claude, Llama 3 & Gemini
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              OpenAI API Key {settings.openAiApiKey && <span style={{ color: 'var(--success)' }}>●</span>}
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="sk-proj-..."
              value={settings.openAiApiKey || ''}
              onChange={e => setSettings({...settings, openAiApiKey: e.target.value})}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Voor directe GPT-4o / GPT-4o-mini koppeling
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Anthropic API Key {settings.anthropicApiKey && <span style={{ color: 'var(--success)' }}>●</span>}
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="sk-ant-..."
              value={settings.anthropicApiKey || ''}
              onChange={e => setSettings({...settings, anthropicApiKey: e.target.value})}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Optioneel voor directe Claude API
            </span>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ width: 'auto' }}>
            {savingSettings ? 'Opslaan...' : '💾 API Sleutels Opslaan'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Lokale Modellen (Ollama) */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>📥 Lokaal model downloaden (Ollama)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Download open-source modellen direct naar de lokale Locra server.
          </p>
          <form onSubmit={handlePull} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Bijv. llama3.1:8b of qwen2.5:7b"
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
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>☁️ API Model Toevoegen</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Koppel een OpenRouter of OpenAI model aan de chatlijst.
          </p>

          {customFeedback && (
            <div style={{ 
              padding: '0.6rem 0.8rem', 
              borderRadius: '6px', 
              marginBottom: '1rem', 
              fontSize: '0.85rem',
              background: customFeedback.type === 'success' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              border: `1px solid ${customFeedback.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              color: customFeedback.type === 'success' ? '#34d399' : '#f87171'
            }}>
              {customFeedback.type === 'success' ? '✅ ' : '⚠️ '} {customFeedback.message}
            </div>
          )}

          {/* Quick pick chips */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Snelle suggesties (klik om in te vullen):
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {POPULAR_OPENROUTER_MODELS.map(pop => (
                <button
                  key={pop.id}
                  type="button"
                  onClick={() => selectPopularModel(pop)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    background: customModelId === pop.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: customModelId === pop.id ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: customModelId === pop.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {pop.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddCustomModel} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="input-field" 
                value={customProvider} 
                onChange={e => setCustomProvider(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Model ID (bijv. deepseek/deepseek-r1)"
                value={customModelId}
                onChange={e => setCustomModelId(e.target.value)}
                style={{ flex: 1 }}
                required
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
              <select
                className="input-field"
                value={customRoutingTier}
                onChange={e => setCustomRoutingTier(e.target.value)}
                style={{ width: '130px' }}
                title="Routing tier"
              >
                <option value="standard">Standaard</option>
                <option value="light">Snel (Light)</option>
                <option value="heavy">Denken (Heavy)</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={addingCustom || !customModelId.trim()} style={{ width: 'auto' }}>
                {addingCustom ? 'Bezig...' : '+ Toevoegen'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Installed Models Table */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Geïnstalleerde Modellen & API's</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Overzicht van actieve modellen in de dropdown van docenten en leerlingen.
            </p>
          </div>
          <span className="badge badge-primary">{models.length} modellen</span>
        </div>

        {models.length === 0 ? (
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Nog geen modellen toegevoegd.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Model / Provider</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Weergavenaam</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tier</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Credits (normaal / denken)</th>
                  <th style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => {
                  const isApi = m.provider !== 'ollama';
                  const providerColor = m.provider === 'openrouter' 
                    ? '#a855f7' 
                    : m.provider === 'openai' 
                    ? '#10b981' 
                    : m.provider === 'anthropic' 
                    ? '#f97316' 
                    : '#38bdf8';

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: m.isActive ? 1 : 0.45 }}>
                      <td style={{ padding: '0.75rem', width: '130px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(m)}
                            className={`btn ${m.isActive ? 'btn-success' : ''}`}
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              width: 'auto',
                              background: m.isActive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: m.isActive ? '#34d399' : 'var(--text-secondary)',
                              border: `1px solid ${m.isActive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                            }}
                            title={m.isActive ? 'Klik om te deactiveren' : 'Klik om te activeren'}
                          >
                            {m.isActive ? '● Actief' : '○ Inactief'}
                          </button>
                          <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', opacity: m.isActive ? 1 : 0.5, color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox" 
                              checked={m.isCodeMatchOnly || false} 
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                setModels(prev => prev.map(model => model.id === m.id ? { ...model, isCodeMatchOnly: checked } : model));
                                await fetch(`/api/models/${m.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ isCodeMatchOnly: checked })
                                });
                              }}
                              disabled={!m.isActive}
                            />
                            CodeMatch only
                          </label>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <code style={{ fontSize: '0.85rem', color: '#fff' }}>{m.ollamaName}</code>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            color: providerColor, 
                            marginTop: '0.2rem', 
                            textTransform: 'uppercase', 
                            fontWeight: 700,
                            letterSpacing: '0.05em' 
                          }}>
                            {isApi ? `☁️ ${m.provider}` : `💻 lokaal (${m.provider})`}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          style={{ padding: '0.35rem 0.5rem', width: '100%', maxWidth: '220px' }}
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
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            className="input-field" 
                            style={{ width: '55px', padding: '0.35rem' }} 
                            value={m.creditCost} 
                            title="Normale kosten (credits)"
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
                            style={{ width: '55px', padding: '0.35rem' }} 
                            value={m.thinkingCreditCost} 
                            title="Kosten met Deep Thinking (credits)"
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
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          className="btn" 
                          style={{ padding: '0.35rem 0.75rem', background: 'rgba(248, 113, 113, 0.1)', color: 'var(--danger)', fontSize: '0.85rem' }}
                          onClick={() => handleDelete(m.id)}
                        >
                          Verwijder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
