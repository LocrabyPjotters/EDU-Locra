import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../store/authStore';
import {
  Sparkles, X, Loader2, ArrowRight, FileText, UploadCloud,
  Database, FolderOpen, Check, AlertCircle, Brain, Sliders, Cpu, Moon
} from 'lucide-react';

import type { LiveGenerationJob } from './LiveAiProgressView';

interface LiveAiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobStarted: (job: LiveGenerationJob) => void;
}

interface AttachedDocument {
  id: string;
  filename: string;
  wordCount: number;
  pages?: number;
  preview: string;
  text: string;
}

const SUBJECT_SUGGESTIONS = [
  'Geschiedenis', 'Aardrijkskunde', 'Biologie', 'Nederlands', 'Engels',
  'Frans', 'Duits', 'Wiskunde', 'Natuurkunde', 'Scheikunde', 'Informatica',
  'Economie', 'Maatschappijleer', 'Burgerschap', 'NLT', 'Rekenen', 'Algemeen'
];

const GRADE_PRESETS = [
  'Groep 7/8',
  '1-2 VMBO',
  '3-4 VMBO',
  '1-2 HAVO/VWO',
  '3 HAVO',
  '4-5 HAVO',
  '3 VWO',
  '4-6 VWO',
  'MBO Niveau 3/4',
  'HBO / WO'
];

export default function LiveAiGeneratorModal({
  isOpen,
  onClose,
  onJobStarted
}: LiveAiGeneratorModalProps) {
  const token = useAuthStore(s => s.token);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Basisinstellingen (vrij invulbaar!)
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Geschiedenis');
  const [targetGrade, setTargetGrade] = useState('3 HAVO');
  const [mode, setMode] = useState<'hybrid' | 'arcade' | 'formative'>('hybrid');

  // Vraagkwaliteit & Didactische Diepgang
  const [difficultyLevel, setDifficultyLevel] = useState<'basis' | 'gemiddeld' | 'uitdagend' | 'expert'>('gemiddeld');
  const [cognitiveFocus, setCognitiveFocus] = useState<'rtti_mix' | 'reproductie' | 'begrip_en_inzicht' | 'toepassing_en_casus'>('rtti_mix');
  const [questionQualityMode, setQuestionQualityMode] = useState<'high' | 'fast'>('high');
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'offpeak'>('immediate');
  const [autoPriority, setAutoPriority] = useState(true);
  const [userPriority, setUserPriority] = useState<number>(6);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [teacherInstructions, setTeacherInstructions] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');

  // Slide-opbouw
  const [numTheorySlides, setNumTheorySlides] = useState(2);
  const [numMCQuestions, setNumMCQuestions] = useState(3);
  const [numTFQuestions, setNumTFQuestions] = useState(1);
  const [numOpenQuestions, setNumOpenQuestions] = useState(1);
  const [numWordclouds, setNumWordclouds] = useState(1);
  const [autoFindImages, setAutoFindImages] = useState(true);
  const [includeRichBlocks, setIncludeRichBlocks] = useState(true);

  // Bronnen: RAG, Klasmateriaal, Geüploade Documenten & Tekst
  const [sourcesTab, setSourcesTab] = useState<'upload' | 'rag' | 'materials' | 'paste'>('upload');
  const [ragLicensed, setRagLicensed] = useState<boolean>(true);
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [expandedKbIds, setExpandedKbIds] = useState<string[]>([]);
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedText, setUploadedText] = useState('');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    setError(null);

    // Laad RAG kennisbanken + documenten, klasmateriaal en modellen via /api/live/sources
    fetch('/api/live/sources', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async r => {
        if (!r.ok) throw new Error('sources fallback');
        return r.json();
      })
      .then(d => {
        setRagLicensed(Boolean(d.ragLicensed));
        setKnowledgeBases(Array.isArray(d.knowledgeBases) ? d.knowledgeBases : []);
        setClassMaterials(Array.isArray(d.classMaterials) ? d.classMaterials : []);
        setAvailableModels(Array.isArray(d.models) ? d.models : []);
      })
      .catch(() => {
        // Fallback op /api/knowledge (retourneert direct een array!)
        fetch('/api/knowledge', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(async r => {
            if (r.status === 403) {
              setRagLicensed(false);
              return [];
            }
            return r.json();
          })
          .then(d => {
            if (Array.isArray(d)) {
              setKnowledgeBases(d);
            } else if (d && Array.isArray(d.knowledgeBases)) {
              setKnowledgeBases(d.knowledgeBases);
            }
          })
          .catch(() => {});
      });
  }, [isOpen, token]);

  if (!isOpen) return null;

  const hasAnySource =
    selectedKbIds.length > 0 ||
    selectedDocIds.length > 0 ||
    selectedMaterialIds.length > 0 ||
    attachedDocs.length > 0 ||
    uploadedText.trim().length > 0;

  const totalSelectedSourcesCount =
    selectedKbIds.length +
    selectedDocIds.length +
    selectedMaterialIds.length +
    attachedDocs.length +
    (uploadedText.trim().length > 0 ? 1 : 0);

  const toggleKbSelection = (kbId: string) => {
    setSelectedKbIds(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    );
  };

  const toggleKbExpand = (kbId: string) => {
    setExpandedKbIds(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    );
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const toggleMaterialSelection = (matId: string) => {
    setSelectedMaterialIds(prev =>
      prev.includes(matId) ? prev.filter(id => id !== matId) : [...prev, matId]
    );
  };

  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingDoc(true);
    setError(null);

    const newDocs: AttachedDocument[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/live/extract-document', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Kon "${file.name}" niet uitlezen.`);
        }

        newDocs.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          filename: data.filename || file.name,
          wordCount: data.wordCount || 0,
          pages: data.pages,
          preview: data.preview || '',
          text: data.text || ''
        });
      } catch (err: any) {
        setError(err.message || `Fout bij verwerken van ${file.name}`);
      }
    }

    if (newDocs.length > 0) {
      setAttachedDocs(prev => [...prev, ...newDocs]);
    }
    setUploadingDoc(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !hasAnySource) {
      setError('Vul een onderwerp/leerdoel in óf koppel eerst een document of RAG-kennisbank.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/live/generate-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim() || 'Algemeen',
          targetGrade: targetGrade.trim() || 'Voortgezet Onderwijs',
          mode,
          difficultyLevel,
          cognitiveFocus,
          questionQualityMode,
          scheduleMode,
          userPriority: scheduleMode === 'offpeak' && !autoPriority ? userPriority : null,
          deadlineAt: scheduleMode === 'offpeak' && deadlineAt ? new Date(deadlineAt).toISOString() : null,
          autoSaveLesson: scheduleMode === 'offpeak',
          teacherInstructions: teacherInstructions.trim() || undefined,
          modelId: selectedModelId || undefined,
          numTheorySlides,
          numMCQuestions,
          numTFQuestions,
          numOpenQuestions,
          numWordclouds,
          autoFindImages,
          includeRichBlocks,
          knowledgeBaseIds: selectedKbIds,
          documentIds: selectedDocIds,
          classMaterialIds: selectedMaterialIds,
          attachedDocuments: attachedDocs.map(d => ({ filename: d.filename, text: d.text })),
          uploadedText: uploadedText.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kon AI-taak niet starten');

      if (data.job) {
        onJobStarted(data.job);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fout bij starten van de lesgeneratie');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 20, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.25rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(22, 28, 48, 0.99), rgba(11, 15, 31, 0.99))',
        border: '1px solid rgba(124, 92, 252, 0.4)',
        borderRadius: '26px',
        width: '100%',
        maxWidth: '780px',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '2rem',
        boxShadow: '0 30px 90px -15px rgba(0, 0, 0, 0.85), 0 0 45px rgba(124, 92, 252, 0.22)',
        position: 'relative',
        color: '#fff'
      }}>
        {/* Sluitknop */}
        <button
          type="button"
          onClick={onClose}
          disabled={generating}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.65)',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: generating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124, 92, 252, 0.4)',
            flexShrink: 0
          }}>
            <Sparkles size={26} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
              Locra AI Les & Quiz Generator
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              Koppel documenten of RAG-kennisbanken, stel je eigen niveau in en genereer diepgaande lesvragen.
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.16)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            color: '#fca5a5',
            fontSize: '0.86rem',
            marginBottom: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* 1. Onderwerp / Leerdoel */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem' }}>
              <span>
                Onderwerp of Leerdoel {hasAnySource ? '(optioneel bij gekoppeld document/RAG)' : '*'}
              </span>
              {hasAnySource && (
                <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                  ✓ {totalSelectedSourcesCount} {totalSelectedSourcesCount === 1 ? 'bron' : 'bronnen'} actief
                </span>
              )}
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={hasAnySource ? 'Optioneel: specifiek hoofdstuk/focus uit je bron, of laat leeg voor hele document...' : 'Bijv. De Industriële Revolutie, Fotosynthese bij planten, Lineaire functies'}
              autoFocus
              disabled={generating}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(10, 14, 26, 0.78)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '12px',
                padding: '0.82rem 1rem',
                color: '#fff',
                fontSize: '0.94rem',
                outline: 'none'
              }}
            />
          </div>

          {/* 2. Vak & Vrij Invulbaar Niveau */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem' }}>
                Vak (vrij aanpasbaar)
              </label>
              <input
                type="text"
                list="locra-live-subjects"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={generating}
                placeholder="Typ een vak of kies..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.88)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '12px',
                  padding: '0.78rem 0.95rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <datalist id="locra-live-subjects">
                {SUBJECT_SUGGESTIONS.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem' }}>
                Niveau & Leerjaar (zelf invullen of kiezen)
              </label>
              <input
                type="text"
                list="locra-live-grades"
                value={targetGrade}
                onChange={e => setTargetGrade(e.target.value)}
                disabled={generating}
                placeholder="Bijv. Groep 8, 4 VWO Wiskunde B, MBO-4..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.88)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '12px',
                  padding: '0.78rem 0.95rem',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <datalist id="locra-live-grades">
                {GRADE_PRESETS.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>
          </div>

          {/* Snelle Niveau Presets onder het invulveld */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '-0.55rem' }}>
            {GRADE_PRESETS.map(lvl => {
              const active = targetGrade.trim().toLowerCase() === lvl.toLowerCase();
              return (
                <button
                  key={lvl}
                  type="button"
                  disabled={generating}
                  onClick={() => setTargetGrade(lvl)}
                  style={{
                    background: active ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    border: active ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: active ? '#7dd3fc' : 'rgba(255, 255, 255, 0.65)',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* 3. DOCUMENTEN & RAG KENNISBANK KOPPELEN (Altijd direct zichtbaar) */}
          <div style={{
            background: 'rgba(10, 15, 32, 0.72)',
            border: hasAnySource ? '1.5px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(124, 92, 252, 0.3)',
            borderRadius: '18px',
            padding: '1rem 1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={17} color="#34d399" />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#e2e8f0' }}>
                  Documenten & RAG Kennisbank Koppelen
                </span>
                {totalSelectedSourcesCount > 0 && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.22)', color: '#6ee7b7', borderRadius: '999px', padding: '2px 9px', fontSize: '0.71rem', fontWeight: 800 }}>
                    {totalSelectedSourcesCount} gekoppeld
                  </span>
                )}
              </div>

              {/* Bron-Tabs */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: '10px' }}>
                {[
                  { id: 'upload', label: '📄 Upload PDF/Word', count: attachedDocs.length },
                  { id: 'rag', label: '🧠 RAG Kennisbank', count: selectedKbIds.length + selectedDocIds.length },
                  ...(classMaterials.length > 0 ? [{ id: 'materials', label: '📎 Klasmateriaal', count: selectedMaterialIds.length }] : []),
                  { id: 'paste', label: '📝 Plak tekst', count: uploadedText.trim() ? 1 : 0 }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSourcesTab(t.id as any)}
                    style={{
                      background: sourcesTab === t.id ? 'rgba(124, 92, 252, 0.35)' : 'transparent',
                      border: sourcesTab === t.id ? '1px solid rgba(124, 92, 252, 0.6)' : '1px solid transparent',
                      color: sourcesTab === t.id ? '#fff' : 'rgba(255,255,255,0.65)',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{t.label}</span>
                    {t.count > 0 && (
                      <span style={{ background: '#10b981', color: '#052e16', borderRadius: '999px', padding: '0 5px', fontSize: '0.67rem', fontWeight: 900 }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab A: Direct Uploaden */}
            {sourcesTab === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.csv,.rtf,.json"
                  onChange={e => handleFilesUpload(e.target.files)}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => !uploadingDoc && !generating && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (!uploadingDoc && !generating) handleFilesUpload(e.dataTransfer.files);
                  }}
                  style={{
                    border: dragOver ? '2px dashed #38bdf8' : '2px dashed rgba(255, 255, 255, 0.16)',
                    background: dragOver ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.025)',
                    borderRadius: '14px',
                    padding: '1rem',
                    textAlign: 'center',
                    cursor: uploadingDoc || generating ? 'wait' : 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                >
                  {uploadingDoc ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#7dd3fc', fontSize: '0.86rem', fontWeight: 700 }}>
                      <Loader2 size={18} className="spin" />
                      <span>Document tekst wordt uitgelezen...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <UploadCloud size={22} color="#38bdf8" />
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0' }}>
                        Klik of sleep hier je lesdocument(en) naartoe
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.52)' }}>
                        Ondersteund: PDF, Word (.docx/.doc), TXT, Markdown, CSV, RTF (meerdere bestanden mogelijk)
                      </div>
                    </div>
                  )}
                </div>

                {attachedDocs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.7rem' }}>
                    {attachedDocs.map(doc => (
                      <div
                        key={doc.id}
                        style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(52, 211, 153, 0.35)',
                          borderRadius: '10px',
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <FileText size={15} color="#34d399" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#a7f3d0' }}>
                              {doc.wordCount.toLocaleString('nl-NL')} woorden {doc.pages ? `• ${doc.pages} pagina's` : ''}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachedDocs(prev => prev.filter(d => d.id !== doc.id))}
                          style={{ background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Document verwijderen"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab B: RAG Kennisbanken & Specifieke RAG-documenten */}
            {sourcesTab === 'rag' && (
              <div>
                {!ragLicensed ? (
                  <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.8rem', color: '#fde68a' }}>
                    Centrale school-RAG kennisbanken vereisen een EDU-Plus licentie. Je kunt via <strong>"Upload PDF/Word"</strong> direct je eigen documenten uploaden!
                  </div>
                ) : knowledgeBases.length === 0 ? (
                  <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    Er zijn nog geen RAG-kennisbanken in jouw schoolomgeving. Upload je eigen PDF/Word via het tabblad <strong>Upload PDF/Word</strong>!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '190px', overflowY: 'auto' }}>
                    {knowledgeBases.map(kb => {
                      const kbSelected = selectedKbIds.includes(kb.id);
                      const kbExpanded = expandedKbIds.includes(kb.id);
                      const docs = Array.isArray(kb.documents) ? kb.documents : [];
                      const docCount = docs.length || kb._count?.documents || 0;

                      return (
                        <div
                          key={kb.id}
                          style={{
                            background: kbSelected ? 'rgba(124, 92, 252, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                            border: kbSelected ? '1px solid rgba(124, 92, 252, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '8px 12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={kbSelected}
                                onChange={() => toggleKbSelection(kb.id)}
                                style={{ accentColor: '#7c5cfc' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                  {kb.name}
                                </div>
                                <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.55)' }}>
                                  {kb.subject || 'Algemeen'} • {docCount} {docCount === 1 ? 'document' : 'documenten'}
                                </div>
                              </div>
                            </label>

                            {docs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleKbExpand(kb.id)}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                {kbExpanded ? 'Verberg docs ▲' : `Kies doc (${docs.length}) ▼`}
                              </button>
                            )}
                          </div>

                          {kbExpanded && docs.length > 0 && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '1.2rem' }}>
                              {docs.map((d: any) => {
                                const docSelected = selectedDocIds.includes(d.id);
                                return (
                                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#e2e8f0', cursor: 'pointer' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input
                                        type="checkbox"
                                        checked={docSelected}
                                        onChange={() => toggleDocSelection(d.id)}
                                        style={{ accentColor: '#38bdf8' }}
                                      />
                                      <span>{d.filename}</span>
                                    </span>
                                    <span style={{ fontSize: '0.67rem', color: d._count?.chunks > 0 ? '#6ee7b7' : '#fcd34d' }}>
                                      {d._count?.chunks > 0 ? `${d._count.chunks} RAG-blokken` : 'direct lezen'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab C: Klasmateriaal */}
            {sourcesTab === 'materials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '175px', overflowY: 'auto' }}>
                {classMaterials.map(mat => {
                  const selected = selectedMaterialIds.includes(mat.id);
                  return (
                    <label
                      key={mat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: selected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255,255,255,0.03)',
                        border: selected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '7px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMaterialSelection(mat.id)}
                          style={{ accentColor: '#38bdf8' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{mat.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>
                            <FolderOpen size={11} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                            Klas {mat.className} • {mat.filename}
                          </div>
                        </div>
                      </span>
                      {selected && <Check size={15} color="#38bdf8" />}
                    </label>
                  );
                })}
              </div>
            )}

            {/* Tab D: Plak tekst */}
            {sourcesTab === 'paste' && (
              <textarea
                rows={4}
                value={uploadedText}
                onChange={e => setUploadedText(e.target.value)}
                placeholder="Plak hier rechtstreeks een paragraaf uit het leerboek, samenvatting of examenbron..."
                disabled={generating}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            )}
          </div>

          {/* 4. VRAAGKWALITEIT, MOEILIJKHEID & TAXONOMIE */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Brain size={17} color="#c4b5fd" />
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#e2e8f0' }}>
                  Vraagkwaliteit, Taxonomie & Moeilijkheid
                </span>
              </div>

              {/* Extra AI-Kwaliteitscheck Toggle */}
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: questionQualityMode === 'high' ? 'rgba(124, 92, 252, 0.2)' : 'rgba(255,255,255,0.04)',
                border: questionQualityMode === 'high' ? '1px solid rgba(168, 85, 247, 0.55)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '999px',
                padding: '4px 11px',
                fontSize: '0.73rem',
                fontWeight: 700,
                color: questionQualityMode === 'high' ? '#e9d5ff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={questionQualityMode === 'high'}
                  onChange={e => setQuestionQualityMode(e.target.checked ? 'high' : 'fast')}
                  style={{ accentColor: '#a855f7' }}
                />
                <span>✨ Dubbele AI-Kwaliteitscontrole</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              <div>
                <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', marginBottom: '5px', fontWeight: 600 }}>
                  Moeilijkheidsgraad
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                  {[
                    { id: 'basis', label: 'Basis', color: '#4ade80' },
                    { id: 'gemiddeld', label: 'Normaal', color: '#38bdf8' },
                    { id: 'uitdagend', label: 'Pittig', color: '#c084fc' },
                    { id: 'expert', label: 'Expert', color: '#f87171' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficultyLevel(d.id as any)}
                      style={{
                        background: difficultyLevel === d.id ? `${d.color}25` : 'rgba(0,0,0,0.3)',
                        border: difficultyLevel === d.id ? `1.5px solid ${d.color}` : '1px solid rgba(255,255,255,0.08)',
                        color: difficultyLevel === d.id ? d.color : 'rgba(255,255,255,0.68)',
                        borderRadius: '9px',
                        padding: '6px 4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', marginBottom: '5px', fontWeight: 600 }}>
                  Didactische Nadruk (RTTI)
                </div>
                <select
                  value={cognitiveFocus}
                  onChange={e => setCognitiveFocus(e.target.value as any)}
                  disabled={generating}
                  style={{
                    width: '100%',
                    background: 'rgba(10, 14, 26, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="rtti_mix">⚖️ Gebalanceerde RTTI-mix (R1/R2/T1/T2)</option>
                  <option value="reproductie">📘 Begrippen & Feitenkennis (R1/R2)</option>
                  <option value="begrip_en_inzicht">💡 Inzicht & Denkfouten Ontmaskeren (R2/T1)</option>
                  <option value="toepassing_en_casus">🔍 Casussen, Bronnen & Toepassing (T1/T2)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: availableModels.length > 0 ? '1.3fr 1fr' : '1fr', gap: '0.75rem' }}>
              <input
                type="text"
                value={teacherInstructions}
                onChange={e => setTeacherInstructions(e.target.value)}
                disabled={generating}
                placeholder="Optionele instructie: bijv. 'Gebruik bronvragen', 'Focus op §3.2', 'Verwerk rekenopgave'..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '7px 11px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />

              {availableModels.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(10, 14, 26, 0.72)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0 10px' }}>
                  <Cpu size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <select
                    value={selectedModelId}
                    onChange={e => setSelectedModelId(e.target.value)}
                    disabled={generating}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.78rem',
                      padding: '7px 0',
                      outline: 'none'
                    }}
                  >
                    <option value="" style={{ background: '#0f172a' }}>AI Model: Automatisch (Beste)</option>
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id} style={{ background: '#0f172a' }}>
                        {m.displayName || m.ollamaName} ({m.provider})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 5. DIDACTISCHE MODUS & SAMENSTELLING */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
            {[
              { id: 'hybrid', label: '⚡ Locra Hybride', desc: 'Theorie, gedachtenwolk & quiz' },
              { id: 'arcade', label: '🎮 Locra Arena', desc: 'Timers, streaks & hoog tempo' },
              { id: 'formative', label: '📖 Locra Presentor', desc: 'Diepe dialoog & reflectie' }
            ].map(m => (
              <div
                key={m.id}
                onClick={() => !generating && setMode(m.id as any)}
                style={{
                  border: mode === m.id ? '2px solid #7c5cfc' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: mode === m.id ? 'rgba(124, 92, 252, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '14px',
                  padding: '0.68rem 0.85rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: mode === m.id ? '#c4b5fd' : '#fff', marginBottom: '2px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.55)' }}>
                  {m.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Aantallen & Verrijking */}
          <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '14px', padding: '0.9rem 1rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.65rem' }}>
              <Sliders size={14} color="#a5b4fc" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)' }}>Inhoudelijke opbouw:</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              {[
                { label: 'Theorie', val: numTheorySlides, set: setNumTheorySlides, min: 0, max: 6 },
                { label: 'Meerkeuze', val: numMCQuestions, set: setNumMCQuestions, min: 0, max: 12 },
                { label: 'Waar/Niet', val: numTFQuestions, set: setNumTFQuestions, min: 0, max: 8 },
                { label: 'Open Vraag', val: numOpenQuestions, set: setNumOpenQuestions, min: 0, max: 6 },
                { label: 'Wolk', val: numWordclouds, set: setNumWordclouds, min: 0, max: 4 }
              ].map(c => (
                <div key={c.label}>
                  <label style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '4px' }}>{c.label}</label>
                  <input
                    type="number"
                    min={c.min}
                    max={c.max}
                    value={c.val}
                    onChange={e => c.set(Math.max(c.min, parseInt(e.target.value, 10) || 0))}
                    disabled={generating}
                    style={{ width: '50px', textAlign: 'center', padding: '5px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.9rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: autoFindImages ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255,255,255,0.03)',
                border: autoFindImages ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '0.6rem 0.75rem',
                cursor: generating ? 'not-allowed' : 'pointer',
                fontSize: '0.77rem'
              }}>
                <input
                  type="checkbox"
                  checked={autoFindImages}
                  onChange={e => setAutoFindImages(e.target.checked)}
                  disabled={generating}
                  style={{ accentColor: '#38bdf8' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#7dd3fc' }}>🖼️ Automatisch plaatjes vinden</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>Zoekt passende foto's & illustraties</div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: includeRichBlocks ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255,255,255,0.03)',
                border: includeRichBlocks ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '0.6rem 0.75rem',
                cursor: generating ? 'not-allowed' : 'pointer',
                fontSize: '0.77rem'
              }}>
                <input
                  type="checkbox"
                  checked={includeRichBlocks}
                  onChange={e => setIncludeRichBlocks(e.target.checked)}
                  disabled={generating}
                  style={{ accentColor: '#34d399' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#6ee7b7' }}>📦 Rijke informatieve blokken</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>Leerdoel, kernbegrip, casus & denkfout</div>
                </div>
              </label>
            </div>
          </div>

          {/* 6. PLANNING / DALUREN OPTIE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.65rem',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '0.75rem'
          }}>
            <button
              type="button"
              onClick={() => !generating && setScheduleMode('immediate')}
              style={{
                textAlign: 'left',
                border: scheduleMode === 'immediate' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                background: scheduleMode === 'immediate' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(0, 0, 0, 0.28)',
                borderRadius: '11px',
                padding: '0.6rem 0.8rem',
                cursor: 'pointer',
                color: '#fff'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: scheduleMode === 'immediate' ? '#7dd3fc' : '#e2e8f0' }}>
                ⚡ Direct starten in AI Studio
              </div>
              <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.58)', marginTop: '2px' }}>
                Volgt realtime voortgang — breekt nooit af op tijd (mag rustig 30–60 min duren).
              </div>
            </button>

            <button
              type="button"
              onClick={() => !generating && setScheduleMode('offpeak')}
              style={{
                textAlign: 'left',
                border: scheduleMode === 'offpeak' ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                background: scheduleMode === 'offpeak' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0, 0, 0, 0.28)',
                borderRadius: '11px',
                padding: '0.6rem 0.8rem',
                cursor: 'pointer',
                color: '#fff'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: scheduleMode === 'offpeak' ? '#d8b4fe' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Moon size={13} />
                <span>In daluren-wachtrij zetten (optie)</span>
              </div>
              <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.58)', marginTop: '2px' }}>
                Zet les in de rij om in minder drukke uren (data-analyse) op te bouwen &amp; na te kijken.
              </div>
            </button>

            {scheduleMode === 'offpeak' && (
              <div style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                paddingTop: '0.6rem',
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#ddd6fe' }}>Prioriteit (1–10)</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#7dd3fc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={autoPriority} onChange={e => setAutoPriority(e.target.checked)} />
                      <span>Auto (AI)</span>
                    </label>
                  </div>
                  {!autoPriority ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '3px' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setUserPriority(n)}
                          style={{
                            padding: '4px 0', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                            background: userPriority === n ? '#7c5cfc' : 'rgba(0,0,0,0.4)',
                            border: userPriority === n ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                            color: '#fff'
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.58)' }}>
                      AI schat automatisch de prioriteit, duur &amp; beste daluur-slot in.
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6ee7b7', marginBottom: '5px' }}>
                    Deadline (voor wanneer af?)
                  </div>
                  <input
                    type="datetime-local"
                    value={deadlineAt}
                    onChange={e => setDeadlineAt(e.target.value)}
                    disabled={generating}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '5px 8px', color: '#fff', fontSize: '0.76rem'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actieknoppen */}
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={generating || (!topic.trim() && !hasAnySource)}
              style={{
                flex: 2,
                background: scheduleMode === 'offpeak'
                  ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                  : 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
                border: 'none',
                color: '#fff',
                padding: '0.88rem',
                borderRadius: '12px',
                fontSize: '0.94rem',
                fontWeight: 800,
                cursor: generating || (!topic.trim() && !hasAnySource) ? 'not-allowed' : 'pointer',
                opacity: generating || (!topic.trim() && !hasAnySource) ? 0.55 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                boxShadow: '0 6px 24px rgba(124, 92, 252, 0.45)'
              }}
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>{scheduleMode === 'offpeak' ? 'In wachtrij plaatsen...' : 'AI-werkruimte starten...'}</span>
                </>
              ) : scheduleMode === 'offpeak' ? (
                <>
                  <Moon size={18} />
                  <span>Les in Daluren-Wachtrij Zetten</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Genereer Hoogwaardige Les & Quiz</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
