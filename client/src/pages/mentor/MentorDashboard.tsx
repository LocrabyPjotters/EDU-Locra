import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../components/ToastProvider';
import ConversationGuideModal from '../../components/mentor/ConversationGuideModal';
import StyleDnaReportModal from '../../components/mentor/StyleDnaReportModal';

interface ClassItem {
  id: string;
  name: string;
  description?: string;
  _count?: { studentMembers: number };
}

interface StudentItem {
  id: string;
  displayName: string;
  email: string;
  username: string;
  careSignals: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    hasCriticalOpen: boolean;
  };
  writingDna: {
    samplesCount: number;
    lastAnomalyScore: number | null;
    needsReview: boolean;
  };
  examProgress: {
    examsCompleted: number;
    avgGrade: number | null;
  };
}

export default function MentorDashboard() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const { addToast } = useToast();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classOverview, setClassOverview] = useState<{
    className: string;
    totalStudents: number;
    safetyIndex: number;
    recentIncidentsCount: number;
    students: StudentItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'welzijn' | 'dna' | 'voortgang' | 'veiligheid'>('welzijn');

  // Modals state
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideContent, setGuideContent] = useState<string>('');
  const [activeStudentName, setActiveStudentName] = useState<string>('');

  const [dnaModalOpen, setDnaModalOpen] = useState(false);
  const [dnaReport, setDnaReport] = useState<any | null>(null);

  // Manual Scan state
  const [scanText, setScanText] = useState('');
  const [scanTitle, setScanTitle] = useState('');
  const [scanStudentId, setScanStudentId] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Load mentor classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/mentor/classes', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes || []);
          if (data.classes && data.classes.length > 0) {
            setSelectedClassId(data.classes[0].id);
          }
        }
      } catch {
        addToast('Kon mentorklassen niet ophalen', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [token]);

  // Load selected class overview
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchOverview = async () => {
      try {
        const res = await fetch(`/api/mentor/classes/${selectedClassId}/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setClassOverview(data);
        }
      } catch {
        addToast('Kon klasoverzicht niet ophalen', 'error');
      }
    };
    fetchOverview();
  }, [selectedClassId, token]);

  const handleOpenCareGuide = async (student: StudentItem) => {
    setActiveStudentName(student.displayName);
    try {
      // Haal zorgsignalen op of genereer leidraad
      const res = await fetch(`/api/vp/flags?studentId=${student.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const flag = data.flags?.[0];
        if (flag) {
          const guideRes = await fetch(`/api/mentor/care-guide/${flag.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (guideRes.ok) {
            const guideData = await guideRes.json();
            setGuideContent(guideData.guide);
            setGuideModalOpen(true);
            return;
          }
        }
      }
      // Fallback algemene leidraad
      setGuideContent(
        `### 📋 Vertrouwelijke Gespreksleidraad\n\n` +
        `**Leerling:** ${student.displayName}\n\n` +
        `**Voorbereiding:**\n` +
        `- Nodig de leerling uit voor een rustig mentorgesprek van 15 minuten.\n` +
        `- Vraag open: *"Hoe zit je deze week in je vel op school en thuis?"*\n` +
        `- Luister zonder oordeel en bespreek eventuele vervolgstappen met het zorgteam.`
      );
      setGuideModalOpen(true);
    } catch {
      addToast('Kon gespreksleidraad niet laden', 'error');
    }
  };

  const handleOpenDnaReport = async (studentId: string, studentName: string) => {
    try {
      const res = await fetch(`/api/plagiarism/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Geen rapport');
      const data = await res.json();
      const latestScan = data.recentScans?.[0];

      if (latestScan) {
        setDnaReport({
          documentTitle: latestScan.documentTitle,
          styleAnomalyScore: latestScan.styleAnomalyScore,
          aiProbabilityScore: latestScan.aiProbabilityScore,
          metrics: {
            totalWords: 350,
            totalSentences: 18,
            avgSentenceLength: data.profile?.avgSentenceLength || 19.4,
            lexicalDiversityTTR: data.profile?.lexicalDiversityTTR || 0.48,
            passiveVoiceRatio: data.profile?.passiveVoiceRatio || 0.15,
            vocabularyComplexity: data.profile?.vocabularyComplexity || 0.22
          },
          baselineMetrics: data.profile,
          flaggedReasons: latestScan.flaggedReasons || []
        });
      } else {
        setDnaReport({
          documentTitle: `Referentieprofiel ${studentName}`,
          styleAnomalyScore: 0.1,
          aiProbabilityScore: 0.05,
          metrics: {
            totalWords: 0,
            totalSentences: 0,
            avgSentenceLength: data.profile?.avgSentenceLength || 16.5,
            lexicalDiversityTTR: data.profile?.lexicalDiversityTTR || 0.52,
            passiveVoiceRatio: data.profile?.passiveVoiceRatio || 0.12,
            vocabularyComplexity: data.profile?.vocabularyComplexity || 0.18
          },
          baselineMetrics: data.profile,
          flaggedReasons: []
        });
      }
      setDnaModalOpen(true);
    } catch {
      addToast('Kon schrijf-DNA rapport niet laden', 'error');
    }
  };

  const handleRunManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanText.trim()) return;

    setIsScanning(true);
    try {
      const res = await fetch('/api/plagiarism/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: scanText,
          documentTitle: scanTitle || 'Handmatige Werkstukscan',
          studentId: scanStudentId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan mislukt');

      setDnaReport(data);
      setDnaModalOpen(true);
      setScanText('');
      setScanTitle('');
      addToast('Stijl-DNA & Integriteitsscan voltooid!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        Laden van Mentor Dashboard...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#f8fafc' }}>
              🛡️ Mentor & Klasregie Dashboard
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Vertrouwelijk klassenoverzicht, welzijnsradar, integriteit en vroegsignalering conform AVG.
          </p>
        </div>

        {/* Klas Kiezer Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>Mentorklas:</label>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#0f172a', color: '#fff' }}>
                {c.name} ({c._count?.studentMembers || 0} leerlingen)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Kaarten ────────────────────────────────────────────────────── */}
      {classOverview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Klasveiligheids-Barometer
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: classOverview.safetyIndex >= 80 ? '#10b981' : '#f59e0b', marginTop: '4px' }}>
              {classOverview.safetyIndex}/100
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {classOverview.recentIncidentsCount === 0 ? 'Geen sentinel-incidenten' : `${classOverview.recentIncidentsCount} blokkades (30d)`}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Aandachtssignalen Zorg
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
              {classOverview.students.filter(s => s.careSignals.level2Count > 0 || s.careSignals.level3Count > 0).length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
              {classOverview.students.filter(s => s.careSignals.hasCriticalOpen).length} leerling(en) met Niveau 3
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Schrijf-DNA Baselines
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {classOverview.students.filter(s => s.writingDna.samplesCount >= 2).length} / {classOverview.totalStudents}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Leerlingen met getrainde DNA-baseline
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Voltooide Examentrainingen
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
              {classOverview.students.reduce((acc, s) => acc + s.examProgress.examsCompleted, 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Sessies afgerond in Examen Simulator
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs Navigatie ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('welzijn')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'welzijn' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            color: activeTab === 'welzijn' ? '#fca5a5' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          🛡️ Klas Welzijn & Zorg
        </button>

        <button
          onClick={() => setActiveTab('dna')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'dna' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'dna' ? '#c4b5fd' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          ✍️ Schrijf-DNA & Integriteit
        </button>

        <button
          onClick={() => setActiveTab('voortgang')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'voortgang' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'voortgang' ? '#7dd3fc' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          🎯 Voortgang & Resultaten
        </button>

        <button
          onClick={() => setActiveTab('veiligheid')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'veiligheid' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
            color: activeTab === 'veiligheid' ? '#fde047' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          🤝 Sentinel & Veiligheid
        </button>
      </div>

      {/* ── Tab 1: Welzijn & Zorg ─────────────────────────────────────────── */}
      {activeTab === 'welzijn' && classOverview && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem', fontWeight: 800 }}>
                Zorgsignalen & Mentorgesprekken
              </h3>
              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                Vroegtijdige signalering van emotionele nood of somberheid met ondersteunende gespreksleidraad.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Leerling</th>
                  <th style={{ padding: '12px' }}>Zorg Radar</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actie</th>
                </tr>
              </thead>
              <tbody>
                {classOverview.students.map(s => {
                  const hasSignals = s.careSignals.level1Count > 0 || s.careSignals.level2Count > 0 || s.careSignals.level3Count > 0;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>
                        <div>{s.displayName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {s.careSignals.level3Count > 0 && (
                            <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 700 }}>
                              🚨 Niveau 3 ({s.careSignals.level3Count})
                            </span>
                          )}
                          {s.careSignals.level2Count > 0 && (
                            <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fde047', fontSize: '0.75rem', fontWeight: 700 }}>
                              ⚠️ Niveau 2 ({s.careSignals.level2Count})
                            </span>
                          )}
                          {s.careSignals.level1Count > 0 && (
                            <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#7dd3fc', fontSize: '0.75rem' }}>
                              ℹ️ Info ({s.careSignals.level1Count})
                            </span>
                          )}
                          {!hasSignals && (
                            <span style={{ color: '#10b981', fontSize: '0.78rem' }}>Geen openstaande signalen</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {s.careSignals.hasCriticalOpen ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>Aandacht gewenst</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Stabiel</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenCareGuide(s)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#fca5a5',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📋 Gespreksleidraad
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Schrijf-DNA & Integriteit ───────────────────────────────── */}
      {activeTab === 'dna' && classOverview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Handmatige analysetool */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
              🔍 Snelle Werkstuk & AI-DNA Scanner
            </h3>
            <p style={{ margin: '0 0 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Plak een ingeleverde tekst om deze direct stilometrisch te vergelijken met de historische schrijfstijl van de leerling.
            </p>

            <form onSubmit={handleRunManualScan} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Titel werkstuk (bijv. Betoog Historische Context)"
                  value={scanTitle}
                  onChange={e => setScanTitle(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
                <select
                  value={scanStudentId}
                  onChange={e => setScanStudentId(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="" style={{ background: '#0f172a' }}>Koppel aan leerling (optioneel)...</option>
                  {classOverview.students.map(s => (
                    <option key={s.id} value={s.id} style={{ background: '#0f172a' }}>
                      {s.displayName} ({s.writingDna.samplesCount} eerdere teksten)
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                required
                rows={4}
                placeholder="Plak hier de tekst of alinea van het werkstuk..."
                value={scanText}
                onChange={e => setScanText(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  fontSize: '0.88rem',
                  resize: 'vertical'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={isScanning}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: isScanning ? 'wait' : 'pointer'
                  }}
                >
                  {isScanning ? 'Analyseren...' : '🧬 Start Integriteitsscan'}
                </button>
              </div>
            </form>
          </div>

          {/* Leerlingen DNA Roster */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
              Schrijf-DNA Status per Leerling
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Leerling</th>
                    <th style={{ padding: '12px' }}>DNA Samples</th>
                    <th style={{ padding: '12px' }}>Laatste Stijlafwijking</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Rapport</th>
                  </tr>
                </thead>
                <tbody>
                  {classOverview.students.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>
                        {s.displayName}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {s.writingDna.samplesCount >= 2 ? (
                          <span style={{ color: '#10b981' }}>✅ {s.writingDna.samplesCount} geverifieerde teksten</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{s.writingDna.samplesCount} sample (in opbouw)</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {s.writingDna.lastAnomalyScore !== null ? (
                          <span style={{
                            color: s.writingDna.lastAnomalyScore >= 0.6 ? '#ef4444' : s.writingDna.lastAnomalyScore >= 0.35 ? '#f59e0b' : '#10b981',
                            fontWeight: 700
                          }}>
                            {Math.round(s.writingDna.lastAnomalyScore * 100)}% afwijking
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Nog niet gescand</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {s.writingDna.needsReview ? (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 700, fontSize: '0.75rem' }}>
                            ⚠️ Review Nodig
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Regulier</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDnaReport(s.id, s.displayName)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            background: 'rgba(139, 92, 246, 0.12)',
                            color: '#c4b5fd',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🧬 DNA Inzien
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Voortgang & Resultaten ──────────────────────────────────── */}
      {activeTab === 'voortgang' && classOverview && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
            Studie- & Toetsvoortgang
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Leerling</th>
                  <th style={{ padding: '12px' }}>Examens Geoefend</th>
                  <th style={{ padding: '12px' }}>Gemiddeld Cijfer</th>
                  <th style={{ padding: '12px' }}>Inzet Indicatie</th>
                </tr>
              </thead>
              <tbody>
                {classOverview.students.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>{s.displayName}</td>
                    <td style={{ padding: '12px' }}>{s.examProgress.examsCompleted} examensessies</td>
                    <td style={{ padding: '12px' }}>
                      {s.examProgress.avgGrade !== null ? (
                        <span style={{
                          color: s.examProgress.avgGrade >= 5.5 ? '#10b981' : '#ef4444',
                          fontWeight: 700
                        }}>
                          {s.examProgress.avgGrade}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {s.examProgress.examsCompleted >= 3 ? (
                        <span style={{ color: '#38bdf8' }}>Actief oefenend</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Nog beperkt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Sentinel & Klasveiligheid ──────────────────────────────── */}
      {activeTab === 'veiligheid' && classOverview && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
          <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
            🤝 Sentinel Veiligheidslog
          </h3>
          <p style={{ margin: '0 0 1.25rem', color: '#94a3b8', fontSize: '0.82rem' }}>
            Overzicht van kwetsende of intimiderende berichten die door de Sentinel zijn tegengehouden.
          </p>

          <div style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            color: '#fef08a',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            🛡️ <strong>Sociale Veiligheid:</strong> De Sentinel grijpt realtime in vóórdat toxische berichten andere leerlingen bereiken. De leerling krijgt direct een pedagogische reflectiewaarschuwing.
          </div>

          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            {classOverview.recentIncidentsCount === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#10b981' }}>
                🎉 Geen geblokkeerde sentinel-incidenten in deze klas in de afgelopen 30 dagen!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                  Er zijn {classOverview.recentIncidentsCount} berichten geblokkeerd en doorgestuurd naar reflectie.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {guideModalOpen && (
        <ConversationGuideModal
          guide={guideContent}
          studentName={activeStudentName}
          onClose={() => setGuideModalOpen(false)}
        />
      )}

      {dnaModalOpen && dnaReport && (
        <StyleDnaReportModal
          report={dnaReport}
          onClose={() => setDnaModalOpen(false)}
        />
      )}
    </div>
  );
}
