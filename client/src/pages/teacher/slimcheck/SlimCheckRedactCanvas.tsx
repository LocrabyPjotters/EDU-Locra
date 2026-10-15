import React, { useRef, useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Scissors, Columns, Check, Sparkles } from 'lucide-react';

interface Props {
  sessionId: string;
  token: string;
  onCompleted: () => void;
}

export default function SlimCheckRedactCanvas({ sessionId, token, onCompleted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Active Tool Mode: 'redact' (Name anonymization) or 'layout' (Question column vs Answer zone)
  const [activeTool, setActiveTool] = useState<'redact' | 'layout'>('redact');

  // Redaction selection state in percentages (0-100)
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Layout zone state: vertical divider percentage from left
  const [enableDivider, setEnableDivider] = useState<boolean>(true);
  const [dividerX, setDividerX] = useState<number>(22); // default 22% left column

  // Load preview image
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setError(null);

    fetch(`/api/slimcheck/sessions/${sessionId}/preview-page?token=${encodeURIComponent(token)}&t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Fout bij ophalen preview' }));
          throw new Error(err.error || `Server fout ${res.status}`);
        }
        return res.blob();
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (!active) return;
          setImageObj(img);
          setImageLoaded(true);
          // Default initial suggest box at top right: x: 55%, y: 3%, w: 42%, h: 8%
          setRect({ x: 55, y: 3, width: 42, height: 8 });
        };
        img.onerror = () => {
          if (active) setError('Kon pagina-preview niet decoderen als afbeelding.');
        };
        img.src = objectUrl;
      })
      .catch(err => {
        if (active) setError(err.message || 'Kon pagina-preview niet laden. Is de PDF succesvol geüpload?');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId, token]);

  // Redraw canvas whenever image, rect, divider, or active tool changes
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions matching container aspect ratio
    const width = 800;
    const height = (imageObj.height / imageObj.width) * width;
    canvas.width = width;
    canvas.height = height;

    // 1. Draw document page
    ctx.drawImage(imageObj, 0, 0, width, height);

    // 2. Draw Layout Divider & Zones (if enabled)
    if (enableDivider && dividerX > 0) {
      const dx = (dividerX / 100) * width;

      // Question column overlay (purple wash on the left)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
      ctx.fillRect(0, 0, dx, height);

      // Answer zone overlay (subtle green wash on the right)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.fillRect(dx, 0, width - dx, height);

      // Divider vertical line
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(dx, 0);
      ctx.lineTo(dx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge: Vraagkolom (links)
      ctx.fillStyle = 'rgba(88, 28, 135, 0.9)';
      ctx.fillRect(6, 10, Math.min(dx - 12, 190), 22);
      ctx.fillStyle = '#f3e8ff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('◀ VRAAGNUMMERS (genegeerd)', 12, 25);

      // Badge: Antwoordzone (rechts)
      ctx.fillStyle = 'rgba(20, 83, 45, 0.9)';
      ctx.fillRect(dx + 8, 10, 205, 22);
      ctx.fillStyle = '#dcfce7';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('ANTWOORDZONE (AI leest hier) ▶', dx + 14, 25);
    }

    // 3. Draw Redaction Overlay (Name box)
    if (rect) {
      const rx = (rect.x / 100) * width;
      const ry = (rect.y / 100) * height;
      const rw = (rect.width / 100) * width;
      const rh = (rect.height / 100) * height;

      // Dark translucent overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(rx, ry, rw, rh);

      // Warning border
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      // Label badge
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('✂️ NAAM WORDT WEGGELAKT', rx + 6, ry + 18);
    }
  }, [imageObj, rect, enableDivider, dividerX, activeTool]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const bbox = canvas.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));

    if (activeTool === 'layout') {
      // In layout mode, clicking/dragging sets the divider position
      setIsDrawing(true);
      setDividerX(Math.round(xPct));
    } else {
      // In redact mode, drag creates rectangle
      setIsDrawing(true);
      setStartPos({ x: xPct, y: yPct });
      setRect({ x: xPct, y: yPct, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const bbox = canvas.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, ((e.clientX - bbox.left) / bbox.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - bbox.top) / bbox.height) * 100));

    if (activeTool === 'layout') {
      setDividerX(Math.round(curX));
    } else if (startPos) {
      const x = Math.min(startPos.x, curX);
      const y = Math.min(startPos.y, curY);
      const width = Math.abs(curX - startPos.x);
      const height = Math.abs(curY - startPos.y);
      setRect({ x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleApplyRedaction = async () => {
    if (!rect || rect.width < 1 || rect.height < 1) {
      alert('Teken eerst een rechthoek over de naam/leerlinggegevens.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/redact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...rect,
          isPercent: true,
          layoutZone: enableDivider && dividerX > 0 ? { dividerX } : null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Redactie mislukt');
      }

      setShowConfirm(false);
      onCompleted();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Alert Header */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px'
      }}>
        <ShieldAlert size={24} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.95rem', marginBottom: '4px' }}>
            Stap 4 — Anonimisering & Layout-Indeling
          </div>
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            Lak de leerlingnaam permanent weg én geef optioneel de scheiding aan tussen de vraagkolom en het antwoordvak, zodat de AI geen vraagletters meescant.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '12px', borderRadius: '10px', color: '#fca5a5', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {/* Tool Mode Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        background: 'rgba(15, 23, 42, 0.6)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          onClick={() => setActiveTool('redact')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: activeTool === 'redact' ? '1px solid #ef4444' : '1px solid transparent',
            background: activeTool === 'redact' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
            color: activeTool === 'redact' ? '#fca5a5' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Scissors size={16} /> 1. Naam Anonimiseren (Verplicht)
        </button>

        <button
          onClick={() => setActiveTool('layout')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: activeTool === 'layout' ? '1px solid #c084fc' : '1px solid transparent',
            background: activeTool === 'layout' ? 'rgba(192, 132, 252, 0.18)' : 'transparent',
            color: activeTool === 'layout' ? '#e9d5ff' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Columns size={16} /> 2. Vraagkolom vs. Antwoordzone (Slimme Layout)
        </button>
      </div>

      {/* Layout Tool Controls Banner */}
      {activeTool === 'layout' && (
        <div style={{
          background: 'rgba(192, 132, 252, 0.08)',
          border: '1px solid rgba(192, 132, 252, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: '#f3e8ff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableDivider}
                onChange={e => setEnableDivider(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              Scheiding tussen vraagkolom en antwoordzone inschakelen
            </label>

            {enableDivider && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#c084fc' }}>
                <span>Scheidingslijn: <strong>{dividerX}%</strong> van de linkerkant</span>
              </div>
            )}
          </div>

          {enableDivider && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Presets:</span>
              <button
                onClick={() => setDividerX(18)}
                style={{
                  background: dividerX === 18 ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                Smalle kolom (18%)
              </button>
              <button
                onClick={() => setDividerX(25)}
                style={{
                  background: dividerX === 25 ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                Standaard (25% — aanbevolen)
              </button>
              <button
                onClick={() => setDividerX(35)}
                style={{
                  background: dividerX === 35 ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                Brede kolom (35%)
              </button>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={dividerX}
                  onChange={e => setDividerX(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#c084fc' }}
                />
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
            💡 <strong>Waarom dit helpt:</strong> Als op de toets vraaglabels staan (bijv. <em>1a</em>) en de leerling vult <em>C</em> in, voorkomt deze scheiding dat de AI <em>'a c'</em> leest i.p.v. alleen <em>'C'</em>.
          </div>
        </div>
      )}

      {/* Canvas Tool Container */}
      <div
        ref={containerRef}
        style={{
          background: 'rgba(10, 14, 26, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {!imageLoaded ? (
          <div style={{ padding: '60px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={20} className="spin" /> Pagina-preview inladen...
          </div>
        ) : (
          <div style={{
            position: 'relative',
            maxWidth: '800px',
            width: '100%',
            cursor: activeTool === 'layout' ? 'col-resize' : 'crosshair',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '0.82rem', color: '#94a3b8' }}>
          {activeTool === 'redact'
            ? '💡 Klik en sleep over de pagina om het rode redactievlak over de naam te verplaatsen.'
            : '💡 Klik of sleep op de preview om de paarse scheidingslijn tussen de vraagkolom en de antwoorden te positioneren.'}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTool === 'redact' && (
            <button
              onClick={() => setRect({ x: 55, y: 3, width: 42, height: 8 })}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Standaard naamvlak herstellen
            </button>
          )}

          {enableDivider && (
            <span style={{ fontSize: '0.82rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} /> Layout: Vraagkolom links ({dividerX}%) ingesteld
            </span>
          )}
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading || !rect}
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            border: 'none',
            padding: '11px 24px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
          }}
        >
          <Scissors size={18} />
          {loading ? 'Bezig met verwerken...' : 'Anonimisering & Layout toepassen'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#111827',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={22} /> Bevestig permanente anonimisering
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Dit knipt het geselecteerde rechthoeksvlak <strong>permanent</strong> weg van alle eerste pagina's van alle toetsen in deze sessie.
              Deze actie kan niet ongedaan worden gemaakt.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#fff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Annuleren
              </button>
              <button
                onClick={handleApplyRedaction}
                disabled={loading}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Bezig...' : 'Ja, definitief anonimiseren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
