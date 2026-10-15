import { useState } from 'react';
import {
  X, Sparkles, Trash2, Search, Lock, SlidersHorizontal, BarChart2
} from 'lucide-react';

interface Question {
  id: string;
  type: 'multiple_choice' | 'open';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
  explanation?: string;
  imageUrl?: string;
  imageAlt?: string;
  difficulty?: 'Basis' | 'Gemiddeld' | 'Uitdagend' | 'Expert' | string;
  rtti?: 'R1' | 'R2' | 'T1' | 'T2' | string;
}

interface Props {
  token: string;
  classes: any[];
  editExam?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function ExamBuilderModal({ token, classes, editExam, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'ai' | 'questions' | 'settings'>('ai');

  // AI Generator inputs
  const [subject, setSubject] = useState(editExam?.subject || 'Biologie');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('3 VWO');
  const [numMultipleChoice, setNumMultipleChoice] = useState(3);
  const [numOpen, setNumOpen] = useState(2);
  const [sourceText, setSourceText] = useState('');
  const [includeImages, setIncludeImages] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Moeilijkheidsgraad & Taxonomie (RTTI)
  const [difficultyMode, setDifficultyMode] = useState<'slider' | 'rtti'>('slider');
  const [difficultyLevel, setDifficultyLevel] = useState<number>(2); // 1 = Basis, 2 = Gemiddeld, 3 = Uitdagend, 4 = Expert
  const [rttiDistribution, setRttiDistribution] = useState<{ r1: number; r2: number; t1: number; t2: number }>({
    r1: 30,
    r2: 30,
    t1: 25,
    t2: 15
  });

  // Toets inhoud
  const [title, setTitle] = useState(editExam?.title || '');
  const [description, setDescription] = useState(editExam?.description || '');
  const [classId, setClassId] = useState(editExam?.classId || '');
  const [questions, setQuestions] = useState<Question[]>(() => {
    if (editExam?.questionsJson) {
      try { return JSON.parse(editExam.questionsJson); } catch (e) { return []; }
    }
    return [];
  });

  // Beveiliging & Instellingen
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>(editExam?.timeLimitMinutes ? String(editExam.timeLimitMinutes) : '');
  const [hasPassword, setHasPassword] = useState<boolean>(Boolean(editExam?.accessCode));
  const [accessCode, setAccessCode] = useState<string>(editExam?.accessCode || '');
  const [allowTabSwitch, setAllowTabSwitch] = useState<boolean>(editExam?.allowTabSwitch ?? false);
  const [maxTabSwitchViolations, setMaxTabSwitchViolations] = useState<number>(editExam?.maxTabSwitchViolations ?? 3);
  const [forceFullscreen, setForceFullscreen] = useState<boolean>(editExam?.forceFullscreen ?? false);
  const [disableCopyPaste, setDisableCopyPaste] = useState<boolean>(editExam?.disableCopyPaste ?? true);
  const [aiAssistanceMode, setAiAssistanceMode] = useState<'disabled' | 'hints' | 'full'>(editExam?.aiAssistanceMode || 'disabled');
  const [maxAiHints, setMaxAiHints] = useState<number>(editExam?.maxAiHints ?? 3);
  const [examStatus, setExamStatus] = useState<'draft' | 'active' | 'closed'>(editExam?.status || 'active');

  // Afbeeldingen zoeker drawer state
  const [searchImageModalQuestionId, setSearchImageModalQuestionId] = useState<string | null>(null);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);

  // 1. AI Toets genereren
  const handleGenerateAI = async () => {
    if (!topic.trim() && !sourceText.trim()) {
      setGenerateError('Vul een onderwerp of brontekst in');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          topic,
          level,
          numMultipleChoice,
          numOpen,
          sourceText,
          includeImages,
          difficultyMode,
          difficultyLevel,
          rttiDistribution
        })
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Onverwacht antwoord van de AI generator. Probeer het opnieuw met minder vragen of een beknoptere brontekst.');
      }
      if (!res.ok) throw new Error(data.error || 'Genereren mislukt');

      setTitle(data.title || `Toets ${subject}: ${topic}`);
      setDescription(data.description || '');
      setQuestions(data.questions || []);
      setActiveTab('questions'); // Ga direct naar vragen editor
    } catch (err: any) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // 2. Afbeeldingen zoeken via web search
  const handleSearchImages = async (q: string) => {
    if (!q.trim()) return;
    setIsSearchingImages(true);
    try {
      const res = await fetch(`/api/exams/search-images?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setImageSearchResults(data.results || []);
      }
    } catch (e) {
      /* silent */
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleSelectImageForQuestion = (qId: string, img: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          imageUrl: img.url,
          imageAlt: img.title
        };
      }
      return q;
    }));
    setSearchImageModalQuestionId(null);
    setImageSearchResults([]);
  };

  // 3. Vraag toevoegen
  const handleAddQuestion = (type: 'multiple_choice' | 'open') => {
    const newId = `q_${Date.now()}`;
    const newQ: Question = {
      id: newId,
      type,
      question: type === 'multiple_choice' ? 'Nieuwe meerkeuzevraag...' : 'Nieuwe open vraag...',
      options: type === 'multiple_choice' ? ['Optie A', 'Optie B', 'Optie C', 'Optie D'] : undefined,
      correctAnswer: type === 'multiple_choice' ? 0 : 'Modelantwoord / criteria...',
      points: type === 'multiple_choice' ? 2 : 3
    };
    setQuestions(prev => [...prev, newQ]);
  };

  // 4. Vraag updaten
  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  // 5. Vraag verwijderen
  const handleDeleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Helper voor snelle random code generatie
  const generateRandomCode = () => {
    const cleanSub = (subject || 'TOETS').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
    const num = Math.floor(100 + Math.random() * 900);
    const code = `${cleanSub || 'TOETS'}${num}`;
    setAccessCode(code);
    setHasPassword(true);
    return code;
  };

  // 6. Toets opslaan
  const handleSaveExam = async () => {
    if (!title.trim()) {
      alert('Vul een titel in voor de toets');
      setActiveTab('settings');
      return;
    }
    if (questions.length === 0) {
      alert('Voeg minstens 1 vraag toe aan de toets');
      setActiveTab('questions');
      return;
    }
    if (hasPassword && !accessCode.trim()) {
      alert('⚠️ Je hebt de optie "Toets beveiligen met een wachtwoord" aangevinkt, maar nog geen code ingevuld! Voer een code in of klik op "🎲 Genereer Code".');
      setActiveTab('settings');
      return;
    }

    try {
      const finalCode = hasPassword && accessCode.trim() ? accessCode.trim().toUpperCase() : null;
      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        classId: classId || null,
        status: examStatus,
        timeLimitMinutes: timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null,
        accessCode: finalCode,
        allowTabSwitch,
        maxTabSwitchViolations,
        forceFullscreen,
        disableCopyPaste,
        aiAssistanceMode,
        maxAiHints,
        questions
      };

      const url = editExam ? `/api/exams/${editExam.id}` : '/api/exams';
      const method = editExam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Opslaan mislukt');
      }

      onSaved();
      onClose();
    } catch (e: any) {
      alert(`Fout bij opslaan: ${e.message}`);
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '960px', height: '90vh', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        
        {/* HEADER */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              {editExam ? 'Toets Bewerken' : 'Nieuwe Online Toets Maken'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {questions.length} vragen • {totalPoints} punten in totaal
            </p>
          </div>

          {/* TAB KNOPPEN */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('ai')}
              style={{
                background: activeTab === 'ai' ? '#7c5cfc' : 'transparent',
                border: 'none',
                color: activeTab === 'ai' ? '#fff' : 'var(--text-secondary)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={14} /> AI Generator
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              style={{
                background: activeTab === 'questions' ? '#7c5cfc' : 'transparent',
                border: 'none',
                color: activeTab === 'questions' ? '#fff' : 'var(--text-secondary)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              Vragen & Afbeeldingen ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                background: activeTab === 'settings' ? '#7c5cfc' : 'transparent',
                border: 'none',
                color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              Beveiliging & Instellingen
            </button>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          
          {/* TAB 1: AI GENERATOR */}
          {activeTab === 'ai' && (
            <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(56,189,248,0.15))', border: '1px solid rgba(124,92,252,0.3)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Sparkles size={20} color="#c4b5fd" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Automatische Toetsgenerator met AI</h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Geef een thema op of plak je lesmateriaal. Locra AI genereert automatisch open en meerkeuzevragen, modelantwoorden, puntentelling én zoekt passende internet-afbeeldingen!
                </p>
              </div>

              {generateError && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  ⚠️ {generateError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Vak</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Bijv. Biologie, Geschiedenis, Aardrijkskunde"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Leerjaar / Niveau</label>
                  <input
                    type="text"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    placeholder="Bijv. 3 HAVO, 4 VWO, 2 VMBO"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Onderwerp van de Toets</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Bijv. Fotosynthese & celademhaling, De Koude Oorlog, Platentektoniek"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Aantal Meerkeuzevragen (gesloten)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={numMultipleChoice}
                    onChange={(e) => setNumMultipleChoice(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Aantal Open Vragen</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={numOpen}
                    onChange={(e) => setNumOpen(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* MOEILIJKHEIDSGRAAD & COGNITIEVE TAXONOMIE (RTTI) */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SlidersHorizontal size={16} color="#c4b5fd" /> Moeilijkheidsgraad & Taxonomie
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Kies een eenvoudige schuifregelaar of stel een specifieke RTTI-taxonomieverdeling in.
                    </div>
                  </div>

                  {/* MODUS SCHAKELAAR */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      type="button"
                      onClick={() => setDifficultyMode('slider')}
                      style={{
                        background: difficultyMode === 'slider' ? '#7c5cfc' : 'transparent',
                        color: difficultyMode === 'slider' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      🎯 Schuifregelaar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDifficultyMode('rtti')}
                      style={{
                        background: difficultyMode === 'rtti' ? '#7c5cfc' : 'transparent',
                        color: difficultyMode === 'rtti' ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      📊 RTTI (R1, R2, T1, T2)
                    </button>
                  </div>
                </div>

                {/* OPTIE 1: SCHUIFREGELAAR */}
                {difficultyMode === 'slider' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Moeilijkheidsniveau:</span>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: difficultyLevel === 1 ? 'rgba(34, 197, 94, 0.2)' : difficultyLevel === 2 ? 'rgba(56, 189, 248, 0.2)' : difficultyLevel === 3 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: difficultyLevel === 1 ? '#4ade80' : difficultyLevel === 2 ? '#38bdf8' : difficultyLevel === 3 ? '#c084fc' : '#f87171',
                        border: `1px solid ${difficultyLevel === 1 ? 'rgba(34,197,94,0.4)' : difficultyLevel === 2 ? 'rgba(56,189,248,0.4)' : difficultyLevel === 3 ? 'rgba(168,85,247,0.4)' : 'rgba(239,68,68,0.4)'}`
                      }}>
                        {difficultyLevel === 1 && 'Niveau 1: Basis / Toegankelijk'}
                        {difficultyLevel === 2 && 'Niveau 2: Gemiddeld (Standaard)'}
                        {difficultyLevel === 3 && 'Niveau 3: Uitdagend / Pittig'}
                        {difficultyLevel === 4 && 'Niveau 4: Expert / Examenstof'}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={1}
                      value={difficultyLevel}
                      onChange={(e) => setDifficultyLevel(parseInt(e.target.value, 10))}
                      style={{ width: '100%', accentColor: '#7c5cfc', cursor: 'pointer' }}
                    />

                    {/* 4 CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[
                        { lvl: 1, label: 'Basis', desc: 'Feiten & begrippen', color: '#4ade80' },
                        { lvl: 2, label: 'Gemiddeld', desc: 'Theorie & praktijk', color: '#38bdf8' },
                        { lvl: 3, label: 'Uitdagend', desc: 'Inzicht & transfer', color: '#c084fc' },
                        { lvl: 4, label: 'Expert', desc: 'Analyse & examen', color: '#f87171' }
                      ].map((item) => (
                        <div
                          key={item.lvl}
                          onClick={() => setDifficultyLevel(item.lvl)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '10px',
                            background: difficultyLevel === item.lvl ? 'rgba(124,92,252,0.18)' : 'rgba(0,0,0,0.2)',
                            border: difficultyLevel === item.lvl ? `1px solid ${item.color}` : '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: item.color }}>{item.label}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* OPTIE 2: RTTI TAXONOMIE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Stel de gewenste verdeling in volgens het Nederlandse <strong>RTTI-model</strong>:
                    </div>

                    {/* PRESETS */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>Snelle Presets:</span>
                      <button
                        type="button"
                        onClick={() => setRttiDistribution({ r1: 30, r2: 30, t1: 25, t2: 15 })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        Regulier VO (30/30/25/15)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRttiDistribution({ r1: 50, r2: 30, t1: 15, t2: 5 })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        Basis / VMBO (50/30/15/5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRttiDistribution({ r1: 15, r2: 25, t1: 35, t2: 25 })}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        VWO & Inzicht (15/25/35/25)
                      </button>
                    </div>

                    {/* RTTI BALKEN / SLIDERS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>📘 R1: Reproductie 1</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{rttiDistribution.r1}%</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Feitenkennis & termen</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={rttiDistribution.r1}
                          onChange={(e) => setRttiDistribution(prev => ({ ...prev, r1: parseInt(e.target.value, 10) }))}
                          style={{ width: '100%', accentColor: '#3b82f6' }}
                        />
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399' }}>📗 R2: Reproductie 2</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{rttiDistribution.r2}%</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Standaard procedures & formules</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={rttiDistribution.r2}
                          onChange={(e) => setRttiDistribution(prev => ({ ...prev, r2: parseInt(e.target.value, 10) }))}
                          style={{ width: '100%', accentColor: '#10b981' }}
                        />
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24' }}>📙 T1: Toepassing 1</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{rttiDistribution.t1}%</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Toepassen in nieuwe situaties</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={rttiDistribution.t1}
                          onChange={(e) => setRttiDistribution(prev => ({ ...prev, t1: parseInt(e.target.value, 10) }))}
                          style={{ width: '100%', accentColor: '#f59e0b' }}
                        />
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc' }}>📕 T2: Inzicht</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>{rttiDistribution.t2}%</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Complexe transfer & analyse</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={rttiDistribution.t2}
                          onChange={(e) => setRttiDistribution(prev => ({ ...prev, t2: parseInt(e.target.value, 10) }))}
                          style={{ width: '100%', accentColor: '#a855f7' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Optioneel: Plak lesstof / brontekst (PDF uittreksel of samenvatting)
                </label>
                <textarea
                  rows={4}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Plak hier eventueel de tekst uit het leerboek of een artikel..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="includeImages"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                />
                <label htmlFor="includeImages" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  Automatisch relevante internet-afbeeldingen (via Wikimedia/web search) koppelen bij toepasselijke vragen
                </label>
              </div>

              {/* SNELLE WACHTWOORD INSTELLING IN AI TAB */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} color="#fbbf24" /> Toegangscode / Wachtwoord vereisen (Optioneel)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Toets pas laten ontgrendelen wanneer jij de code in de klas deelt.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasPassword}
                    onChange={(e) => {
                      setHasPassword(e.target.checked);
                      if (e.target.checked && !accessCode) generateRandomCode();
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                  />
                </div>
                {hasPassword && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="Bijv. BIO2026"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid #7c5cfc', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      style={{ background: 'rgba(124,92,252,0.2)', border: '1px solid #7c5cfc', color: '#c4b5fd', padding: '0 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      🎲 Genereer Code
                    </button>
                  </div>
                )}
              </div>

              <button
                disabled={generating}
                onClick={handleGenerateAI}
                style={{
                  background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(124,92,252,0.4)',
                  marginTop: '10px',
                  opacity: generating ? 0.7 : 1
                }}
              >
                <Sparkles size={18} />
                {generating ? 'Toets wordt gegenereerd door Locra AI...' : 'Genereer Toets met AI →'}
              </button>
            </div>
          )}

          {/* TAB 2: VRAGEN & AFBEELDINGEN EDITOR */}
          {activeTab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Vragen & Opgaven ({questions.length})</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Pas de vragen aan, voeg opties toe of selecteer internet-afbeeldingen.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleAddQuestion('multiple_choice')} style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    + Meerkeuzevraag
                  </button>
                  <button onClick={() => handleAddQuestion('open')} style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', color: '#d8b4fe', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    + Open Vraag
                  </button>
                </div>
              </div>

              {questions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>Er zijn nog geen vragen aangemaakt.</p>
                  <button onClick={() => setActiveTab('ai')} style={{ background: '#7c5cfc', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    Gebruik de AI Generator
                  </button>
                </div>
              ) : (
                questions.map((q, qIndex) => (
                  <div key={q.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* VRAAG TITELBALK */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#7c5cfc', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                          {qIndex + 1}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {q.type === 'multiple_choice' ? 'Meerkeuzevraag' : 'Open Vraag'}
                        </span>

                        {/* RTTI TAXONOMIE KIEZER / BADGE */}
                        <select
                          value={q.rtti || 'R2'}
                          onChange={(e) => handleUpdateQuestion(q.id, { rtti: e.target.value })}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: q.rtti === 'R1' ? 'rgba(59, 130, 246, 0.2)' : q.rtti === 'R2' ? 'rgba(16, 185, 129, 0.2)' : q.rtti === 'T1' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                            color: q.rtti === 'R1' ? '#60a5fa' : q.rtti === 'R2' ? '#34d399' : q.rtti === 'T1' ? '#fbbf24' : '#c084fc',
                            border: `1px solid ${q.rtti === 'R1' ? 'rgba(59, 130, 246, 0.4)' : q.rtti === 'R2' ? 'rgba(16, 185, 129, 0.4)' : q.rtti === 'T1' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                            cursor: 'pointer'
                          }}
                          title="Cognitief niveau volgens RTTI taxonomie"
                        >
                          <option value="R1" style={{ background: '#1e293b', color: '#60a5fa' }}>R1 (Reproductie: Weetvraag)</option>
                          <option value="R2" style={{ background: '#1e293b', color: '#34d399' }}>R2 (Reproductie: Standaard)</option>
                          <option value="T1" style={{ background: '#1e293b', color: '#fbbf24' }}>T1 (Toepassing: Nieuwe context)</option>
                          <option value="T2" style={{ background: '#1e293b', color: '#c084fc' }}>T2 (Inzicht & Transfer)</option>
                        </select>

                        {/* MOEILIJKHEIDSGRAAD KIEZER / BADGE */}
                        <select
                          value={q.difficulty || 'Gemiddeld'}
                          onChange={(e) => handleUpdateQuestion(q.id, { difficulty: e.target.value })}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="Basis" style={{ background: '#1e293b' }}>Basis</option>
                          <option value="Gemiddeld" style={{ background: '#1e293b' }}>Gemiddeld</option>
                          <option value="Uitdagend" style={{ background: '#1e293b' }}>Uitdagend</option>
                          <option value="Expert" style={{ background: '#1e293b' }}>Expert</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Punten:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={q.points}
                            onChange={(e) => handleUpdateQuestion(q.id, { points: parseInt(e.target.value, 10) || 1 })}
                            style={{ width: '50px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', textAlign: 'center' }}
                          />
                        </div>
                        <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* VRAAGSTELLING */}
                    <div>
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => handleUpdateQuestion(q.id, { question: e.target.value })}
                        placeholder="Vraagstelling..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }}
                      />
                    </div>

                    {/* AFBEELDING BEHEER BIJ DE VRAAG */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {q.imageUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <img src={q.imageUrl} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>Afbeelding gekoppeld</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{q.imageAlt || q.imageUrl}</div>
                          </div>
                          <button
                            onClick={() => {
                              setImageSearchQuery(q.question.split(' ').slice(0, 3).join(' '));
                              setSearchImageModalQuestionId(q.id);
                              handleSearchImages(q.question.split(' ').slice(0, 3).join(' '));
                            }}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            Vervangen
                          </button>
                          <button
                            onClick={() => handleUpdateQuestion(q.id, { imageUrl: undefined, imageAlt: undefined })}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Verwijderen
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Geen afbeelding bij deze vraag</span>
                          <button
                            onClick={() => {
                              const qKeyword = q.question.split(' ').slice(0, 3).join(' ');
                              setImageSearchQuery(qKeyword);
                              setSearchImageModalQuestionId(q.id);
                              handleSearchImages(qKeyword);
                            }}
                            style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Search size={12} /> Zoek afbeelding op internet
                          </button>
                        </div>
                      )}
                    </div>

                    {/* MEERKEUZE OPTIES OF OPEN MODELANTWOORD */}
                    {q.type === 'multiple_choice' && q.options && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Antwoordopties (selecteer het juiste antwoord):</div>
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={String(q.correctAnswer) === String(oIdx)}
                              onChange={() => handleUpdateQuestion(q.id, { correctAnswer: oIdx })}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '16px' }}>{String.fromCharCode(65 + oIdx)}</span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.options!];
                                newOpts[oIdx] = e.target.value;
                                handleUpdateQuestion(q.id, { options: newOpts });
                              }}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'open' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 600, marginBottom: '4px' }}>
                          Modelantwoord / Nakijkcriteria (voor de docent en AI-nakijkassistent):
                        </label>
                        <textarea
                          rows={2}
                          value={String(q.correctAnswer || '')}
                          onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                          placeholder="Wat moet de leerling noemen om de punten te behalen?"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(52,211,153,0.3)', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: INSTELLINGEN & BEVEILIGING */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Toetstitel</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bijv. Toets Hoofdstuk 3: Fotosynthese & Cellen"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Klaarzetten voor Klas</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  >
                    <option value="">Alle klassen / Geen specifieke klas</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tijdslimiet (minuten)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leeg = Geen tijdslimiet"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* BEVEILIGINGSOPTIES */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={18} /> Toetsomgeving & Anti-fraude Regels
                </div>

                {/* TOEGANGSWACHTWOORD (OPTIONEEL) */}
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasPassword ? '10px' : 0 }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>🔑 Toets beveiligen met een wachtwoord (Optioneel)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        De toets staat al klaar bij de leerling, maar kan pas worden gestart na invoer van dit wachtwoord.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasPassword}
                      onChange={(e) => {
                        setHasPassword(e.target.checked);
                        if (e.target.checked && !accessCode) generateRandomCode();
                      }}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                    />
                  </div>

                  {hasPassword && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <input
                        type="text"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                        placeholder="Bijv. WISKUNDE-VWO3 of TOETS2026"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid #7c5cfc', color: '#fff', fontSize: '0.92rem', fontWeight: 700, letterSpacing: '0.05em' }}
                      />
                      <button
                        type="button"
                        onClick={generateRandomCode}
                        title="Genereer willekeurige code"
                        style={{ background: 'rgba(124,92,252,0.2)', border: '1px solid #7c5cfc', color: '#c4b5fd', padding: '0 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        🎲 Genereer Code
                      </button>
                    </div>
                  )}
                </div>

                {/* TABBLAD WISSELEN BLOKKEREN */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Tabblad wisselen verbieden</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Toont direct een waarschuwingsscherm en registreert overtredingen voor de docent.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!allowTabSwitch}
                    onChange={(e) => setAllowTabSwitch(!e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                  />
                </div>

                {!allowTabSwitch && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '16px', borderLeft: '2px solid #7c5cfc' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Automatisch vergrendelen en inleveren na:</span>
                    <select
                      value={maxTabSwitchViolations}
                      onChange={(e) => setMaxTabSwitchViolations(parseInt(e.target.value, 10))}
                      style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem' }}
                    >
                      <option value="1">1 waarschuwing (Direct)</option>
                      <option value="2">2 waarschuwingen</option>
                      <option value="3">3 waarschuwingen (Standaard)</option>
                      <option value="5">5 waarschuwingen</option>
                    </select>
                  </div>
                )}

                {/* VOLLEDIG SCHERM & CLIPBOARD */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Volledig scherm (Fullscreen) forceren</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verplicht de leerling in volledig scherm te blijven tijdens de toets.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={forceFullscreen}
                    onChange={(e) => setForceFullscreen(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Kopiëren en plakken (Copy/Paste) blokkeren</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Voorkomt plakken van antwoorden vanuit externe documenten.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={disableCopyPaste}
                    onChange={(e) => setDisableCopyPaste(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#7c5cfc' }}
                  />
                </div>

                {/* LOCRA AI HULP RESTRICTIE */}
                <div style={{ marginTop: '6px' }}>
                  <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
                    🤖 Locra AI-Assistent Beschikbaarheid
                  </label>
                  <select
                    value={aiAssistanceMode}
                    onChange={(e) => setAiAssistanceMode(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.88rem' }}
                  >
                    <option value="disabled">🔒 Volledig Uitgeschakeld (Aanbevolen voor officiële toetsen)</option>
                    <option value="hints">💡 Beperkte Socratic Hints (Geeft nooit direct antwoord, max hints)</option>
                    <option value="full">🤝 Volledige AI Hulp (Voor proef- of oefentoetsen)</option>
                  </select>
                </div>

                {aiAssistanceMode === 'hints' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '16px', borderLeft: '2px solid #7c5cfc' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Maximaal aantal hints per leerling:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxAiHints}
                      onChange={(e) => setMaxAiHints(parseInt(e.target.value, 10) || 3)}
                      style={{ width: '60px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'center' }}
                    />
                  </div>
                )}
              </div>

              {/* STATUS */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Publicatiestatus</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setExamStatus('active')}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: examStatus === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: examStatus === 'active' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)', color: examStatus === 'active' ? '#a7f3d0' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    🟢 Actief (Direct zichtbaar voor leerlingen)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamStatus('draft')}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: examStatus === 'draft' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)', border: examStatus === 'draft' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', color: examStatus === 'draft' ? '#fcd34d' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    🟡 Concept (Nog niet zichtbaar)
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
            Annuleren
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab !== 'settings' && (
              <button onClick={() => setActiveTab(activeTab === 'ai' ? 'questions' : 'settings')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                Volgende Stap →
              </button>
            )}
            <button onClick={handleSaveExam} style={{ background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.4)' }}>
              Toets Opslaan & Klaarzetten
            </button>
          </div>
        </div>

      </div>

      {/* DRAWER / MODAL: INTERNET AFBEELDINGEN ZOEKEN */}
      {searchImageModalQuestionId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '640px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '24px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} color="#38bdf8" /> Afbeelding Zoeken op Internet
              </div>
              <button onClick={() => setSearchImageModalQuestionId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                placeholder="Zoekterm voor afbeelding..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchImages(imageSearchQuery); }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.9rem' }}
              />
              <button onClick={() => handleSearchImages(imageSearchQuery)} style={{ background: '#38bdf8', border: 'none', color: '#000', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                {isSearchingImages ? 'Zoeken...' : 'Zoek'}
              </button>
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {imageSearchResults.map((img, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectImageForQuestion(searchImageModalQuestionId, img)}
                  style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: '#000', position: 'relative' }}
                >
                  <img src={img.thumbUrl || img.url} alt={img.title} style={{ width: '100%', height: '110px', objectFit: 'cover' }} />
                  <div style={{ padding: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.title}
                  </div>
                </div>
              ))}
              {imageSearchResults.length === 0 && !isSearchingImages && (
                <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Voer een zoekterm in om educatieve afbeeldingen te vinden
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
