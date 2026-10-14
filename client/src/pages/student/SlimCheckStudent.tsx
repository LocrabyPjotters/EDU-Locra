import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/ToastProvider';
import { FileText, ChevronDown, ChevronUp, Image as ImageIcon, X } from 'lucide-react';

interface ResponseItem {
  id: string;
  questionNumber: number;
  maxPoints: number;
  promptText?: string | null;
  modelAnswer?: string | null;
  points: number | null;
  aiFeedback?: string | null;
  teacherNote?: string | null;
  feedback: string | null;
  hasCrop: boolean;
  needsReview?: boolean;
}

interface SlimCheckResult {
  sessionId: string;
  scanId: string;
  title: string;
  subject: string | null;
  publishedAt: string;
  returnGrade: boolean;
  returnFeedback: boolean;
  returnScan: boolean;
  returnModelAnswer?: boolean;
  startPage: number;
  endPage: number;
  grade: number | null;
  totalPoints: number | null;
  totalMaxPoints: number | null;
  responses: ResponseItem[];
  hasScan: boolean;
}

export default function SlimCheckStudent() {
  const token = useAuthStore(state => state.token);
  const { addToast } = useToast();

  const [results, setResults] = useState<SlimCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Lightbox / crop image viewer
  const [previewCropId, setPreviewCropId] = useState<string | null>(null);

  // Scan page viewer
  const [scanViewer, setScanViewer] = useState<{ scanId: string; title: string; startPage: number; endPage: number; currentPage: number } | null>(null);

  useEffect(() => {
    loadResults();
  }, [token]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/slimcheck/student/results', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        if (data.length > 0) {
          setExpandedSessionId(data[0].sessionId);
        }
      } else {
        addToast('Kon SlimCheck resultaten niet ophalen', 'error');
      }
    } catch {
      addToast('Netwerkfout bij ophalen resultaten', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionId(prev => prev === sessionId ? null : sessionId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notice Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(56, 189, 248, 0.08))',
        border: '1px solid rgba(124, 92, 252, 0.3)',
        borderRadius: '16px',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          flexShrink: 0
        }}>
          🧠
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Formatieve Toetsinzage via SlimCheck
            <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              AI-Ondersteund
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>
            Hier zie je de uitwerkingen, docentbeoordelingen en formatieve feedback van je gescande handgeschreven toetsen.
          </div>
        </div>
      </div>

      {/* Main Results List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Toetsresultaten ophalen...
        </div>
      ) : results.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '16px',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📝</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem' }}>Nog geen toetsen beschikbaar</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
            Zodra een docent een formatieve toets nakijkt met SlimCheck en publiceert, verschijnen jouw cijfer, uitsneden en inhoudelijke feedback hier.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {results.map(res => {
            const isExpanded = expandedSessionId === res.sessionId;
            const isPassing = res.grade !== null && res.grade >= 5.5;

            return (
              <div
                key={res.sessionId}
                style={{
                  background: 'rgba(17, 24, 39, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backdropFilter: 'blur(16px)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header card */}
                <div
                  onClick={() => toggleExpand(res.sessionId)}
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.06)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '14px',
                      background: 'rgba(124, 92, 252, 0.15)',
                      border: '1px solid rgba(124, 92, 252, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.3rem',
                      flexShrink: 0
                    }}>
                      📄
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        {res.subject && (
                          <span style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {res.subject}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Gepubliceerd op {new Date(res.publishedAt).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {res.title}
                      </h3>
                    </div>
                  </div>

                  {/* Badges & Grade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                    {res.returnGrade && res.grade !== null ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.6rem',
                          fontWeight: 800,
                          lineHeight: 1,
                          color: isPassing ? '#34d399' : '#fb923c'
                        }}>
                          {res.grade.toFixed(1)}
                        </div>
                        {res.totalPoints !== null && res.totalMaxPoints !== null && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {res.totalPoints} / {res.totalMaxPoints} pt
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem'
                      }}>
                        Geen cijfer
                      </span>
                    )}

                    <button
                      type="button"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '24px' }}>
                    {/* Action bar (Scan view) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        Overzicht per vraag met punten en feedback van de docent:
                      </div>

                      {res.returnScan && (
                        <button
                          onClick={() => setScanViewer({
                            scanId: res.scanId,
                            title: res.title,
                            startPage: res.startPage,
                            endPage: res.endPage,
                            currentPage: res.startPage
                          })}
                          style={{
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(124, 92, 252, 0.2))',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <FileText size={16} /> Bekijk Gescande Toets
                        </button>
                      )}
                    </div>

                    {/* Responses Table / Cards */}
                    {res.returnFeedback && res.responses.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {res.responses.map(resp => (
                          <div
                            key={resp.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              borderRadius: '12px',
                              padding: '16px 20px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '16px',
                              flexWrap: 'wrap'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: '240px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span style={{
                                  fontWeight: 700,
                                  fontSize: '0.95rem',
                                  color: '#fff',
                                  background: 'rgba(124, 92, 252, 0.25)',
                                  padding: '2px 10px',
                                  borderRadius: '6px'
                                }}>
                                  Vraag {resp.questionNumber}
                                </span>
                                <span style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  color: (resp.needsReview && resp.points === null) ? '#fbbf24' : (resp.points ?? 0) === resp.maxPoints ? '#34d399' : (resp.points ?? 0) > 0 ? '#38bdf8' : '#fb923c'
                                }}>
                                  {(resp.needsReview && resp.points === null) ? '⏳ In docentcontrole' : `${resp.points !== null ? resp.points : '-'} / ${resp.maxPoints} pt`}
                                </span>
                              </div>

                              {/* Optional Question prompt */}
                              {resp.promptText && (
                                <div style={{
                                  fontSize: '0.82rem',
                                  color: '#cbd5e1',
                                  background: 'rgba(99, 102, 241, 0.08)',
                                  border: '1px solid rgba(99, 102, 241, 0.2)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  marginBottom: '8px',
                                  lineHeight: 1.45
                                }}>
                                  <span style={{ fontWeight: 700, color: '#a5b4fc', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.03em' }}>
                                    📝 Opgave
                                  </span>
                                  {resp.promptText}
                                </div>
                              )}

                              {/* Optional Model answer */}
                              {resp.modelAnswer && (
                                <div style={{
                                  fontSize: '0.84rem',
                                  color: '#e0f2fe',
                                  background: 'rgba(56, 189, 248, 0.08)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  marginBottom: '8px',
                                  lineHeight: 1.45
                                }}>
                                  <span style={{ fontWeight: 700, color: '#38bdf8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.03em' }}>
                                    🎯 Antwoord volgens correctiemodel
                                  </span>
                                  {resp.modelAnswer}
                                </div>
                              )}

                              {/* AI Feedback voor leerling */}
                              {resp.aiFeedback && (
                                <div style={{
                                  fontSize: '0.86rem',
                                  color: '#e2e8f0',
                                  lineHeight: 1.6,
                                  background: 'rgba(124, 92, 252, 0.06)',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(124, 92, 252, 0.2)',
                                  marginBottom: '6px'
                                }}>
                                  <span style={{ fontWeight: 700, color: '#c4b5fd', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.03em' }}>
                                    ✨ AI Feedback
                                  </span>
                                  {resp.aiFeedback}
                                </div>
                              )}

                              {/* Docent feedback */}
                              {resp.teacherNote && (
                                <div style={{
                                  fontSize: '0.88rem',
                                  color: '#e2e8f0',
                                  lineHeight: 1.6,
                                  background: 'rgba(0, 0, 0, 0.2)',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid #34d399'
                                }}>
                                  <span style={{ fontWeight: 700, color: '#34d399', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.03em' }}>
                                    👨‍🏫 Feedback van de docent
                                  </span>
                                  {resp.teacherNote}
                                </div>
                              )}

                              {/* Fallback als er helemaal geen feedback is */}
                              {!resp.aiFeedback && !resp.teacherNote && (
                                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                                  Geen specifieke feedback genoteerd.
                                </div>
                              )}
                            </div>

                            {/* View Crop snippet if available */}
                            {resp.hasCrop && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                                <div
                                  onClick={() => setPreviewCropId(resp.id)}
                                  style={{
                                    width: '120px',
                                    height: '70px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: '#090d16',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    transition: 'transform 0.15s, border-color 0.15s'
                                  }}
                                  title="Klik om jouw ingeleverde handgeschreven uitwerking te vergroten"
                                >
                                  <img
                                    src={`/api/slimcheck/responses/${resp.id}/crop?token=${encodeURIComponent(token || '')}`}
                                    alt="Uitsnede"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                                    padding: '2px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    color: '#fff',
                                    fontSize: '0.65rem'
                                  }}>
                                    <ImageIcon size={10} /> Bekijk scan
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '12px',
                        fontSize: '0.88rem'
                      }}>
                        De docent heeft geen inhoudelijke feedback per vraag vrijgegeven voor deze toets.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LIGHTBOX FOR CROPPED ANSWER SNIPPET */}
      {previewCropId && (
        <div
          onClick={() => setPreviewCropId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              maxWidth: '800px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
                🖼️ Originele Antwoorduitsnede
              </span>
              <button
                onClick={() => setPreviewCropId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', textAlign: 'center', background: '#020617' }}>
              <img
                src={`/api/slimcheck/responses/${previewCropId}/crop?token=${encodeURIComponent(token || '')}&t=${Date.now()}`}
                alt="Antwoorduitsnede"
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SCAN PAGE VIEWER MODAL */}
      {scanViewer && (
        <div
          onClick={() => setScanViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                  📄 Geredacteerde Toetsscan
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
                  {scanViewer.title} • Pagina {scanViewer.currentPage} (van {scanViewer.startPage}–{scanViewer.endPage})
                </span>
              </div>
              <button
                onClick={() => setScanViewer(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scan Image Container */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              textAlign: 'center',
              background: '#020617',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={`/api/slimcheck/student/scans/${scanViewer.scanId}/pages/${scanViewer.currentPage}?token=${encodeURIComponent(token || '')}`}
                alt={`Pagina ${scanViewer.currentPage}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                }}
              />
            </div>

            {/* Pagination Controls */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a'
            }}>
              <button
                disabled={scanViewer.currentPage <= scanViewer.startPage}
                onClick={() => setScanViewer(prev => prev ? { ...prev, currentPage: prev.currentPage - 1 } : null)}
                style={{
                  background: scanViewer.currentPage <= scanViewer.startPage ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: scanViewer.currentPage <= scanViewer.startPage ? 'var(--text-muted)' : '#fff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: scanViewer.currentPage <= scanViewer.startPage ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                ← Vorige Pagina
              </button>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Pagina {scanViewer.currentPage - scanViewer.startPage + 1} van {scanViewer.endPage - scanViewer.startPage + 1}
              </span>

              <button
                disabled={scanViewer.currentPage >= scanViewer.endPage}
                onClick={() => setScanViewer(prev => prev ? { ...prev, currentPage: prev.currentPage + 1 } : null)}
                style={{
                  background: scanViewer.currentPage >= scanViewer.endPage ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: scanViewer.currentPage >= scanViewer.endPage ? 'var(--text-muted)' : '#fff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: scanViewer.currentPage >= scanViewer.endPage ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Volgende Pagina →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
