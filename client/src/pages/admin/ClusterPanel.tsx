import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/ToastProvider';

interface ClusterNodeItem {
  id: string;
  name: string;
  url: string;
  engine: string;
  roles: string[];
  maxStreams: number;
  priority: number;
  isActive: boolean;
  isSpilloverNode: boolean;
  vramGb?: number;
  speculativeDraftNodeId?: string | null;
  speculativeDraftModel?: string | null;
  activeStreams?: number;
  lastPingMs?: number;
  isHealthy?: boolean;
  availableModels?: string[];
  vramUsedMb?: number;
  vramTotalMb?: number;
  vramPercentage?: number;
  oomRiskLevel?: 'safe' | 'warning' | 'critical';
}

interface ScheduleRuleItem {
  id: string;
  name: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  enableSpillover: boolean;
  isActive: boolean;
}

const ROLE_DEFINITIONS: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  chat_fast: { label: 'Snel 7B Chat', emoji: '⚡', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)' },
  thinking_heavy: { label: '32B/70B Thinking', emoji: '🧠', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)' },
  image_gen: { label: 'Afbeeldingen', emoji: '🎨', color: '#f472b6', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)' },
  embeddings: { label: 'RAG Embeddings', emoji: '📐', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
  general: { label: 'Universeel', emoji: '🌐', color: '#fcd34d', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' }
};

export default function ClusterPanel() {
  const token = useAuthStore(state => state.token);
  const { addToast } = useToast();

  const [nodes, setNodes] = useState<ClusterNodeItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRuleItem[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<any>(null);
  const [clusterStats, setClusterStats] = useState({ totalCacheHits: 0, totalOomOffloads: 0, activePrefixesCount: 0 });
  const [loading, setLoading] = useState(true);

  // Benchmark state
  const [benchmarkingId, setBenchmarkingId] = useState<string | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<any | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'nodes' | 'schedules'>('nodes');

  // Node modal
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ClusterNodeItem | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    url: 'http://127.0.0.1:11434',
    engine: 'ollama',
    roles: ['chat_fast'],
    maxStreams: 8,
    priority: 1,
    isSpilloverNode: false,
    vramGb: 48,
    speculativeDraftNodeId: '',
    speculativeDraftModel: ''
  });

  // Schedule modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRuleItem | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: 'Middag Spitsuur',
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '11:30',
    endTime: '13:30',
    enableSpillover: true
  });

  // Blueprint / Docker template modal
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false);
  const [blueprintData, setBlueprintData] = useState<{ dockerCompose: string; instructions: string } | null>(null);
  const [blueprintType, setBlueprintType] = useState<'4x_gpu' | '2x_gpu'>('4x_gpu');

  // Ping state
  const [pingingId, setPingingId] = useState<string | null>(null);

  const fetchClusterData = async () => {
    try {
      const [nodesRes, schedRes] = await Promise.all([
        fetch('/api/cluster/nodes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/cluster/schedules', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.nodes || []);
        setActiveSchedule(data.activeSchedule || null);
        if (data.clusterStats) setClusterStats(data.clusterStats);
      }

      if (schedRes.ok) {
        setSchedules(await schedRes.json());
      }
    } catch (e: any) {
      console.error(e);
      addToast('Fout bij ophalen cluster data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchClusterData();
    // Auto-refresh metrics every 15s
    const timer = setInterval(() => {
      if (token) fetchClusterData();
    }, 15000);
    return () => clearInterval(timer);
  }, [token]);

  const handlePingNode = async (nodeId: string) => {
    setPingingId(nodeId);
    try {
      const res = await fetch(`/api/cluster/nodes/${nodeId}/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.healthy) {
        addToast(`✅ Verbinding succesvol! (${data.latencyMs}ms) • ${data.models?.length || 0} modellen gedetecteerd`, 'success');
        setNodes(prev => prev.map(n => n.id === nodeId ? {
          ...n,
          isHealthy: true,
          lastPingMs: data.latencyMs,
          availableModels: data.models
        } : n));
      } else {
        addToast(`⚠️ Node onbereikbaar: ${data.error || 'Timeout'}`, 'error');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isHealthy: false } : n));
      }
    } catch (err: any) {
      addToast('Fout bij pingen van worker', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleRunBenchmark = async (nodeId: string, nodeName: string) => {
    setBenchmarkingId(nodeId);
    try {
      addToast(`⚡ Benchmark gestart op ${nodeName}... Even geduld a.u.b.`, 'info');
      const res = await fetch(`/api/cluster/nodes/${nodeId}/benchmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ model: 'llama3.2:3b' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benchmark mislukt');

      setBenchmarkResult({
        ...data,
        nodeName
      });
      addToast(`🏁 Benchmark voltooid: ${data.tokensPerSecond} tokens/sec!`, 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBenchmarkingId(null);
    }
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingNode ? `/api/cluster/nodes/${editingNode.id}` : '/api/cluster/nodes';
      const method = editingNode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(nodeForm)
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Opslaan mislukt');

      addToast(editingNode ? 'GPU Worker bijgewerkt' : 'GPU Worker geregistreerd', 'success');
      setNodeModalOpen(false);
      setEditingNode(null);
      fetchClusterData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteNode = async (nodeId: string, name: string) => {
    if (!confirm(`Weet je zeker dat je worker "${name}" wilt verwijderen uit het cluster?`)) return;
    try {
      const res = await fetch(`/api/cluster/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Worker verwijderd', 'info');
        fetchClusterData();
      }
    } catch (err: any) {
      addToast('Kon worker niet verwijderen', 'error');
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingSchedule ? `/api/cluster/schedules/${editingSchedule.id}` : '/api/cluster/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(scheduleForm)
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Opslaan mislukt');

      addToast('Piekurenschema opgeslagen', 'success');
      setScheduleModalOpen(false);
      setEditingSchedule(null);
      fetchClusterData();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteSchedule = async (ruleId: string) => {
    if (!confirm('Weet je zeker dat je deze spitsuurregel wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/cluster/schedules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Regel verwijderd', 'info');
        fetchClusterData();
      }
    } catch {
      addToast('Fout bij verwijderen', 'error');
    }
  };

  const openBlueprintModal = async () => {
    try {
      const res = await fetch(`/api/cluster/template?type=${blueprintType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBlueprintData(await res.json());
        setBlueprintModalOpen(true);
      }
    } catch {
      addToast('Kon blueprint niet laden', 'error');
    }
  };

  const applyPreset = (preset: '4x' | '2x' | '1x') => {
    if (preset === '4x') {
      setNodeForm({
        name: 'GPU 0 - RTX 6000 Ada (Pool A Snel 7B)',
        url: 'http://127.0.0.1:11434',
        engine: 'ollama',
        roles: ['chat_fast', 'embeddings'],
        maxStreams: 12,
        priority: 2,
        isSpilloverNode: false,
        vramGb: 48,
        speculativeDraftNodeId: '',
        speculativeDraftModel: ''
      });
    } else if (preset === '2x') {
      setNodeForm({
        name: 'GPU 0 - Primaire Chat GPU',
        url: 'http://127.0.0.1:11434',
        engine: 'ollama',
        roles: ['chat_fast'],
        maxStreams: 8,
        priority: 1,
        isSpilloverNode: false,
        vramGb: 48,
        speculativeDraftNodeId: '',
        speculativeDraftModel: ''
      });
    } else {
      setNodeForm({
        name: 'GPU 0 - Universele Server',
        url: 'http://127.0.0.1:11434',
        engine: 'ollama',
        roles: ['general'],
        maxStreams: 10,
        priority: 1,
        isSpilloverNode: false,
        vramGb: 48,
        speculativeDraftNodeId: '',
        speculativeDraftModel: ''
      });
    }
  };

  const totalMaxStreams = nodes.reduce((acc, curr) => acc + curr.maxStreams, 0);
  const totalActiveStreams = nodes.reduce((acc, curr) => acc + (curr.activeStreams || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#f8fafc' }}>
              🖥️ GPU & Node Cluster Orchestrator
            </h2>
            {activeSchedule ? (
              <span style={{
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2))',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                color: '#fde047',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                ⚡ Spitsuur Actief: {activeSchedule.name} ({activeSchedule.startTime} - {activeSchedule.endTime})
              </span>
            ) : (
              <span style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#6ee7b7',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                🟢 Normale Cluster Modus
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
            Beheer lokale GPU-workers, verdeel 7B/Image/32B workloads en configureer dynamische spitsuurregels.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={openBlueprintModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0',
              padding: '10px 16px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            📋 Docker Blueprint Generator
          </button>

          <button
            onClick={() => {
              setEditingNode(null);
              setNodeForm({
                name: `GPU ${nodes.length} - Worker`,
                url: `http://127.0.0.1:${11434 + nodes.length}`,
                engine: 'ollama',
                roles: ['chat_fast'],
                maxStreams: 8,
                priority: 1,
                isSpilloverNode: false,
                vramGb: 48,
                speculativeDraftNodeId: '',
                speculativeDraftModel: ''
              });
              setNodeModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--primary)',
              border: 'none',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.875rem',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
            }}
          >
            + GPU / Node Toevoegen
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#6366f1', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🖥️</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{nodes.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Geregistreerde GPU's / Nodes</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#10b981', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>⚡</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6ee7b7', lineHeight: 1 }}>{totalActiveStreams} / {totalMaxStreams || '∞'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Actieve Gelijktijdige Streams</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#ec4899', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🕒</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f472b6', lineHeight: 1 }}>{schedules.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Piekuren & Spitsuurregels</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#f59e0b', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🔄</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fcd34d', lineHeight: 1 }}>{nodes.filter(n => n.isSpilloverNode).length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>Spillover Standby Workers</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#38bdf8', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>⚡</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>{clusterStats.totalCacheHits}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>KVS Cache Hits (Prefixes)</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, background: '#10b981', filter: 'blur(35px)', opacity: 0.2 }} />
          <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🛡️</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>{clusterStats.totalOomOffloads}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>OOM Autoguard Saves</div>
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('nodes')}
          style={{
            background: activeTab === 'nodes' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: activeTab === 'nodes' ? '#c7d2fe' : 'var(--text-secondary)',
            border: activeTab === 'nodes' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          🖥️ GPU Workers & Nodes ({nodes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          style={{
            background: activeTab === 'schedules' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
            color: activeTab === 'schedules' ? '#fbcfe8' : 'var(--text-secondary)',
            border: activeTab === 'schedules' ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          🕒 Spitsuur & Piekuren Planner ({schedules.length})
        </button>
      </div>

      {/* ── TAB 1: GPU Workers & Nodes ───────────────────────────────────── */}
      {activeTab === 'nodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              ⏳ Nodes laden...
            </div>
          ) : nodes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '20px',
              border: '1px dashed rgba(255,255,255,0.08)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🖥️</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc' }}>Nog geen GPU workers geconfigureerd</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
                Voeg je lokale GPU-instanties (bijv. GPU 0 t/m 3 op poorten 11434 t/m 11437) toe om de werklast optimaal te verdelen.
              </p>
              <button
                onClick={() => {
                  setEditingNode(null);
                  applyPreset('4x');
                  setNodeModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                ⚡ Snelle 4x GPU Setup Starten
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {nodes.map(node => {
                const loadPercent = Math.min(100, Math.round(((node.activeStreams || 0) / Math.max(1, node.maxStreams)) * 100));

                return (
                  <div
                    key={node.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.07)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      position: 'relative'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: node.isHealthy === false ? '#ef4444' : '#10b981',
                            display: 'inline-block',
                            boxShadow: `0 0 10px ${node.isHealthy === false ? '#ef4444' : '#10b981'}`
                          }} />
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                            {node.name}
                          </h4>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px', fontFamily: 'monospace' }}>
                          {node.url}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handlePingNode(node.id)}
                          disabled={pingingId === node.id}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8',
                            borderRadius: '8px',
                            padding: '5px 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Ping node"
                        >
                          {pingingId === node.id ? '⏳' : '📡 Ping'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunBenchmark(node.id, node.name)}
                          disabled={benchmarkingId === node.id}
                          style={{
                            background: 'rgba(234, 179, 8, 0.12)',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            color: '#fde047',
                            borderRadius: '8px',
                            padding: '5px 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                          title="Snelheidstest uitvoeren"
                        >
                          {benchmarkingId === node.id ? '⏳' : '⚡ Test'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNode(node);
                            setNodeForm({
                              name: node.name,
                              url: node.url,
                              engine: node.engine,
                              roles: node.roles,
                              maxStreams: node.maxStreams,
                              priority: node.priority,
                              isSpilloverNode: node.isSpilloverNode,
                              vramGb: node.vramGb || 48,
                              speculativeDraftNodeId: node.speculativeDraftNodeId || '',
                              speculativeDraftModel: node.speculativeDraftModel || ''
                            });
                            setNodeModalOpen(true);
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8',
                            borderRadius: '8px',
                            padding: '5px 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Bewerken"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNode(node.id, node.name)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            borderRadius: '8px',
                            padding: '5px 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Verwijderen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Roles Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {node.roles.map(r => {
                        const meta = ROLE_DEFINITIONS[r] || { label: r, emoji: '⚙️', color: '#cbd5e1', bg: 'rgba(255,255,255,0.1)', border: 'transparent' };
                        return (
                          <span
                            key={r}
                            style={{
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontWeight: 700,
                              background: meta.bg,
                              border: `1px solid ${meta.border}`,
                              color: meta.color
                            }}
                          >
                            {meta.emoji} {meta.label}
                          </span>
                        );
                      })}

                      {node.isSpilloverNode && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            background: 'rgba(234, 179, 8, 0.15)',
                            border: '1px solid rgba(234, 179, 8, 0.35)',
                            color: '#fde047'
                          }}
                          title="Springt automatisch bij tijdens spitsuur / piekbelasting"
                        >
                          🔄 Spitsuur Standby
                        </span>
                      )}

                      {node.speculativeDraftModel && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            background: 'rgba(168, 85, 247, 0.15)',
                            border: '1px solid rgba(168, 85, 247, 0.35)',
                            color: '#c084fc'
                          }}
                          title="Speculative Decoding Tandem actief"
                        >
                          ⚡ Tandem: {node.speculativeDraftModel}
                        </span>
                      )}
                    </div>

                    {/* Live Load Meter */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Actieve streams:</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                          {node.activeStreams || 0} / {node.maxStreams} max
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${loadPercent}%`,
                            background: loadPercent > 80 ? '#ef4444' : loadPercent > 50 ? '#f59e0b' : '#10b981',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                    </div>

                    {/* VRAM Gauge */}
                    {node.vramPercentage !== undefined && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>GPU VRAM Geheugen:</span>
                          <span style={{
                            fontWeight: 700,
                            color: node.oomRiskLevel === 'critical' ? '#ef4444' : node.oomRiskLevel === 'warning' ? '#f59e0b' : '#10b981'
                          }}>
                            {Math.round((node.vramUsedMb || 0) / 1024)} / {Math.round((node.vramTotalMb || 49152) / 1024)} GB ({node.vramPercentage}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${node.vramPercentage}%`,
                            background: node.oomRiskLevel === 'critical' ? '#ef4444' : node.oomRiskLevel === 'warning' ? '#f59e0b' : '#10b981',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        {node.oomRiskLevel === 'critical' && (
                          <div style={{ fontSize: '0.68rem', color: '#fca5a5', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>🔴</span> <strong>OOM Autoguard:</strong> Verkeer automatisch afgewend naar reserve GPU
                          </div>
                        )}
                        {node.oomRiskLevel === 'warning' && (
                          <div style={{ fontSize: '0.68rem', color: '#fcd34d', marginTop: '3px' }}>
                            ⚠️ VRAM Waarschuwing (&gt;85%) - OOM Guard standby
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Info */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      paddingTop: '0.5rem'
                    }}>
                      <span>Prioriteit: {node.priority}</span>
                      {node.lastPingMs ? (
                        <span style={{ color: '#10b981' }}>Latency: {node.lastPingMs}ms</span>
                      ) : (
                        <span>Nog niet gepingd</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Spitsuur & Piekuren Planner ───────────────────────────── */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>Piekuren & Spitsuur Regels</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Tijdens deze tijdvakken schaalt Locra snelle 7B chatvragen automatisch uit naar secundaire GPU's (spillover nodes).
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSchedule(null);
                setScheduleForm({
                  name: 'Middag Spitsuur',
                  daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
                  startTime: '11:30',
                  endTime: '13:30',
                  enableSpillover: true
                });
                setScheduleModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ width: 'auto' }}
            >
              + Piekregel Toevoegen
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedules.map(rule => (
              <div
                key={rule.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '1.5rem' }}>🕒</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {rule.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Tijdvak: <strong style={{ color: '#e2e8f0' }}>{rule.startTime} t/m {rule.endTime}</strong> • Dagen: {rule.daysOfWeek.map(d => d.toUpperCase()).join(', ')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {rule.enableSpillover && (
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      color: '#fde047',
                      fontWeight: 700
                    }}>
                      ⚡ Spillover Actief
                    </span>
                  )}

                  <button
                    onClick={() => handleDeleteSchedule(rule.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal 1: Node Toevoegen / Bewerken ───────────────────────────── */}
      {nodeModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setNodeModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                {editingNode ? 'GPU Worker Bewerken' : 'Nieuwe GPU Worker Toevoegen'}
              </h3>
              <button onClick={() => setNodeModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Quick Presets */}
            {!editingNode && (
              <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Snelle Presets</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => applyPreset('4x')} style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', cursor: 'pointer' }}>
                    4x GPU Setup
                  </button>
                  <button type="button" onClick={() => applyPreset('2x')} style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer' }}>
                    2x GPU Setup
                  </button>
                  <button type="button" onClick={() => applyPreset('1x')} style={{ flex: 1, padding: '6px', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer' }}>
                    1x Single GPU
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveNode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Worker Naam *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Bijv. GPU 0 - RTX 6000 Ada (Snel 7B)"
                  value={nodeForm.name}
                  onChange={e => setNodeForm({ ...nodeForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  URL & Poort *
                </label>
                <input
                  required
                  type="text"
                  placeholder="http://127.0.0.1:11434"
                  value={nodeForm.url}
                  onChange={e => setNodeForm({ ...nodeForm, url: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Engine
                  </label>
                  <select
                    value={nodeForm.engine}
                    onChange={e => setNodeForm({ ...nodeForm, engine: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem' }}
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai_compatible">vLLM / OpenAI API</option>
                    <option value="comfyui">ComfyUI / Diffusers</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Max Streams
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={nodeForm.maxStreams}
                    onChange={e => setNodeForm({ ...nodeForm, maxStreams: parseInt(e.target.value) || 8 })}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    VRAM (GB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={192}
                    value={nodeForm.vramGb}
                    onChange={e => setNodeForm({ ...nodeForm, vramGb: parseInt(e.target.value) || 48 })}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Roles selection */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Toegewezen Rollen
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {Object.entries(ROLE_DEFINITIONS).map(([key, meta]) => {
                    const isSelected = nodeForm.roles.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNodeForm({ ...nodeForm, roles: nodeForm.roles.filter(r => r !== key) });
                          } else {
                            setNodeForm({ ...nodeForm, roles: [...nodeForm.roles, key] });
                          }
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isSelected ? `1px solid ${meta.color}` : '1px solid rgba(255,255,255,0.1)',
                          background: isSelected ? meta.bg : 'rgba(255,255,255,0.03)',
                          color: isSelected ? meta.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spillover checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(234, 179, 8, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(234, 179, 8, 0.2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nodeForm.isSpilloverNode}
                  onChange={e => setNodeForm({ ...nodeForm, isSpilloverNode: e.target.checked })}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fde047' }}>Spitsuur Spillover Standby</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Laat deze GPU automatisch 7B prompts verwerken tijdens piekuren (bijv. 12:00)</div>
                </div>
              </label>

              {/* Speculative Decoding Tandem Pairing */}
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#c084fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚡</span>
                  <span>Speculative Decoding Tandem Pairing</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Koppel een snelle draft worker (bv. GPU 0 7B) aan deze zware target worker (bv. 70B) voor 2x snellere generatie.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Draft Model Naam</label>
                    <input
                      type="text"
                      placeholder="bijv. qwen2.5:7b of llama3.2:3b"
                      value={nodeForm.speculativeDraftModel || ''}
                      onChange={e => setNodeForm({ ...nodeForm, speculativeDraftModel: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Draft Node (Optioneel)</label>
                    <select
                      value={nodeForm.speculativeDraftNodeId || ''}
                      onChange={e => setNodeForm({ ...nodeForm, speculativeDraftNodeId: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem' }}
                    >
                      <option value="">Geen gekoppelde node</option>
                      {nodes.filter(n => n.id !== editingNode?.id).map(n => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setNodeModalOpen(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Annuleren
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
                  {editingNode ? 'Wijzigingen Opslaan' : 'Worker Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Spitsuurregel Toevoegen ────────────────────────────── */}
      {scheduleModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setScheduleModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(236, 72, 153, 0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc' }}>Spitsuur / Piekregel Toevoegen</h3>

            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Naam</label>
                <input
                  required
                  type="text"
                  value={scheduleForm.name}
                  onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Starttijd</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Eindtijd</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scheduleForm.enableSpillover}
                  onChange={e => setScheduleForm({ ...scheduleForm, enableSpillover: e.target.checked })}
                />
                <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Schakel standby GPU's in tijdens dit tijdvak</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setScheduleModalOpen(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Annuleren</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: Blueprint Generator ────────────────────────────────── */}
      {blueprintModalOpen && blueprintData && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
          onClick={() => setBlueprintModalOpen(false)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>📋 Docker Compose & Systemd Cluster Blueprint</h3>
              <button onClick={() => setBlueprintModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Gebruik onderstaand bestand om direct op de Linux server van de school (bijv. Ubuntu Server) alle GPU's als geïsoleerde containers op te starten met expliciete <code>CUDA_VISIBLE_DEVICES</code> toewijzingen.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a5b4fc' }}>docker-compose.yml</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(blueprintData.dockerCompose);
                  addToast('Docker Compose gekopieerd naar klembord!', 'success');
                }}
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer' }}
              >
                📋 Kopiëren
              </button>
            </div>

            <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', color: '#cbd5e1', overflowX: 'auto', maxHeight: '300px' }}>
              {blueprintData.dockerCompose}
            </pre>

            <div style={{ marginTop: '1rem', background: 'rgba(99, 102, 241, 0.08)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '6px' }}>Instructies</div>
              <pre style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {blueprintData.instructions}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: Benchmark Resultaat ─────────────────────────────────── */}
      {benchmarkResult && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
          onClick={() => setBenchmarkResult(null)}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(234, 179, 8, 0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fde047', fontSize: '1.2rem', fontWeight: 800 }}>⚡ Benchmark: {benchmarkResult.nodeName}</h3>
                {benchmarkResult.modelTested && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    Model: <code style={{ color: '#38bdf8' }}>{benchmarkResult.modelTested}</code>
                  </div>
                )}
              </div>
              <button onClick={() => setBenchmarkResult(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa' }}>{benchmarkResult.tokensPerSecond}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tokens / Seconde</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>{benchmarkResult.ttftMs}ms</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Time to First Token</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f472b6' }}>{benchmarkResult.maxConcurrentCapacityEst}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Max Gelijktijdige Studenten</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fcd34d' }}>{benchmarkResult.totalDurationMs}ms</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Totale Testduur</div>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', fontSize: '0.85rem', color: '#c7d2fe', fontWeight: 600, marginBottom: '1rem' }}>
              🏁 Verdict: {benchmarkResult.verdict}
            </div>

            <button
              onClick={() => setBenchmarkResult(null)}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

