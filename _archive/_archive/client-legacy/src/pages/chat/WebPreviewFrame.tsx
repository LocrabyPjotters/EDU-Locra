import { useState, useEffect } from 'react';

interface WebPreviewFrameProps {
  url: string;
}

/**
 * Renders a webpage in an iframe.
 * Detects X-Frame-Options blocks (white/blank page) and shows a fallback.
 */
export default function WebPreviewFrame({ url }: WebPreviewFrameProps) {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reset state when URL changes
  useEffect(() => {
    setBlocked(false);
    setLoading(true);
  }, [url]);

  const handleLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    setLoading(false);
    try {
      // Try accessing contentDocument - cross-origin pages throw SecurityError (good, page loaded)
      // Pages blocked by X-Frame-Options load as about:blank → contentDocument.body is empty
      const doc = (e.target as HTMLIFrameElement).contentDocument;
      if (doc && doc.location.href === 'about:blank') {
        setBlocked(true);
      }
    } catch {
      // SecurityError means cross-origin page loaded successfully - NOT blocked
      setBlocked(false);
    }
  };

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Loading shimmer */}
      {loading && !blocked && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, var(--bg-surface) 25%, rgba(255,255,255,0.05) 50%, var(--bg-surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '1.5rem' }}>🌐</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Laden...</div>
        </div>
      )}

      {/* Blocked fallback */}
      {blocked ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1rem', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem' }}>🚫</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>
            Niet mogelijk om te bekijken
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '280px' }}>
            Deze website blokkeert het weergeven in een venster. Open de pagina in een nieuw tabblad.
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.2rem',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              transition: 'opacity 0.15s'
            }}
          >
            ↗ Openen in nieuw tabblad
          </a>
        </div>
      ) : (
        <iframe
          key={url}
          src={url}
          onLoad={handleLoad}
          style={{ flex: 1, border: 'none', background: '#fff', display: 'block', width: '100%', height: '100%' }}
          title="Bron Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}
    </div>
  );
}
