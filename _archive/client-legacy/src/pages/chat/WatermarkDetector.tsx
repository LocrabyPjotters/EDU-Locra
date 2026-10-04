import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface WatermarkDetectorProps {
  onClose: () => void;
}

interface WatermarkAnalysisResult {
  hasWatermark: boolean;
  confidence: number;
  verdict?: 'ai-gegenereerd' | 'waarschijnlijk-ai' | 'verdacht' | 'geen-watermerk';
  verdictText?: string;
  wordCount?: number;
  sentenceCoverage?: {
    total: number;
    watermarked: number;
    percent: number;
  };
  paragraphCoverage?: {
    total: number;
    watermarked: number;
    percent: number;
  };
  detectedCodepoints?: {
    name: string;
    char: string;
    count: number;
  }[];
  techniquesDetected?: {
    id: string;
    name: string;
    description: string;
    active: boolean;
  }[];
  decodedPayload?: {
    schoolName?: string;
    orgId?: string;
    verified: boolean;
  } | null;
  visualRontgenHtml?: string;
}

export default function WatermarkDetector({ onClose }: WatermarkDetectorProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WatermarkAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [showRontgen, setShowRontgen] = useState(false);
  
  const token = useAuthStore(state => state.token);

  const handleVerify = async () => {
    if (!text.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setUpgradeRequired(false);
    
    try {
      const res = await fetch('/api/watermark/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 403 && data.error === 'Premium Licentie Vereist') {
          setUpgradeRequired(true);
          setError(data.message);
        } else {
          setError(data.error || 'Er is een fout opgetreden.');
        }
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError('Netwerkfout bij verificatie.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setUpgradeRequired(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/watermark/verify/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 403 && data.error === 'Premium Licentie Vereist') {
          setUpgradeRequired(true);
          setError(data.message);
        } else {
          setError(data.error || 'Er is een fout opgetreden bij het verwerken van het bestand.');
        }
      } else {
        setResult(data);
        setText(data.extractedText || 'Bestand geanalyseerd (tekst niet getoond ivm lengte)');
      }
    } catch (err: any) {
      setError('Netwerkfout bij verificatie van bestand.');
    } finally {
      setLoading(false);
      e.target.value = ''; // reset input
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="card" style={{ 
        width: '100%', 
        maxWidth: '680px', 
        maxHeight: '90vh', 
        overflowY: 'auto',
        background: 'var(--bg-card)', 
        position: 'relative',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem', borderRadius: '50%' }}
        >
          ✕
        </button>

        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
          <div style={{ fontSize: '1.75rem' }}>🕵️</div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              Locra EDU Plus Watermerk Detectie
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Detecteert steganografische handtekeningen, zelfs in korte citaten of losse zinnen
            </div>
          </div>
        </div>
        
        <div className="card-body" style={{ paddingTop: '1.25rem' }}>
          {upgradeRequired ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
              <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>EDU Plus Licentie Vereist</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                {error}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', opacity: 0.5 }}>
                  <h4>EDU Basic</h4>
                  <div style={{ fontSize: '1.25rem', margin: '0.5rem 0' }}>€50 / jaar</div>
                  <small style={{ color: 'var(--text-secondary)' }}>Basis AI functionaliteit</small>
                </div>
                <div style={{ padding: '1rem', border: '2px solid var(--primary)', borderRadius: '8px', background: 'rgba(59,130,246,0.1)' }}>
                  <h4>EDU Plus</h4>
                  <div style={{ fontSize: '1.25rem', margin: '0.5rem 0' }}>€100 / jaar</div>
                  <small style={{ color: 'var(--primary)' }}>Incl. Geavanceerde Watermerking</small>
                </div>
              </div>
              
              <button className="btn btn-primary" onClick={onClose}>Sluiten</button>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                Plak hier een werkstuk, alinea of zelfs een losse zin van een leerling.
              </p>

              {/* Quick test sample buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setText('De stelling van Pythagoras luidt a² + b² = c².\u200B\u200C\u2060 Hiermee bereken je de schuine zijde van een rechthoekige driehoek.\u200B\u200C\u2060')}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer' }}
                >
                  Voorbeeld: AI Fragment (2 Zinnen)
                </button>
                <button
                  type="button"
                  onClick={() => setText('De stelling van Pythagoras luidt a² + b² = c².\u200B\u200C\u2060')}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', cursor: 'pointer' }}
                >
                  Voorbeeld: Enkel Eerste Zin
                </button>
                <button
                  type="button"
                  onClick={() => setText('Gisteren heb ik samen met mijn vader een fietstocht gemaakt door het duinengebied.')}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Voorbeeld: Handgeschreven
                </button>
              </div>
              
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Plak hier de tekst van de leerling..."
                style={{
                  width: '100%',
                  height: '140px',
                  background: 'var(--bg-surface)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                  resize: 'vertical',
                  fontSize: '0.95rem',
                  lineHeight: 1.5
                }}
              />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Of upload een bestand (PDF of DOCX):</span>
                <input 
                  type="file" 
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileUpload}
                  disabled={loading}
                  style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}
                />
              </div>

              
              {!upgradeRequired && error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}
              
              {result && (
                <div style={{ 
                  background: result.hasWatermark ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${result.hasWatermark ? 'var(--success-color)' : 'rgba(255,255,255,0.1)'}`,
                  padding: '1.25rem', 
                  borderRadius: '12px', 
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '2rem' }}>
                      {result.hasWatermark ? '⚠️' : '✅'}
                    </div>
                    <div>
                      <h4 style={{ color: result.hasWatermark ? 'var(--success-color)' : 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>
                        {result.hasWatermark ? 'AI-Gegenereerd Tekstspoor Aangetroffen' : 'Geen Locra Watermerk Gevonden'}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                        {result.verdictText}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Betrouwbaarheid:</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: result.hasWatermark ? '#4ade80' : '#fff' }}>
                        {result.confidence}%
                      </div>
                    </div>
                    {result.sentenceCoverage && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Zindekking:</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#93c5fd' }}>
                          {result.sentenceCoverage.watermarked}/{result.sentenceCoverage.total} zinnen ({result.sentenceCoverage.percent}%)
                        </div>
                      </div>
                    )}
                    {result.decodedPayload?.schoolName && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>School Herkomst:</span>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#c084fc' }}>
                          {result.decodedPayload.schoolName}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active techniques tags */}
                  {result.techniquesDetected && result.techniquesDetected.some(t => t.active) && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {result.techniquesDetected.filter(t => t.active).map(t => (
                        <span key={t.id} style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', padding: '2px 8px', borderRadius: '10px' }}>
                          ✓ {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Roentgen Visualizer Toggle */}
                  {result.visualRontgenHtml && result.hasWatermark && (
                    <div style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowRontgen(!showRontgen)}
                        style={{
                          background: showRontgen ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <span>🔬</span>
                        <span>{showRontgen ? 'Verberg Röntgen Inspectie' : 'Toon Röntgen Inspectie (Waar zitten de watermerken?)'}</span>
                      </button>

                      {showRontgen && (
                        <div 
                          style={{
                            marginTop: '0.75rem',
                            padding: '1rem',
                            background: 'rgba(0,0,0,0.4)',
                            borderRadius: '8px',
                            border: '1px dashed rgba(168, 85, 247, 0.4)',
                            fontSize: '0.9rem',
                            lineHeight: 1.8,
                            fontFamily: 'inherit',
                            color: '#e2e8f0'
                          }}
                          dangerouslySetInnerHTML={{ __html: result.visualRontgenHtml }}
                        />
                      )}
                    </div>
                  )}

                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Sluiten
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleVerify}
                  disabled={loading || !text.trim()}
                  style={{ padding: '0.6rem 1.5rem', fontWeight: 600 }}
                >
                  {loading ? 'Bezig met scannen...' : '🛡️ Verifieer Tekst'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
