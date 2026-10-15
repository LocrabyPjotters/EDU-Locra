import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function LicensePanel() {
  const token = useAuthStore(state => state.token);
  const [licenseData, setLicenseData] = useState<any>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Watermark interactive sandbox state
  const [sandboxText, setSandboxText] = useState(
    'De Franse Revolutie (1789-1799) was een periode van radicale sociale en politieke omwenteling in Frankrijk.\u200B\u200C\u200D\u200E\u200B'
  );
  const [showHiddenChars, setShowHiddenChars] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ hasWatermark: boolean; confidence: number } | null>(null);

  const loadLicense = () => {
    fetch('/api/settings/license', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setLicenseData(data);
          if (data.key) {
            setLicenseKeyInput(data.key);
          }
        }
      })
      .catch(err => console.error('Failed to load license', err));
  };

  useEffect(() => {
    loadLicense();
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setMessage({ type: 'error', text: 'Vul een geldige licentiesleutel in (bijv. LOCRA-CIW0-K9Z2-KKTL).' });
      return;
    }

    setActivating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/license/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ licenseKey: licenseKeyInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Licentieactivatie mislukt');
      }

      setMessage({
        type: 'success',
        text: `✓ Licentie succesvol gekoppeld! ${data.license?.tier?.toUpperCase()} is nu actief voor ${data.license?.schoolName || 'jouw school'}.`
      });
      loadLicense();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActivating(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Weet je zeker dat je de licentie wilt ontkoppelen? De server valt terug naar de gratis modus.')) {
      return;
    }

    try {
      const res = await fetch('/api/settings/license/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLicenseKeyInput('');
        setMessage({ type: 'success', text: 'Licentie ontkoppeld. Server draait op Free tier.' });
        loadLicense();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Fout bij ontkoppelen: ' + e.message });
    }
  };

  const handleVerifySandbox = async () => {
    if (!sandboxText.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/watermark/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: sandboxText })
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyResult(data);
      } else {
        alert(data.error || 'Verificatie mislukt');
      }
    } catch (err: any) {
      alert('Netwerkfout bij verificatie: ' + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const isEduPlus = licenseData?.isEduPlus || licenseData?.tier === 'edu-plus' || licenseData?.tier === 'enterprise';

  // Count zero-width characters in sandbox
  const countZeroWidth = (text: string) => {
    const matches = text.match(/[\u200B\u200C\u200D\u200E]/g);
    return matches ? matches.length : 0;
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2rem' }}>🎓</span>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Licentie & EDU Plus</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0 }}>
          Koppel de officiële Pjotters schoollicentie om EDU Plus functionaliteiten te ontgrendelen, inclusief onzichtbare watermarking en SOMtoday integratie.
        </p>
      </div>

      {message && (
        <div 
          style={{ 
            padding: '1rem 1.25rem', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: message.type === 'success' ? '#86efac' : '#fca5a5',
            fontWeight: 500
          }}
        >
          {message.text}
        </div>
      )}

      {/* Main License Coupling Card */}
      <div 
        className="glass-panel"
        style={{
          padding: '2.5rem',
          borderRadius: '20px',
          border: isEduPlus ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
          background: isEduPlus 
            ? 'linear-gradient(135deg, rgba(30, 41, 68, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)' 
            : 'var(--bg-surface)',
          boxShadow: isEduPlus ? '0 12px 40px -10px rgba(59, 130, 246, 0.3)' : 'none',
          marginBottom: '2.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                {isEduPlus ? 'Actieve Schoollicentie' : 'Licentie Koppelen'}
              </h2>
              <span style={{
                background: isEduPlus ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {licenseData?.tier?.toUpperCase() || 'GRATIS'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              {isEduPlus 
                ? 'Deze Locra server is geautoriseerd en gekoppeld aan het Pjotters Cloud platform.' 
                : 'Voer hieronder de licentiesleutel in die je hebt ontvangen bij de registratie.'}
            </p>
          </div>

          {isEduPlus && (
            <button 
              type="button" 
              onClick={handleUnlink}
              className="btn" 
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
            >
              Licentie Ontkoppelen
            </button>
          )}
        </div>

        {isEduPlus ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>School / Instelling</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{licenseData?.schoolName || 'Onderwijsinstelling'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Licentiesleutel</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace', color: '#60a5fa' }}>{licenseData?.key}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Watermarking Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🛡️</span> Actief & Beschermd
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Geldigheid</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                  {licenseData?.expiresAt ? new Date(licenseData.expiresAt).toLocaleDateString('nl-NL') : 'Onbeperkt / 1 Jaar'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActivate} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="LOCRA-XXXX-XXXX-XXXX"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '0.9rem 1.25rem',
                fontSize: '1.1rem',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={activating}
              style={{ padding: '0.9rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              {activating ? 'Koppelen...' : '⚡ Licentie Koppelen'}
            </button>
          </form>
        )}
      </div>

      {/* EDU Plus Features Grid */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>
          EDU Plus Mogelijkheden
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Feature 1: Watermarking */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🛡️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Slimme Watermarking</h3>
              <span style={{ marginLeft: 'auto', background: isEduPlus ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: isEduPlus ? '#4ade80' : '#aaa', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                {isEduPlus ? 'ACTIEF' : 'VEREIST EDU PLUS'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Alle antwoorden van Locra worden automatisch voorzien van een onzichtbare cryptografische zero-width handtekening. Docenten kunnen ingeleverd werk direct controleren in het chatpaneel met de <strong>🕵️ Detectie</strong> tool.
            </p>
          </div>

          {/* Feature 2: SOMtoday */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📚</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>SOMtoday Integratie</h3>
              <span style={{ marginLeft: 'auto', background: isEduPlus ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: isEduPlus ? '#4ade80' : '#aaa', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                {isEduPlus ? 'BESCHIKBAAR' : 'VEREIST EDU PLUS'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Koppel direct met de SOMtoday schoolomgeving. Leerlingen kunnen vragen stellen over hun persoonlijke huiswerk, roosters en vakspecifieke stof met contextueel AI-begrip.
            </p>
          </div>

          {/* Feature 3: Onbeperkte Kennisbanken */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🧠</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Geavanceerde RAG Kennisbanken</h3>
              <span style={{ marginLeft: 'auto', background: isEduPlus ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: isEduPlus ? '#4ade80' : '#aaa', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                {isEduPlus ? 'ONBEPERKT' : '1 KENNISBANK'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Upload complete PTA-documenten, schoolreglementen, methodes (Noordhoff, Malmberg) en syllabi. Locra antwoordt accuraat met exacte bronvermelding en pagina-referenties.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Watermarking Sandbox */}
      <div 
        className="glass-panel"
        style={{
          padding: '2rem',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--bg-surface)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              🔬 Interactieve Watermerk Sandbox & Inspector
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
              Test hoe het EDU Plus cryptografische watermerk werkt en verifieer hoe docenten dit direct kunnen detecteren.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setSandboxText('Dit is een origineel stuk tekst geschreven door een leerling zelf zonder enige hulp van AI.')}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem' }}
            >
              Tekst Zonder Watermerk
            </button>
            <button 
              type="button" 
              onClick={() => setSandboxText('Volgens de wet van behoud van energie kan energie niet verloren gaan, maar enkel worden omgezet in een andere vorm.\u200B\u200C\u200D\u200E\u200B')}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              + AI Voorbeeld Met Watermerk
            </button>
          </div>
        </div>

        <textarea
          value={sandboxText}
          onChange={(e) => setSandboxText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: '1rem',
            fontFamily: 'inherit',
            marginBottom: '1rem',
            resize: 'vertical'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={() => setShowHiddenChars(!showHiddenChars)}
              style={{ 
                background: showHiddenChars ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.05)',
                color: showHiddenChars ? '#c084fc' : 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85rem'
              }}
            >
              {showHiddenChars ? '👁️ Verberg Onzichtbare Tekens' : '🔍 Inspecteer Verborgen Karakters'}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Aanwezige onzichtbare tekens: <strong style={{ color: countZeroWidth(sandboxText) > 0 ? '#4ade80' : '#aaa' }}>{countZeroWidth(sandboxText)}</strong>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleVerifySandbox}
            disabled={verifyLoading || !sandboxText.trim()}
            style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
          >
            {verifyLoading ? 'Controleren...' : '🛡️ Verifieer Watermerk'}
          </button>
        </div>

        {/* Hidden Character Visualizer */}
        {showHiddenChars && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(168, 85, 247, 0.4)' }}>
            <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Unicode Inspectie View (Zero-Width Tekens Worden Geel/Paars Weergegeven)
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', wordBreak: 'break-all', lineHeight: 1.8 }}>
              {Array.from(sandboxText).map((char, idx) => {
                const code = char.charCodeAt(0);
                if (code === 0x200B) return <span key={idx} style={{ background: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWSP:200B]</span>;
                if (code === 0x200C) return <span key={idx} style={{ background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWNJ:200C]</span>;
                if (code === 0x200D) return <span key={idx} style={{ background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[ZWJ:200D]</span>;
                if (code === 0x200E) return <span key={idx} style={{ background: '#059669', color: '#fff', padding: '2px 6px', borderRadius: '4px', margin: '0 2px', fontSize: '0.75rem' }}>[LRM:200E]</span>;
                return <span key={idx}>{char}</span>;
              })}
            </div>
          </div>
        )}

        {/* Verification Result Card */}
        {verifyResult && (
          <div 
            style={{ 
              marginTop: '1.5rem',
              padding: '1.25rem', 
              borderRadius: '12px',
              background: verifyResult.hasWatermark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${verifyResult.hasWatermark ? '#22c55e' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>
              {verifyResult.hasWatermark ? '🛡️' : '❌'}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: verifyResult.hasWatermark ? '#86efac' : '#fca5a5' }}>
                {verifyResult.hasWatermark 
                  ? 'Geverifieerd: Deze tekst is gegenereerd door Locra AI (EDU Plus)' 
                  : 'Geen Locra Watermerk Gedetecteerd'}
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Detectie Betrouwbaarheid van detectie: <strong style={{ color: '#fff' }}>{verifyResult.confidence}%</strong> {verifyResult.hasWatermark && '— Cryptografische zero-width reeks is intact.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
