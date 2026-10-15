import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Upload, Users, Scissors, Play, CheckCircle, ArrowRight,
  ArrowLeft, Download, Plus, Trash2, AlertTriangle, BrainCircuit,
  Sparkles, BookOpen, Check, Clock, CalendarClock, Zap, Moon, XCircle,
  Activity, Loader2
} from 'lucide-react';
import SlimCheckRedactCanvas from './SlimCheckRedactCanvas';

interface Props {
  token: string;
  classes: any[];
  assignments: any[];
  onFinish: (sessionId: string) => void;
  onCancel: () => void;
}

export default function SlimCheckWizard({ token, classes, assignments, onFinish, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Installed Ollama models
  const [availableModels, setAvailableModels] = useState<Array<{ id?: string; ollamaName?: string; name?: string; displayName?: string; isActive?: boolean }>>([]);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [isMultimodal, setIsMultimodal] = useState(false);
  const [visionModel, setVisionModel] = useState('minicpm-v:8b');
  const [gradingModel, setGradingModel] = useState('llama3.1:8b');
  const [modelConfig, setModelConfig] = useState<any>(null);
  const [returnGrade, setReturnGrade] = useState(true);
  const [returnFeedback, setReturnFeedback] = useState(false);
  const [returnScan, setReturnScan] = useState(false);
  const [returnModelAnswer, setReturnModelAnswer] = useState(false);

  // Step 2: Upload PDF & Questions
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  // Smart PDF uploads: Assignment PDF (opgaven wat leerling ziet) & Rubric PDF (correctiemodel)
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentUploading, setAssignmentUploading] = useState(false);
  const [assignmentUploadedName, setAssignmentUploadedName] = useState<string | null>(null);

  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricUploading, setRubricUploading] = useState(false);
  const [rubricUploadedName, setRubricUploadedName] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Array<{
    number: number;
    promptText?: string;
    maxPoints: number;
    modelAnswer: string;
    notes?: string;
  }>>([
    { number: 1, promptText: '', maxPoints: 2, modelAnswer: '', notes: '' },
    { number: 2, promptText: '', maxPoints: 3, modelAnswer: '', notes: '' }
  ]);

  // Step 3: Mapping
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingSuccess, setMappingSuccess] = useState<string | null>(null);

  // Step 5: Live Pipeline Progress
  const [pipelineProgress, setPipelineProgress] = useState<{ step: string; percent: number; message: string }>({
    step: 'start',
    percent: 0,
    message: 'Klaar om te starten...'
  });

  // Step 5: Scheduling state
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'offpeak_24h' | 'offpeak_7d' | null>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<any>(null);

  // Fetch installed models & admin model restrictions
  useEffect(() => {
    Promise.all([
      fetch('/api/models', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/slimcheck/model-config', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null)
    ]).then(([modelsData, configData]) => {
      if (configData) setModelConfig(configData);

      if (Array.isArray(modelsData)) {
        const active = modelsData.filter((m: any) => m.isActive !== false);
        setAvailableModels(active);

        const getModelName = (m: any) => m.ollamaName || m.name || '';

        if (configData && configData.teacherModelRestriction) {
          const allowedVisionList = (configData.allowedVisionModels || []).map((x: string) => x.toLowerCase());
          const allowedGradingList = (configData.allowedModels || []).map((x: string) => x.toLowerCase());

          // Set default vision model if specified, else match first allowed
          if (configData.defaultVisionModel) {
            setVisionModel(configData.defaultVisionModel);
          } else if (allowedVisionList.length > 0) {
            const found = active.find((m: any) => allowedVisionList.includes(getModelName(m).toLowerCase()));
            if (found) setVisionModel(getModelName(found));
          } else if (active.length > 0) {
            setVisionModel(getModelName(active[0]));
          }

          // Set default grading model if specified, else match first allowed
          if (configData.defaultGradingModel) {
            setGradingModel(configData.defaultGradingModel);
          } else if (allowedGradingList.length > 0) {
            const found = active.find((m: any) => allowedGradingList.includes(getModelName(m).toLowerCase()));
            if (found) setGradingModel(getModelName(found));
          } else if (active.length > 0) {
            setGradingModel(getModelName(active[0]));
          }
        } else {
          // Auto-select best vision model
          const vision = active.find((m: any) => {
            const n = getModelName(m).toLowerCase();
            return n.includes('vision') || n.includes('llava') || n.includes('minicpm') || n.includes('moondream');
          });
          if (vision) {
            setVisionModel(getModelName(vision));
          } else if (active.length > 0) {
            setVisionModel(getModelName(active[0]));
          }

          // Auto-select best grading text model
          const text = active.find((m: any) => {
            const n = getModelName(m).toLowerCase();
            return n.includes('llama') || n.includes('mistral') || n.includes('qwen') || n.includes('phi');
          });
          if (text) {
            setGradingModel(getModelName(text));
          } else if (active.length > 0) {
            setGradingModel(getModelName(active[0]));
          }
        }
      }
    }).catch(() => { /* silent */ });
  }, [token]);

  // Auto-detect math/chemistry for multimodal
  useEffect(() => {
    const s = subject.toLowerCase();
    if (s.includes('wiskunde') || s.includes('scheikunde') || s.includes('natuurkunde') || s.includes('math') || s.includes('chem')) {
      setIsMultimodal(true);
    }
  }, [subject]);

  // ── Step 1: Create Session ──
  const handleCreateSession = async () => {
    if (!title.trim()) {
      setError('Vul een titel in voor deze nakijksessie.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/slimcheck/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          subject,
          classId: selectedClassId || null,
          assignmentId: selectedAssignmentId || null,
          isMultimodal,
          visionModelId: visionModel,
          gradingModelId: gradingModel,
          returnGrade,
          returnFeedback,
          returnScan,
          returnModelAnswer
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Aanmaken sessie mislukt');
      }

      const created = await res.json();
      setSessionId(created.id);
      setCurrentStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Upload Assignment / Opgaven PDF ("wat de leerling ziet")
  const handleUploadAssignmentFile = async (file: File) => {
    if (!sessionId) return;
    setAssignmentFile(file);
    setAssignmentUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/assignment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload van opgaven PDF mislukt' }));
        throw new Error(err.error || 'Upload van opgaven PDF mislukt');
      }

      const data = await res.json();
      setAssignmentUploadedName(file.name);

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        // Populate or update questions with extracted question prompts
        setQuestions(prev => {
          return data.questions.map((extracted: any, idx: number) => {
            const existing = prev.find(p => p.number === extracted.number) || prev[idx];
            return {
              number: extracted.number || (idx + 1),
              promptText: extracted.promptText || '',
              maxPoints: extracted.maxPoints || existing?.maxPoints || 2,
              modelAnswer: existing?.modelAnswer || '',
              notes: existing?.notes || ''
            };
          });
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAssignmentUploading(false);
    }
  };

  // Upload Rubric / Correctiemodel PDF
  const handleUploadRubricFile = async (file: File) => {
    if (!sessionId) return;
    setRubricFile(file);
    setRubricUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/rubric`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload van correctiemodel PDF mislukt' }));
        throw new Error(err.error || 'Upload van correctiemodel PDF mislukt');
      }

      const data = await res.json();
      setRubricUploadedName(file.name);

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions.map((extracted: any, idx: number) => ({
          number: extracted.number || (idx + 1),
          promptText: extracted.promptText || '',
          modelAnswer: extracted.modelAnswer || '',
          maxPoints: extracted.maxPoints || 1,
          notes: extracted.notes || ''
        })));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRubricUploading(false);
    }
  };

  // ── Step 2: Upload PDF & Save Questions ──
  const handleSaveStep2 = async () => {
    if (!sessionId) return;
    if (!pdfUploaded && !pdfFile) {
      setError('Upload eerst de gescande PDF van de toetsen.');
      return;
    }
    const emptyQ = questions.find(q => !q.modelAnswer.trim());
    if (emptyQ) {
      setError(`Vul het modelantwoord in voor vraag ${emptyQ.number}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Upload PDF if not uploaded yet
      if (pdfFile && !pdfUploaded) {
        const formData = new FormData();
        formData.append('file', pdfFile);

        const uploadRes = await fetch(`/api/slimcheck/sessions/${sessionId}/scans`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload van PDF mislukt');
        }
        const uploadData = await uploadRes.json();
        setPageCount(uploadData.pageCount);
        setPdfUploaded(true);
      }

      // 2. Save Questions
      const qRes = await fetch(`/api/slimcheck/sessions/${sessionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questions })
      });
      if (!qRes.ok) {
        const err = await qRes.json();
        throw new Error(err.error || 'Opslaan van vragen mislukt');
      }

      setCurrentStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Upload Mapping ──
  const handleUploadMapping = async () => {
    if (!sessionId || !mappingFile) {
      setError('Selecteer eerst een Excel of CSV bestand.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', mappingFile);

      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/mapping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verwerken van mapping mislukt');
      }

      const data = await res.json();
      setMappingSuccess(data.message);
      setCurrentStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Download Template ──
  const handleDownloadTemplate = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/mapping/template?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download mislukt' }));
        throw new Error(err.error || 'Kon template niet downloaden');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SlimCheck_Mapping_Template_${(title || 'toets').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Step 5: Fetch queue status when entering step 5 ──
  const fetchQueueStatus = useCallback(async () => {
    if (!sessionId) return;
    setQueueLoading(true);
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQueueStatus(data);
      }
    } catch { /* silent */ }
    setQueueLoading(false);
  }, [sessionId, token]);

  useEffect(() => {
    if (currentStep === 5) {
      fetchQueueStatus();
    }
  }, [currentStep, fetchQueueStatus]);

  // ── Step 5: Start & Stream Pipeline ──
  const handleStartPipeline = async (mode: 'immediate' | 'offpeak_24h' | 'offpeak_7d' = 'immediate') => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    setScheduleMode(mode);

    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kon verwerking niet starten');
      }

      const result = await res.json();
      setScheduleResult(result);

      // If processing now: poll progress
      if (result.status === 'processing') {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/slimcheck/sessions/${sessionId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (statusRes.ok) {
              const data = await statusRes.json();
              if (data.liveProgress) {
                setPipelineProgress(data.liveProgress);
              }
              if (data.status === 'review' || data.status === 'done') {
                clearInterval(pollInterval);
                onFinish(sessionId);
              }
            }
          } catch (e) { /* ignore */ }
        }, 2000);
      } else {
        // Scheduled or queued — show confirmation
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  // Cancel a scheduled/queued session
  const handleCancelSchedule = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/cancel-schedule`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setScheduleResult(null);
        setScheduleMode(null);
        fetchQueueStatus();
      }
    } catch { /* silent */ }
  };

  const stepsList = [
    { num: 1, label: 'Setup & Instellingen', icon: <FileText size={16} /> },
    { num: 2, label: 'Upload & Correctiemodel', icon: <Upload size={16} /> },
    { num: 3, label: 'Leerling Koppeling', icon: <Users size={16} /> },
    { num: 4, label: 'Anonimisering & Layout', icon: <Scissors size={16} /> },
    { num: 5, label: 'AI Verwerking', icon: <BrainCircuit size={16} /> },
  ];

  return (
    <div style={{
      maxWidth: '960px',
      margin: '0 auto',
      background: 'rgba(17, 24, 39, 0.75)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: '32px',
      color: '#f1f5f9',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    }}>
      {/* Wizard Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🧠</span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              SlimCheck — Nieuwe Nakijsessie
            </h2>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
            AI-ondersteunde nakijkhulp voor formatieve toetsen met privacy-waarborging.
          </div>
        </div>

        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            padding: '8px 16px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Annuleren
        </button>
      </div>

      {/* Prominent Formative Warning */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '12px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.82rem', color: '#fef3c7', lineHeight: '1.4' }}>
          <strong>Belangrijk: Uitsluitend voor formatieve toetsen.</strong> SlimCheck is bedoeld voor oefentoetsen en diagnostische feedback. Gebruik voor officiële summatieve toetsen of rapportcijfers is niet toegestaan.
        </div>
      </div>

      {/* Stepper Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '28px',
        gap: '4px'
      }}>
        {stepsList.map(s => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div
              key={s.num}
              style={{
                flex: 1,
                padding: '12px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderBottom: isActive ? '2px solid #7c5cfc' : '2px solid transparent',
                color: isActive ? '#c4b5fd' : isDone ? '#34d399' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.82rem',
                transition: 'all 0.2s ease'
              }}
            >
              {isDone ? <CheckCircle size={16} color="#34d399" /> : s.icon}
              <span>{s.num}. {s.label}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#fca5a5',
          fontSize: '0.88rem',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* ── STAP 1: SETUP ── */}
      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                Titel van de toets *
              </label>
              <input
                type="text"
                placeholder="bv. Diagnostische Toets Lineaire Formules"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(10, 14, 26, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                Vak (bv. Wiskunde, Scheikunde, Frans)
              </label>
              <input
                type="text"
                placeholder="bv. Wiskunde"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(10, 14, 26, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                Koppel aan Klas (voor voorgevulde leerlingenlijst)
              </label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#0a0e1a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                <option value="">-- Geen specifieke klas --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                Koppel aan Opdracht (optioneel, voor cijfersync)
              </label>
              <select
                value={selectedAssignmentId}
                onChange={e => setSelectedAssignmentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#0a0e1a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                <option value="">-- Geen gekoppelde opdracht --</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Model selection */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '14px',
            padding: '18px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#c4b5fd' }}>
                🤖 AI Modellen (Lokaal / Ollama Server)
              </h4>
              {modelConfig?.teacherModelRestriction && (
                <span style={{
                  fontSize: '0.72rem',
                  background: 'rgba(52, 211, 153, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🔒 Alleen goedgekeurde docentmodellen
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  OCR / Vision Model
                </label>
                <select
                  value={visionModel}
                  onChange={e => setVisionModel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0a0e1a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {(() => {
                    const getVisionModels = () => {
                      if (modelConfig?.teacherModelRestriction && Array.isArray(modelConfig.allowedVisionModels) && modelConfig.allowedVisionModels.length > 0) {
                        const allowed = new Set(modelConfig.allowedVisionModels.map((x: string) => x.toLowerCase()));
                        const filtered = availableModels.filter(m => allowed.has((m.ollamaName || m.name || '').toLowerCase()));
                        if (filtered.length > 0) return filtered;
                      }
                      return availableModels;
                    };
                    const vModels = getVisionModels();
                    if (vModels.length > 0) {
                      return vModels.map(m => {
                        const name = m.ollamaName || m.name || '';
                        const isVision = name.toLowerCase().includes('vision') || name.toLowerCase().includes('minicpm') || name.toLowerCase().includes('llava');
                        return (
                          <option key={name} value={name}>
                            {m.displayName || name} {isVision ? '👁️ (Vision)' : ''}
                          </option>
                        );
                      });
                    }
                    return (
                      <>
                        <option value="minicpm-v:8b">minicpm-v:8b (Aanbevolen)</option>
                        <option value="llava:7b">llava:7b</option>
                        <option value="llava:13b">llava:13b</option>
                        <option value="moondream:1.8b">moondream:1.8b</option>
                      </>
                    );
                  })()}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Nakijk / LLM Model
                </label>
                <select
                  value={gradingModel}
                  onChange={e => setGradingModel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0a0e1a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {(() => {
                    const getGradingModels = () => {
                      if (modelConfig?.teacherModelRestriction && Array.isArray(modelConfig.allowedModels) && modelConfig.allowedModels.length > 0) {
                        const allowed = new Set(modelConfig.allowedModels.map((x: string) => x.toLowerCase()));
                        const filtered = availableModels.filter(m => allowed.has((m.ollamaName || m.name || '').toLowerCase()));
                        if (filtered.length > 0) return filtered;
                      }
                      return availableModels;
                    };
                    const gModels = getGradingModels();
                    if (gModels.length > 0) {
                      return gModels.map(m => {
                        const name = m.ollamaName || m.name || '';
                        return (
                          <option key={name} value={name}>
                            {m.displayName || name}
                          </option>
                        );
                      });
                    }
                    return (
                      <>
                        <option value="llama3.1:8b">llama3.1:8b (Aanbevolen)</option>
                        <option value="mistral:7b">mistral:7b</option>
                        <option value="qwen2.5:7b">qwen2.5:7b</option>
                        <option value="phi3:mini">phi3:mini</option>
                      </>
                    );
                  })()}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="multimodal"
                checked={isMultimodal}
                onChange={e => setIsMultimodal(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#7c5cfc' }}
              />
              <label htmlFor="multimodal" style={{ fontSize: '0.85rem', color: '#e2e8f0', cursor: 'pointer' }}>
                <strong>Multimodaal nakijken inschakelen</strong> (stuurt uitsneden als afbeelding mee; essentieel voor wiskundige formules en scheikundige structuren)
              </label>
            </div>
          </div>

          {/* Return settings toggles */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '14px',
            padding: '18px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#38bdf8' }}>
              📤 Terugkoppeling naar Studentenportaal
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={returnGrade}
                  onChange={e => setReturnGrade(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                />
                <span>Cijfer / score tonen</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={returnFeedback}
                  onChange={e => setReturnFeedback(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                />
                <span>AI-feedback tonen</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={returnScan}
                  onChange={e => setReturnScan(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                />
                <span>Geredacteerde scan tonen</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={returnModelAnswer}
                  onChange={e => setReturnModelAnswer(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                />
                <span>Modelantwoord tonen</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={handleCreateSession}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(124, 92, 252, 0.4)'
              }}
            >
              {loading ? 'Bezig...' : 'Volgende: Upload & Vragen'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STAP 2: UPLOAD & VRAGEN ── */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Smart PDF Import Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(56, 189, 248, 0.12))',
            border: '1px solid rgba(124, 92, 252, 0.3)',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(124, 92, 252, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={22} color="#c4b5fd" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                  ⚡ Slimme AI PDF Invoer (Opgaven & Correctiemodel)
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Upload hieronder de originele toets (wat de leerling zag) of het correctiemodel PDF. De AI extraheert automatisch de vragen!
                </div>
              </div>
            </div>
          </div>

          {/* Grid of Uploaders: Assignment PDF + Rubric PDF */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 1. Assignment PDF (Wat de leerling ziet) */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.04)',
              border: '2px dashed rgba(56, 189, 248, 0.35)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              position: 'relative'
            }}>
              <input
                type="file"
                accept=".pdf"
                id="assignmentPdfUpload"
                style={{ display: 'none' }}
                disabled={assignmentUploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAssignmentFile(file);
                }}
              />
              <label htmlFor="assignmentPdfUpload" style={{ cursor: assignmentUploading ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={30} color="#38bdf8" />
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                  {assignmentUploading ? 'AI analyseert opgaven...' : assignmentUploadedName ? `✅ Opgaven: ${assignmentUploadedName}` : '📄 Toets / Opgaven PDF uploaden'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {assignmentUploadedName ? 'Opgaven succesvol geanalyseerd & gekoppeld!' : 'Upload wat de leerling ziet; de AI gebruikt deze vraagcontext bij nakijken!'}
                </div>
                <span style={{
                  marginTop: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {assignmentUploading ? 'Even geduld...' : 'Kies Opgaven PDF'}
                </span>
              </label>
            </div>

            {/* 2. Rubric / Correctiemodel PDF */}
            <div style={{
              background: 'rgba(124, 92, 252, 0.04)',
              border: '2px dashed rgba(124, 92, 252, 0.4)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              position: 'relative'
            }}>
              <input
                type="file"
                accept=".pdf"
                id="rubricPdfUpload"
                style={{ display: 'none' }}
                disabled={rubricUploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadRubricFile(file);
                }}
              />
              <label htmlFor="rubricPdfUpload" style={{ cursor: rubricUploading ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={30} color="#c4b5fd" />
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                  {rubricUploading ? 'AI extraheert correctiemodel...' : rubricUploadedName ? `✅ Correctiemodel: ${rubricUploadedName}` : '🎯 Correctiemodel PDF toevoegen'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {rubricUploadedName ? 'Modelantwoorden & criteria succesvol ingevuld!' : 'Vult automatisch alle vragen, modelantwoorden en criteria hieronder in!'}
                </div>
                <span style={{
                  marginTop: '4px',
                  background: 'rgba(124, 92, 252, 0.2)',
                  border: '1px solid rgba(124, 92, 252, 0.4)',
                  color: '#c4b5fd',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {rubricUploading ? 'Even geduld...' : 'Kies Correctiemodel PDF'}
                </span>
              </label>
            </div>
          </div>

          {/* 3. Gescande Toetsen PDF Upload Box */}
          <div style={{
            border: '2px dashed rgba(52, 211, 153, 0.4)',
            borderRadius: '16px',
            padding: '24px 20px',
            textAlign: 'center',
            background: 'rgba(52, 211, 153, 0.04)',
            cursor: 'pointer'
          }}>
            <input
              type="file"
              accept=".pdf"
              id="pdfUpload"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  setPdfFile(file);
                  setPdfUploaded(false);
                }
              }}
            />
            <label htmlFor="pdfUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Upload size={32} color="#34d399" />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                {pdfFile ? pdfFile.name : '📑 Gescande handgeschreven toetsen van de klas (PDF) uploaden *'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {pdfUploaded ? `✅ Geconverteerd naar ${pageCount} pagina's` : 'Gebundelde PDF-scan met alle ingevulde toetsen van de leerlingen'}
              </div>
            </label>
          </div>

          {/* Correctiemodel Vragen Tabel / Cards */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0' }}>
                  Vragen & Correctiemodel ({questions.length} vragen)
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Controleer of pas de vragen en modelantwoorden hieronder aan.
                </div>
              </div>

              <button
                onClick={() => setQuestions(prev => [...prev, { number: prev.length + 1, promptText: '', maxPoints: 2, modelAnswer: '', notes: '' }])}
                style={{
                  background: 'rgba(124, 92, 252, 0.15)',
                  border: '1px solid rgba(124, 92, 252, 0.3)',
                  color: '#c4b5fd',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} /> Vraag toevoegen
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: '#7c5cfc',
                        color: '#fff',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        {q.number}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Vraag {q.number}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Max punten:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={q.maxPoints}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 1;
                            setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, maxPoints: val } : item));
                          }}
                          style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', textAlign: 'center' }}
                        />
                      </div>

                      {questions.length > 1 && (
                        <button
                          onClick={() => setQuestions(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, number: i + 1 })))}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                          title="Vraag verwijderen"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vraagstelling / Opgave wat de leerling ziet */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#38bdf8', marginBottom: '4px', fontWeight: 600 }}>
                      📝 Opgave / Vraagstelling (wat de leerling op het toetsblad zag):
                    </label>
                    <textarea
                      rows={2}
                      placeholder="bv. Vraag 1: Bereken de versnelling tussen t=0 en t=5..."
                      value={q.promptText || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, promptText: val } : item));
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'rgba(10,14,26,0.6)', border: '1px solid rgba(56,189,248,0.25)', color: '#fff', fontSize: '0.84rem', resize: 'vertical' }}
                    />
                  </div>

                  {/* Modelantwoord volgens correctiemodel */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#c4b5fd', marginBottom: '4px', fontWeight: 600 }}>
                      🎯 Antwoord volgens correctiemodel / Sleutelbegrippen *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Wat is het juiste antwoord volgens het correctiemodel?"
                      value={q.modelAnswer}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, modelAnswer: val } : item));
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'rgba(10,14,26,0.6)', border: '1px solid rgba(124,92,252,0.3)', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>

                  {/* Criteria / extra instructies */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8', marginBottom: '4px' }}>
                      💡 Extra instructies / aftrekregels voor de AI (optioneel):
                    </label>
                    <input
                      type="text"
                      placeholder="bv. Reken rekenfouten half aan, eenheid verplicht, minteken = -0.5 pt"
                      value={q.notes || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, notes: val } : item));
                      }}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'rgba(10,14,26,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <button
              onClick={() => setCurrentStep(1)}
              style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={16} /> Terug
            </button>
            <button
              onClick={handleSaveStep2}
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? 'Bezig met uploaden & verwerken...' : 'Volgende: Leerling Koppeling'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STAP 3: LEERLING MAPPING ── */}
      {currentStep === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Stap 3A — Download voorgevuld template voor deze klas
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
              Download een Excel-lijst waarin alle leerlingen uit de gekozen klas al klaarstaan met naam en LocraID. Vul in Excel eenvoudig de start- en eindpagina per leerling in en upload het bestand hieronder.
            </p>
            <div>
              <button
                onClick={handleDownloadTemplate}
                style={{
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} /> Download Klas Template (.xlsx)
              </button>
            </div>
          </div>

          <div style={{
            border: '2px dashed rgba(56, 189, 248, 0.4)',
            borderRadius: '16px',
            padding: '30px',
            textAlign: 'center',
            background: 'rgba(56, 189, 248, 0.04)',
            cursor: 'pointer'
          }}>
            <input
              type="file"
              accept=".xlsx,.csv"
              id="mappingUpload"
              style={{ display: 'none' }}
              onChange={e => setMappingFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="mappingUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Users size={36} color="#38bdf8" />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                {mappingFile ? mappingFile.name : 'Upload ingevulde Excel of CSV mapping'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Bevat kolommen: Naam, LocraID, Startpagina, Eindpagina
              </div>
            </label>
          </div>

          {mappingSuccess && (
            <div style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', borderRadius: '10px', padding: '12px', color: '#34d399', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} /> {mappingSuccess}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <button
              onClick={() => setCurrentStep(2)}
              style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={16} /> Terug
            </button>
            <button
              onClick={handleUploadMapping}
              disabled={loading || !mappingFile}
              style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 700, cursor: (!mappingFile || loading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? 'Bezig met koppelen...' : 'Volgende: Anonimisering (Naam-redactie)'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STAP 4: ANONIMISERING CANVAS ── */}
      {currentStep === 4 && sessionId && (
        <div>
          <SlimCheckRedactCanvas
            sessionId={sessionId}
            token={token}
            onCompleted={() => setCurrentStep(5)}
          />
        </div>
      )}

      {/* ── STAP 5: AI PIPELINE PROCESS ── */}
      {currentStep === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(124, 92, 252, 0.2)', border: '2px solid #7c5cfc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 30px rgba(124, 92, 252, 0.4)' }}>
              <BrainCircuit size={40} color="#c4b5fd" className={(loading && scheduleResult?.status === 'processing') ? 'spin' : ''} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800 }}>
              AI Nakijk-pipeline starten
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', maxWidth: '560px', marginInline: 'auto' }}>
              Kies wanneer je de AI-nakijkpipeline wilt starten. Bij drukte kun je het nakijken inplannen op daluren zodat leerlingen niet worden vertraagd.
            </p>
          </div>

          {/* Server Status Indicators */}
          {queueStatus && !scheduleResult && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              maxWidth: '640px',
              margin: '0 auto',
              width: '100%'
            }}>
              {/* Traffic level */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Activity size={18} color={queueStatus.trafficLevel === 'druk' ? '#f87171' : queueStatus.trafficLevel === 'normaal' ? '#fbbf24' : '#34d399'} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Server</div>
                  <div style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: queueStatus.trafficLevel === 'druk' ? '#f87171' : queueStatus.trafficLevel === 'normaal' ? '#fbbf24' : '#34d399'
                  }}>
                    {queueStatus.trafficLevel === 'druk' ? '🔴 Druk' : queueStatus.trafficLevel === 'normaal' ? '🟡 Normaal' : '🟢 Rustig'}
                  </div>
                </div>
              </div>

              {/* Off-peak status */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Moon size={18} color={queueStatus.isOffPeak ? '#a78bfa' : '#64748b'} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daluren</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: queueStatus.isOffPeak ? '#a78bfa' : '#94a3b8' }}>
                    {queueStatus.isOffPeak ? '🌙 Nu actief' : '☀️ Piekuren'}
                  </div>
                </div>
              </div>

              {/* Queue depth */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Clock size={18} color={queueStatus.totalWaiting > 0 ? '#fbbf24' : '#34d399'} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wachtrij</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: queueStatus.totalWaiting > 0 ? '#fbbf24' : '#34d399' }}>
                    {queueStatus.totalWaiting === 0 ? '✅ Leeg' : `${queueStatus.totalWaiting} wachtend`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* If we are still choosing: Show 3 buttons */}
          {!scheduleResult && !loading && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              maxWidth: '800px',
              margin: '0 auto',
              width: '100%'
            }}>
              {/* Option 1: Nu nakijken */}
              <button
                onClick={() => handleStartPipeline('immediate')}
                style={{
                  background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.15), rgba(56, 189, 248, 0.1))',
                  border: '2px solid rgba(124, 92, 252, 0.4)',
                  borderRadius: '16px',
                  padding: '24px 20px',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'center',
                  transition: 'all 0.25s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#7c5cfc'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 25px rgba(124, 92, 252, 0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 92, 252, 0.4)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(124, 92, 252, 0.4)'
                }}>
                  <Zap size={26} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Nu nakijken</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Start direct met de AI-nakijkpipeline. Resultaten zijn snel beschikbaar.
                </div>
                {queueStatus && queueStatus.isProcessing && (
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                    ⚠️ Er is al een sessie bezig — je wordt in de wachtrij geplaatst
                  </div>
                )}
              </button>

              {/* Option 2: Binnen 24u daluren */}
              <button
                onClick={() => handleStartPipeline('offpeak_24h')}
                style={{
                  background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(124, 92, 252, 0.06))',
                  border: '2px solid rgba(167, 139, 250, 0.3)',
                  borderRadius: '16px',
                  padding: '24px 20px',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'center',
                  transition: 'all 0.25s ease'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#a78bfa'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 25px rgba(167, 139, 250, 0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167, 139, 250, 0.3)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(167, 139, 250, 0.3)'
                }}>
                  <Moon size={26} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Daluren (24u)</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Automatisch nakijken vannacht of bij eerstvolgende daluur. Minder belasting.
                </div>
                {queueStatus && (
                  <div style={{ fontSize: '0.72rem', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                    {queueStatus.isOffPeak
                      ? '🌙 Nu daluren — start snel!'
                      : `⏰ Volgende daluur: ${new Date(queueStatus.nextOffPeakDate).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} vanavond`}
                  </div>
                )}
              </button>

              {/* Option 3: Binnen 7 dagen daluren */}
              <button
                onClick={() => handleStartPipeline('offpeak_7d')}
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(52, 211, 153, 0.06))',
                  border: '2px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '16px',
                  padding: '24px 20px',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'center',
                  transition: 'all 0.25s ease'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#38bdf8'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 25px rgba(56, 189, 248, 0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56, 189, 248, 0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8, #34d399)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)'
                }}>
                  <CalendarClock size={26} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Weekend (7d)</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Nakijken in het weekend wanneer de server het rustigst is. Maximale capaciteit.
                </div>
                {queueStatus && (
                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                    📅 Gepland: {new Date(queueStatus.nextWeekendOffPeakDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Scheduled/Queued Confirmation */}
          {scheduleResult && (scheduleResult.status === 'scheduled' || scheduleResult.status === 'queued') && (
            <div style={{
              maxWidth: '580px',
              margin: '0 auto',
              width: '100%',
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              alignItems: 'center'
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'rgba(167, 139, 250, 0.15)',
                border: '2px solid rgba(167, 139, 250, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CalendarClock size={28} color="#a78bfa" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#e2e8f0' }}>
                {scheduleResult.status === 'queued' ? '⏳ In de wachtrij' : '📅 Ingepland'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#c4b5fd', fontWeight: 600 }}>
                {scheduleResult.message}
              </div>
              {scheduleResult.queuePosition > 0 && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Wachtrij positie: <strong style={{ color: '#fbbf24' }}>#{scheduleResult.queuePosition}</strong>
                </div>
              )}
              {scheduleResult.scheduledFor && scheduleResult.status === 'scheduled' && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Start op: <strong style={{ color: '#a78bfa' }}>
                    {new Date(scheduleResult.scheduledFor).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' om '}
                    {new Date(scheduleResult.scheduledFor).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleCancelSchedule}
                  style={{
                    background: 'rgba(248, 113, 113, 0.12)',
                    border: '1px solid rgba(248, 113, 113, 0.4)',
                    color: '#f87171',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <XCircle size={16} /> Annuleren
                </button>
                <button
                  onClick={() => onFinish(sessionId!)}
                  style={{
                    background: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    color: '#34d399',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle size={16} /> Sluit wizard — Later terugkeren
                </button>
              </div>
            </div>
          )}

          {/* Processing: Live Progress Bar */}
          {(loading && scheduleResult?.status === 'processing') && (
            <div style={{
              maxWidth: '540px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#c4b5fd', fontWeight: 600 }}>
                <span>{pipelineProgress.message}</span>
                <span>{pipelineProgress.percent}%</span>
              </div>
              <div style={{ height: '14px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pipelineProgress.percent}%`,
                  background: 'linear-gradient(90deg, #7c5cfc, #38bdf8, #34d399)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={18} className="spin" />
                Pipeline is bezig... U kunt deze pagina open laten staan of later terugkeren.
              </div>
            </div>
          )}

          {/* Loading spinner while submitting choice */}
          {loading && !scheduleResult && (
            <div style={{ textAlign: 'center', color: '#c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}>
              <Loader2 size={20} className="spin" /> Verwerking wordt gestart...
            </div>
          )}

          {/* Terug button */}
          {!loading && !scheduleResult && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <button
                onClick={() => setCurrentStep(4)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ArrowLeft size={16} /> Terug
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
