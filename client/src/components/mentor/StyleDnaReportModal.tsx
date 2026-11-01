import React from 'react';

interface StyleDnaReportModalProps {
  report: {
    documentTitle: string;
    styleAnomalyScore: number;
    aiProbabilityScore: number;
    metrics: {
      totalWords: number;
      totalSentences: number;
      avgSentenceLength: number;
      lexicalDiversityTTR: number;
      passiveVoiceRatio: number;
      vocabularyComplexity: number;
    };
    baselineMetrics?: {
      avgSentenceLength?: number;
      lexicalDiversityTTR?: number;
      passiveVoiceRatio?: number;
      vocabularyComplexity?: number;
    } | null;
    flaggedReasons: string[];
    verdict?: string;
  };
  onClose: () => void;
}

export default function StyleDnaReportModal({ report, onClose }: StyleDnaReportModalProps) {
  const getScoreColor = (score: number) => {
    if (score >= 0.7) return '#ef4444';
    if (score >= 0.4) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(139, 92, 246, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>🧬</span>
              <h3 style={{ margin: 0, color: '#c4b5fd', fontSize: '1.15rem', fontWeight: 800 }}>
                Stijl-DNA & Integriteitsrapport
              </h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
              Document: <strong style={{ color: '#f8fafc' }}>{report.documentTitle}</strong> ({report.metrics.totalWords} woorden)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Score Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${getScoreColor(report.styleAnomalyScore)}40`,
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: getScoreColor(report.styleAnomalyScore) }}>
                {Math.round(report.styleAnomalyScore * 100)}%
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>DNA-Stijlafwijking</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Verschil met eigen historische schrijfstijl</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${getScoreColor(report.aiProbabilityScore)}40`,
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: getScoreColor(report.aiProbabilityScore) }}>
                {Math.round(report.aiProbabilityScore * 100)}%
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>AI-Syntaxis Kans</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Stilometrische AI-regelmaat markers</div>
            </div>
          </div>

          {/* Metrics Comparison Table */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Stilometrische Vergelijking
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Parameter</th>
                    <th style={{ padding: '8px 12px' }}>Dit Document</th>
                    <th style={{ padding: '8px 12px' }}>Eigen Baseline</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#e2e8f0' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Gem. Zinslengte</td>
                    <td style={{ padding: '8px 12px' }}>{report.metrics.avgSentenceLength} woorden</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                      {report.baselineMetrics?.avgSentenceLength ? `${report.baselineMetrics.avgSentenceLength} woorden` : 'Nog geen baseline'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Lexicale Diversiteit (TTR)</td>
                    <td style={{ padding: '8px 12px' }}>{Math.round(report.metrics.lexicalDiversityTTR * 100)}%</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                      {report.baselineMetrics?.lexicalDiversityTTR ? `${Math.round(report.baselineMetrics.lexicalDiversityTTR * 100)}%` : 'Nog geen baseline'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Passieve Vorm Ratio</td>
                    <td style={{ padding: '8px 12px' }}>{Math.round(report.metrics.passiveVoiceRatio * 100)}%</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                      {report.baselineMetrics?.passiveVoiceRatio !== undefined ? `${Math.round(report.baselineMetrics.passiveVoiceRatio * 100)}%` : 'Nog geen baseline'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>Woordcomplexiteit (&gt;7 letters)</td>
                    <td style={{ padding: '8px 12px' }}>{Math.round(report.metrics.vocabularyComplexity * 100)}%</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                      {report.baselineMetrics?.vocabularyComplexity ? `${Math.round(report.baselineMetrics.vocabularyComplexity * 100)}%` : 'Nog geen baseline'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Flagged reasons */}
          {report.flaggedReasons.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', marginBottom: '8px' }}>
                Gesignaleerde Afwijkingen
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.flaggedReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#fecaca',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>⚠️</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.3)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

