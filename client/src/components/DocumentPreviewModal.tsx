import React, { useState, useEffect } from 'react';

interface DocumentPreviewModalProps {
  doc: {
    id: string;
    title?: string;
    filename?: string;
    type?: string;
    snippet?: string;
    relevanceScore?: number;
  } | null;
  token: string | null;
  onClose: () => void;
}

export default function DocumentPreviewModal({ doc, token, onClose }: DocumentPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'content'>('preview');
  const [loading, setLoading] = useState(false);
  const [docContent, setDocContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const docTitle = doc?.title || doc?.filename || 'Document';
  const fileExt = (docTitle.split('.').pop() || '').toLowerCase();
  const isPdf = fileExt === 'pdf';

  useEffect(() => {
    if (!doc) return;
    
    // Auto-switch to content tab for non-PDF files as browser iframes cannot render docx directly
    if (!isPdf) {
      setActiveTab('content');
    } else {
      setActiveTab('preview');
    }

    // Fetch document extracted content and chunks
    setLoading(true);
    setError(null);
    fetch(`/api/knowledge/documents/${doc.id}/content`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Fout bij laden documentinhoud (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setDocContent(data);
      })
      .catch((err) => {
        console.warn('[DocPreview] Failed to fetch content:', err.message);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [doc?.id]);

  if (!doc) return null;

  const previewUrl = `/api/knowledge/documents/${doc.id}/preview?token=${encodeURIComponent(token || '')}`;
  const downloadUrl = `/api/knowledge/documents/${doc.id}/download?token=${encodeURIComponent(token || '')}`;

  const handleCopyContent = () => {
    if (docContent?.fullText) {
      navigator.clipboard.writeText(docContent.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredChunks = (docContent?.chunks || []).filter((c: any) =>
    !searchFilter || c.content.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 1050,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          height: '88vh',
          background: 'var(--bg-elevated, #18181b)',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65)',
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'var(--bg-surface, #202024)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <span style={{ fontSize: '1.5rem' }}>
              {isPdf ? '📕' : fileExt.includes('doc') ? '📝' : '📄'}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  color: 'var(--text-primary, #ffffff)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '500px'
                }}
                title={docTitle}
              >
                {docTitle}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                <span style={{ textTransform: 'uppercase', padding: '1px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', fontWeight: 600 }}>
                  {fileExt || 'DOC'}
                </span>
                {doc.relevanceScore !== undefined && (
                  <span style={{ color: '#34d399', fontWeight: 600 }}>
                    🎯 {doc.relevanceScore}% relevantie
                  </span>
                )}
                {docContent?.knowledgeBaseSubject && (
                  <span>• Vak: <strong>{docContent.knowledgeBaseSubject}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: 'var(--text-primary, #fff)',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              title="Open document in nieuw browsertabblad"
            >
              <span>↗️</span> Nieuw venster
            </a>

            <a
              href={downloadUrl}
              download
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                color: '#38bdf8',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              title="Download het originele bestand"
            >
              <span>⬇️</span> Download
            </a>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: 'var(--text-secondary, #a1a1aa)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '0.5rem'
              }}
              title="Sluiten"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab navigation & search bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isPdf && (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'preview' ? 'var(--primary, #7c3aed)' : 'transparent',
                  color: activeTab === 'preview' ? '#ffffff' : 'var(--text-secondary, #a1a1aa)'
                }}
              >
                📕 Origineel Document (PDF)
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('content')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'content' ? 'var(--primary, #7c3aed)' : 'transparent',
                color: activeTab === 'content' ? '#ffffff' : 'var(--text-secondary, #a1a1aa)'
              }}
            >
              📑 Geëxtraheerde Inhoud & Chunks ({docContent?.chunksCount || 0})
            </button>
          </div>

          {activeTab === 'content' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Zoek in document..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  color: 'white',
                  width: '200px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleCopyContent}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Kopieer alle tekst naar klembord"
              >
                {copied ? '✓ Gekopieerd' : '📋 Kopiëren'}
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Embedded Iframe Preview */}
        {activeTab === 'preview' && isPdf && (
          <div style={{ flex: 1, position: 'relative', background: '#2d3748' }}>
            <iframe
              src={previewUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff'
              }}
              title={docTitle}
            />
          </div>
        )}

        {/* Tab 2: Extracted Text & Chunks Viewer */}
        {activeTab === 'content' && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              background: 'rgba(0, 0, 0, 0.15)'
            }}
          >
            {/* Cited passage spotlight if available from the search/RAG */}
            {doc.snippet && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    marginBottom: '0.4rem'
                  }}
                >
                  <span>✨</span> Geciteerde Passage uit dit Document
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--text-primary, #ffffff)',
                    fontStyle: 'italic',
                    borderLeft: '3px solid #10b981',
                    paddingLeft: '0.75rem',
                    marginTop: '0.5rem'
                  }}
                >
                  "{doc.snippet}"
                </div>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                Documentinhoud ophalen...
              </div>
            )}

            {error && !loading && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '1rem',
                  borderRadius: '8px'
                }}
              >
                {error}. Gebruik de knoppen 'Download' of 'Nieuw venster' om het bestand te openen.
              </div>
            )}

            {!loading && !error && filteredChunks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #a1a1aa)', fontWeight: 600 }}>
                  ALINEA'S & EMBEDDING CHUNKS ({filteredChunks.length})
                </div>
                {filteredChunks.map((chunk: any, i: number) => {
                  const isCited = doc.snippet && chunk.content.includes(doc.snippet.slice(0, 40));
                  return (
                    <div
                      key={chunk.id || i}
                      style={{
                        background: isCited ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isCited ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                        borderRadius: '10px',
                        padding: '1rem',
                        fontSize: '0.88rem',
                        lineHeight: '1.6',
                        color: 'var(--text-primary, #ffffff)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '0.4rem',
                          fontSize: '0.72rem',
                          color: isCited ? '#34d399' : 'var(--text-secondary, #a1a1aa)',
                          fontWeight: 600
                        }}
                      >
                        <span>Sectie #{chunk.chunkIndex + 1}</span>
                        {isCited && <span>★ MATCH MET ANTWOORD</span>}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{chunk.content}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !error && filteredChunks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                Geen tekstfragmenten gevonden{searchFilter ? ` voor zoekopdracht "${searchFilter}"` : ''}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
