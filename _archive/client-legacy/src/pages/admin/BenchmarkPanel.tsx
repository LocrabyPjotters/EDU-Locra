import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface HardwareProfile {
  os: string;
  arch: string;
  cpuModel: string;
  physicalCores: number;
  logicalCores: number;
  totalRamGb: number;
  freeRamGb: number;
  usedRamGb: number;
  isAppleSilicon: boolean;
  estimatedMemoryBandwidthGbps: number;
  gpuInfo: string;
  ollamaAvailable: boolean;
  installedModels: string[];
}

interface BenchmarkReport {
  timestamp: string;
  hardware: HardwareProfile;
  testedTiers: any[];
  scenarios: any[];
  advice: {
    recommendedMaxConcurrency: number;
    recommendedQueueTimeoutSec: number;
    maxActiveStudentsComfortable: number;
    maxActiveStudentsPeak: number;
    recommendedModelTier: string;
    optimalModelName: string;
    bottleneckAnalysis: string;
    actionItems: string[];
  };
}

export default function BenchmarkPanel() {
  const token = useAuthStore(state => state.token);
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tiers' | 'scenarios' | 'livetest'>('tiers');
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);
  
  // Live Test State
  const [liveTesting, setLiveTesting] = useState(false);
  const [liveTestResults, setLiveTestResults] = useState<any | null>(null);
  const [liveConcurrency, setLiveConcurrency] = useState(4);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [preset, setPreset] = useState<'quick' | 'group' | 'exam' | 'stress' | 'custom'>('group');
  const [testPrompt, setTestPrompt] = useState('Leg in 2 korte zinnen de stelling van Pythagoras uit.');
  const [numTokens, setNumTokens] = useState(80);
  const [liveTimer, setLiveTimer] = useState(0);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [token]);

  // Timer effect during live test
  useEffect(() => {
    let interval: any = null;
    if (liveTesting) {
      setLiveTimer(0);
      interval = setInterval(() => {
        setLiveTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveTesting]);

  const fetchReport = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('/api/admin/benchmark/report', {
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}` 
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReport(data.report);
        if (!selectedModel && data.report.hardware.installedModels.length > 0) {
          const defaultModel = data.report.hardware.installedModels.find((m: string) => !m.includes('embed')) || data.report.hardware.installedModels[0];
          setSelectedModel(defaultModel);
        }
      } else {
        setFetchError(data.error || `Server antwoordde met status ${res.status}`);
      }
    } catch (e: any) {
      console.error('Failed to load benchmark report', e);
      setFetchError(e.message || 'Kon geen verbinding maken met de server.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCap = async (cap: number, queueTimeout: number = 45) => {
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('/api/admin/benchmark/apply-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          maxConcurrency: cap,
          queueTimeoutSec: queueTimeout
        })
      });
      const data = await res.json();
      if (data.success) {
        setAppliedMsg(data.message);
        setTimeout(() => setAppliedMsg(null), 5000);
      }
    } catch (e) {
      alert('Fout bij toepassen van instellingen');
    }
  };

  const selectPreset = (newPreset: 'quick' | 'group' | 'exam' | 'stress' | 'custom') => {
    setPreset(newPreset);
    if (newPreset === 'quick') {
      setLiveConcurrency(1);
      setNumTokens(50);
      setTestPrompt('Wat is 2 + 2? Geef enkel het antwoord.');
    } else if (newPreset === 'group') {
      setLiveConcurrency(4);
      setNumTokens(80);
      setTestPrompt('Leg in 2 korte zinnen de stelling van Pythagoras uit.');
    } else if (newPreset === 'exam') {
      setLiveConcurrency(8);
      setNumTokens(80);
      setTestPrompt('Noem 3 belangrijke gebeurtenissen uit de Gouden Eeuw.');
    } else if (newPreset === 'stress') {
      setLiveConcurrency(12);
      setNumTokens(100);
      setTestPrompt('Leg uit hoe fotosynthese werkt in plantencellen.');
    }
  };

  const runLiveTest = async () => {
    setLiveTesting(true);
    setLiveTestResults(null);
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch('/api/admin/benchmark/test-live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          concurrency: liveConcurrency,
          prompt: testPrompt,
          model: selectedModel || undefined,
          numPredict: numTokens
        })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        await res.text();
        throw new Error(`Serverfout (${res.status}): Proxy Timeout of ongeldige response. Mogelijke overbelasting.`);
      }

      const data = await res.json();
      if (data.success) {
        setLiveTestResults(data);
      } else {
        alert(data.error || 'Live test mislukt');
      }
    } catch (e: any) {
      alert('Netwerkfout bij live test: ' + e.message);
    } finally {
      setLiveTesting(false);
    }
  };

  const copyTestSummary = () => {
    if (!liveTestResults || !report) return;
    const summary = `=== LOCRA AI BENCHMARK TEST RAPPORT ===
Datum: ${new Date().toLocaleString('nl-NL')}
Server: ${report.hardware.cpuModel} (${report.hardware.logicalCores} Cores, ${report.hardware.totalRamGb} GB RAM)
Model Getest: ${liveTestResults.modelUsed}
Gelijktijdige Streams: ${liveTestResults.concurrencyTested}
Prompt: "${testPrompt}"

RESULTATEN:
- Totale Doorlooptijd: ${(liveTestResults.totalElapsedMs / 1000).toFixed(2)}s
- Gemiddelde Responstijd per Vraag: ${(liveTestResults.avgDurationMs / 1000).toFixed(2)}s
- Totale Systeem Doorvoer: ${liveTestResults.aggregateTokensPerSecond} tokens/sec
- Fouten / Timeouts: ${liveTestResults.timedOut || 0} timeouts, ${liveTestResults.errors || 0} fouten
- Beoordeling: ${liveTestResults.verdict?.rating?.toUpperCase() || 'ONBEKEND'}
- Advies: ${liveTestResults.verdict?.ratingText || ''}
- Aanbevolen Concurrency Cap: Max ${liveTestResults.verdict?.recommendedLiveCap || liveConcurrency} streams parallel
========================================`;

    navigator.clipboard.writeText(summary);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⚡</div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Hardware benchmark berekenen...</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Host CPU cores, geheugenbandbreedte en lokale Ollama modellen worden geanalyseerd.
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }} className="glass-panel">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ marginBottom: '0.75rem' }}>Kon benchmark rapport niet laden</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {fetchError || 'Controleer of de server actief is en of je bent ingelogd als beheerder.'}
        </p>
        <button onClick={fetchReport} className="btn btn-primary">
          🔄 Opnieuw Proberen
        </button>
      </div>
    );
  }

  const { hardware: hw, advice, testedTiers, scenarios } = report;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>⚡</span> Hardware & Concurrency Benchmark
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Berekent hoeveel gelijktijdige leerlingvragen jouw server aankan en bewaakt de actieve streaming wachtrij.
          </p>
        </div>
        <button onClick={fetchReport} className="btn" style={{ background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔄</span>
          <span>Opnieuw Scannen</span>
        </button>
      </div>

      {appliedMsg && (
        <div style={{ padding: '1rem 1.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          <span style={{ fontWeight: 600 }}>{appliedMsg}</span>
        </div>
      )}

      {/* Hardware Specs HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processor</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>{hw.cpuModel}</div>
          <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginTop: '0.2rem' }}>{hw.logicalCores} Cores ({hw.physicalCores} Fysiek)</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Werkgeheugen</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>{hw.totalRamGb} GB RAM</div>
          <div style={{ fontSize: '0.8rem', color: '#c4b5fd', marginTop: '0.2rem' }}>{hw.isAppleSilicon ? 'Unified Memory Architecture' : 'Standaard RAM'}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Geheugenbandbreedte</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>~{hw.estimatedMemoryBandwidthGbps} GB/s</div>
          <div style={{ fontSize: '0.8rem', color: '#67e8f9', marginTop: '0.2rem' }}>{hw.gpuInfo}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${hw.ollamaAvailable ? '#10b981' : '#ef4444'}` }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ollama Engine</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: hw.ollamaAvailable ? '#10b981' : '#ef4444', marginTop: '0.25rem' }}>
            {hw.ollamaAvailable ? 'Actief & Verbonden' : 'Niet Gevonden'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {hw.installedModels.length} modellen lokaal
          </div>
        </div>
      </div>

      {/* Actionable Advice Card (Primary Focus) */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(30, 41, 68, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase' }}>
              🎯 Theoretisch Capaciteitsadvies
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
              Aanbevolen Limiet: Maximaal <span style={{ color: '#3b82f6' }}>{advice.recommendedMaxConcurrency} gelijktijdige streams</span>
            </h2>
          </div>
          <button 
            onClick={() => handleApplyCap(advice.recommendedMaxConcurrency, advice.recommendedQueueTimeoutSec)}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>✓</span>
            <span>Pas Aanbevolen Limiet Direct Toe</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Actieve Leerlingen (Comfortabel)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
              Tot {advice.maxActiveStudentsComfortable} leerlingen
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Zonder enige merkbare vertraging in de les</div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Piekcapaciteit (Klassikale Vraagbui)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
              Tot {advice.maxActiveStudentsPeak} leerlingen
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Met actieve FIFO wachtrij</div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Aanbevolen Model</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
              {advice.optimalModelName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>Ideaal evenwicht didactiek & snelheid</div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Wachtrij Timeout</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {advice.recommendedQueueTimeoutSec} sec
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Voorkomt verbroken verbindingen</div>
          </div>
        </div>

        {/* Action items */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#e2e8f0' }}>Concrete Aanbevelingen:</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-secondary)', padding: 0 }}>
            {advice.actionItems.map((item, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('tiers')} 
          style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'tiers' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'tiers' ? '#fff' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
        >
          📊 Model Tiers Vergelijking
        </button>

        <button 
          onClick={() => setActiveTab('scenarios')} 
          style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'scenarios' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'scenarios' ? '#fff' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
        >
          🏫 Veelvoorkomende Praktijk Scenario's
        </button>

        <button 
          onClick={() => setActiveTab('livetest')} 
          style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'livetest' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'livetest' ? '#fff' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>⚡ Live Concurrency Stress Test</span>
          <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px' }}>PRO</span>
        </button>
      </div>

      {/* TAB 1: MODEL TIERS */}
      {activeTab === 'tiers' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {testedTiers.map((tItem: any, idx: number) => {
              const tier = tItem.tier;
              const isRecommended = tier.name === advice.recommendedModelTier;
              return (
                <div key={idx} className="glass-panel" style={{ padding: '1.5rem', border: isRecommended ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                  {isRecommended && (
                    <div style={{ position: 'absolute', top: '-10px', right: '15px', background: '#3b82f6', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                      AANBEVOLEN
                    </div>
                  )}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>{tier.label}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.75rem' }}>{tier.paramRange}</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{tier.description}</p>
                  
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <div>💾 Model RAM: <strong>{tier.weightRamGb} GB</strong></div>
                    <div>⚡ Enkele stream: <strong>~{tier.singleStreamTokPerSec} tok/s</strong></div>
                    <div>👥 Max veilige streams: <strong style={{ color: '#10b981' }}>{tItem.maxSafeConcurrency} gelijktijdig</strong></div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Voorbeelden: {tier.exampleModels.join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Concurrency Degradation Table for Medium Tier */}
          <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
              📈 Prestatiecurve bij Toenemende Concurrency (Gemiddeld 7B - 9B Model)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Dit toont hoe responstijden en tokens per seconde schalen naarmate meer leerlingen exact tegelijk een vraag stellen.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Gelijktijdige Streams</th>
                  <th style={{ padding: '0.75rem' }}>Snelheid p.p.</th>
                  <th style={{ padding: '0.75rem' }}>Totaal Systeem</th>
                  <th style={{ padding: '0.75rem' }}>TTFT (Start vertraging)</th>
                  <th style={{ padding: '0.75rem' }}>Responstijd (200t)</th>
                  <th style={{ padding: '0.75rem' }}>RAM Verbruik</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(testedTiers.find(t => t.tier.name === 'medium')?.concurrencyCurve || [])
                  .filter((s: any) => [1, 2, 4, 8, 16, 24, 32].includes(s.concurrency))
                  .map((step: any, i: number) => {
                    const statusColors: any = {
                      optimal: '#10b981',
                      acceptable: '#3b82f6',
                      degraded: '#f59e0b',
                      overloaded: '#ef4444'
                    };
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{step.concurrency} leerlingen</td>
                        <td style={{ padding: '0.75rem' }}>{step.tokensPerSecPerStream} tok/s</td>
                        <td style={{ padding: '0.75rem', color: '#93c5fd' }}>{step.aggregateTokensPerSec} tok/s</td>
                        <td style={{ padding: '0.75rem' }}>{step.timeToFirstTokenMs} ms</td>
                        <td style={{ padding: '0.75rem' }}>{step.totalDurationSec} s</td>
                        <td style={{ padding: '0.75rem' }}>{step.totalRamUsedGb} GB</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ 
                            background: `${statusColors[step.status]}20`, 
                            color: statusColors[step.status], 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700 
                          }}>
                            {step.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SCENARIOS */}
      {activeTab === 'scenarios' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {scenarios.map((sc: any, idx: number) => (
            <div key={idx} className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{sc.title}</h3>
                <span style={{ 
                  background: sc.verdict === 'uitstekend' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                  color: sc.verdict === 'uitstekend' ? '#10b981' : '#93c5fd',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {sc.verdict}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                {sc.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div>Betrokken leerlingen: <strong>{sc.studentCount}</strong></div>
                <div>Piek RAM: <strong>{sc.peakRamUsedGb} GB</strong></div>
                <div>Gem. Responstijd: <strong>{sc.avgResponseTimeSec} s</strong></div>
                <div>Max Wachttijd: <strong>{sc.maxWaitTimeSec} s</strong></div>
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#93c5fd' }}>
                💡 Geadviseerde Concurrency Cap voor dit scenario: <strong>{sc.recommendedConcurrencyCap} gelijktijdig</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: LIVE STRESS TEST (ULTRA-POLISHED) */}
      {activeTab === 'livetest' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> Echte Live Concurrency Stress Test
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Stuurt echte parallelle prompts naar Ollama en meet de exacte hardware-latentie, tokens/sec en wachtrij-gedrag.
              </p>
            </div>

            {/* Model Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={liveTesting}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {hw.installedModels.map((m: string) => (
                  <option key={m} value={m} style={{ background: '#1e293b', color: '#fff' }}>
                    {m} {m.includes('9b') ? '(9B Medium)' : m.includes('3b') || m.includes('4b') || m.includes('latest') ? '(4B Licht)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test Presets */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Kies een Testprofiel:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => selectPreset('quick')}
                disabled={liveTesting}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: preset === 'quick' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                  background: preset === 'quick' ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>⚡ Snelle Ping</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>1 Stream • 50 tokens</div>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('group')}
                disabled={liveTesting}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: preset === 'group' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                  background: preset === 'group' ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>👥 Groepswerk</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>4 Streams • 80 tokens</div>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('exam')}
                disabled={liveTesting}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: preset === 'exam' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                  background: preset === 'exam' ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>🏫 Klassikaal Piek</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>8 Streams • 80 tokens</div>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('stress')}
                disabled={liveTesting}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: preset === 'stress' ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                  background: preset === 'stress' ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f87171' }}>🔥 Stress Test</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>12 Streams • 100 tokens</div>
              </button>

              <button
                type="button"
                onClick={() => setPreset('custom')}
                disabled={liveTesting}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: preset === 'custom' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)',
                  background: preset === 'custom' ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>⚙️ Aangepast</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Zelf streams & prompt kiezen</div>
              </button>
            </div>
          </div>

          {/* Custom Settings Drawer if preset === 'custom' */}
          {preset === 'custom' && (
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                    Aantal Gelijktijdige Streams: <strong style={{ color: '#3b82f6' }}>{liveConcurrency}</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={liveConcurrency}
                    onChange={(e) => setLiveConcurrency(parseInt(e.target.value, 10))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>1 stream</span>
                    <span>8 streams</span>
                    <span>16 streams</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                    Max Tokens per Vraag: <strong style={{ color: '#8b5cf6' }}>{numTokens}</strong>
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="200"
                    step="10"
                    value={numTokens}
                    onChange={(e) => setNumTokens(parseInt(e.target.value, 10))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>30 (Kort)</span>
                    <span>80 (Standaard)</span>
                    <span>200 (Lang)</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Testprompt:
                </label>
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick prompt preview if not custom */}
          {preset !== 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Prompt:</span>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontStyle: 'italic' }}>"{testPrompt}"</span>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={runLiveTest}
                disabled={liveTesting || !hw.ollamaAvailable}
                className="btn btn-primary"
                style={{ 
                  padding: '0.8rem 1.75rem', 
                  fontWeight: 700, 
                  fontSize: '0.95rem',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem',
                  boxShadow: liveTesting ? '0 0 20px rgba(59,130,246,0.6)' : 'none'
                }}
              >
                {liveTesting ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                    <span>Test Actief ({liveConcurrency} streams) • {liveTimer}s...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Start Test ({liveConcurrency} Parallel)</span>
                  </>
                )}
              </button>
            </div>

            {liveTesting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#93c5fd', fontSize: '0.85rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                <span>Ollama verwerkt {liveConcurrency} parallelle requests in VRAM...</span>
              </div>
            )}
          </div>

          {!hw.ollamaAvailable && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '8px' }}>
              Ollama is niet lokaal actief op poort 11434. Start de Ollama app op deze machine om live tests uit te voeren.
            </div>
          )}

          {/* RESULTS DISPLAY */}
          {liveTestResults && (
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
              
              {/* Verdict Header Card */}
              {liveTestResults.verdict && (
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '12px',
                  background: liveTestResults.verdict.rating === 'uitstekend' ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(15,23,42,0.9) 100%)' :
                              liveTestResults.verdict.rating === 'goed' ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(15,23,42,0.9) 100%)' :
                              liveTestResults.verdict.rating === 'matig' ? 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(15,23,42,0.9) 100%)' :
                              'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(15,23,42,0.9) 100%)',
                  border: `1px solid ${
                    liveTestResults.verdict.rating === 'uitstekend' ? 'rgba(16,185,129,0.4)' :
                    liveTestResults.verdict.rating === 'goed' ? 'rgba(59,130,246,0.4)' :
                    liveTestResults.verdict.rating === 'matig' ? 'rgba(245,158,11,0.4)' :
                    'rgba(239,68,68,0.4)'
                  }`,
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <span style={{ 
                      textTransform: 'uppercase', 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '3px 10px', 
                      borderRadius: '12px',
                      background: liveTestResults.verdict.rating === 'uitstekend' ? '#10b981' :
                                  liveTestResults.verdict.rating === 'goed' ? '#3b82f6' :
                                  liveTestResults.verdict.rating === 'matig' ? '#f59e0b' : '#ef4444',
                      color: '#fff'
                    }}>
                      OORDEEL: {liveTestResults.verdict.rating}
                    </span>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', color: '#fff' }}>
                      {liveTestResults.verdict.ratingText}
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Getest met <strong>{liveTestResults.concurrencyTested} streams</strong> op <strong>{liveTestResults.modelUsed}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={copyTestSummary}
                      className="btn"
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                    >
                      {copiedReport ? '✓ Gekopieerd!' : '📋 Kopieer Rapport'}
                    </button>
                    <button
                      onClick={() => handleApplyCap(liveTestResults.verdict.recommendedLiveCap)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      ✓ Pas Cap ({liveTestResults.verdict.recommendedLiveCap}) Toe
                    </button>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Totale Doorlooptijd</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
                    {(liveTestResults.totalElapsedMs / 1000).toFixed(2)} s
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tijd tot alle streams klaar waren</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gem. Responstijd</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                    {(liveTestResults.avgDurationMs / 1000).toFixed(2)} s
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gemiddelde wachttijd per vraag</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Systeembrede Doorvoer</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#93c5fd', marginTop: '0.2rem' }}>
                    {liveTestResults.aggregateTokensPerSecond} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>tok/s</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gezamenlijke generatiesnelheid</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Betrouwbaarheid</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: liveTestResults.timedOut === 0 ? '#10b981' : '#ef4444', marginTop: '0.2rem' }}>
                    {liveTestResults.timedOut === 0 ? '100% Succes' : `${liveTestResults.timedOut} Timeouts`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {liveTestResults.streams?.length || 0} van {liveTestResults.concurrencyTested} streams gereed
                  </div>
                </div>
              </div>

              {/* Individual Streams Matrix */}
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                Per-Stream Detailresultaten
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {(liveTestResults.streams || []).map((stream: any) => {
                  const isSuccess = stream.status === 'success';
                  const isTimeout = stream.status === 'timeout';
                  return (
                    <div 
                      key={stream.index} 
                      style={{ 
                        background: 'rgba(0,0,0,0.25)', 
                        padding: '1rem', 
                        borderRadius: '10px',
                        border: isSuccess ? '1px solid rgba(16,185,129,0.25)' : isTimeout ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(245,158,11,0.4)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Stream #{stream.index}</span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          padding: '2px 8px', 
                          borderRadius: '8px',
                          background: isSuccess ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                          color: isSuccess ? '#10b981' : '#ef4444'
                        }}>
                          {stream.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        <span>Duur: <strong style={{ color: '#fff' }}>{(stream.durationMs / 1000).toFixed(2)}s</strong></span>
                        <span>Snelheid: <strong style={{ color: '#93c5fd' }}>{stream.tokensPerSec} tok/s</strong></span>
                        <span>Tokens: <strong style={{ color: '#fff' }}>{stream.evalCount}</strong></span>
                      </div>

                      {stream.preview && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', fontStyle: 'italic', marginTop: '0.5rem' }}>
                          "{stream.preview}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}

