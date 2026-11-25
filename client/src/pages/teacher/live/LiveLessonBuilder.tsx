import React, { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import {
  ArrowLeft, Save, Play, Plus, Trash2, ArrowUp, ArrowDown,
  Sparkles, Clock, CheckCircle2, FileText, HelpCircle,
  MessageSquare, Cloud, BarChart2, Check, AlertCircle,
  Copy, Image as ImageIcon, Loader2, Moon
} from 'lucide-react';
import type { LiveSlide, SlideType } from './LiveDashboard';
import DidacticMarkdownRenderer from '../../../components/live/DidacticMarkdownRenderer';

interface LiveLessonBuilderProps {
  initialLesson?: {
    id?: string;
    title: string;
    subject: string;
    targetGrade: string;
    modeDefault: string;
    slides: LiveSlide[];
    generationMeta?: {
      aiPowered?: boolean;
      qualityUpgraded?: boolean;
      modelUsed?: string;
      sourcesUsed?: string[];
      sourceCharCount?: number;
    };
  };
  onBack: () => void;
  onSaved: (lessonId: string) => void;
  onStartSession: (lessonId: string) => void;
}

const OPTION_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
const OPTION_LABELS = ['A (Rood)', 'B (Blauw)', 'C (Geel)', 'D (Groen)'];

export default function LiveLessonBuilder({
  initialLesson,
  onBack,
  onSaved,
  onStartSession
}: LiveLessonBuilderProps) {
  const token = useAuthStore(s => s.token);

  const [lessonId, setLessonId] = useState<string | undefined>(initialLesson?.id);
  const [title, setTitle] = useState(initialLesson?.title || 'Nieuwe Interactieve Les');
  const [subject, setSubject] = useState(initialLesson?.subject || 'Geschiedenis');
  const [targetGrade, setTargetGrade] = useState(initialLesson?.targetGrade || '3 HAVO');
  const [modeDefault, setModeDefault] = useState(initialLesson?.modeDefault || 'hybrid');

  const [slides, setSlides] = useState<LiveSlide[]>(
    initialLesson?.slides && initialLesson.slides.length > 0
      ? initialLesson.slides
      : [
          {
            id: 'slide-1',
            type: 'content',
            title: 'Introductie en Leerdoel',
            content: 'Welkom bij de les! Vandaag gaan we de belangrijkste theorie behandelen en direct interactief toetsen.',
            timeLimitSeconds: 0
          },
          {
            id: 'slide-2',
            type: 'multiple_choice',
            title: 'Eerste begripsvraag',
            content: 'Wat is de juiste definitie van het kernbegrip?',
            options: ['Optie A', 'Optie B', 'Optie C', 'Optie D'],
            correctOptionIndex: 0,
            timeLimitSeconds: 30,
            points: 1000,
            explanation: 'Optie A is het juiste antwoord omdat...'
          }
        ]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchingImage, setSearchingImage] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentSlide = slides[selectedIdx] || slides[0];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const suggestImageForCurrentSlide = async () => {
    setSearchingImage(true);
    try {
      const usedUrls = slides.map(s => s.imageUrl).filter(Boolean) as string[];
      const res = await fetch('/api/live/suggest-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: currentSlide.title || currentSlide.content?.slice(0, 80) || title,
          subject,
          topic: title,
          excludeUrls: usedUrls
        })
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setSlides(prev => {
          const copy = [...prev];
          copy[selectedIdx] = {
            ...copy[selectedIdx],
            imageUrl: data.imageUrl,
            imageCaption: data.caption || copy[selectedIdx].imageCaption
          };
          return copy;
        });
        showToast('Passend plaatje gevonden! 🖼️');
      } else {
        showToast('Geen extra plaatje gevonden');
      }
    } catch (_) {
      showToast('Fout bij zoeken naar afbeelding');
    } finally {
      setSearchingImage(false);
    }
  };

  const insertDidacticBlock = (snippet: string) => {
    const existing = currentSlide.content || '';
    const updated = existing.trim() ? `${existing.trim()}\n\n${snippet}` : snippet;
    updateCurrentSlide('content', updated);
  };

  const updateCurrentSlide = (field: keyof LiveSlide, value: any) => {
    setSlides(prev => {
      const copy = [...prev];
      const updated = { ...copy[selectedIdx], [field]: value };
      if (field === 'type' && value === 'true_false') {
        updated.options = ['Waar', 'Niet Waar'];
        updated.correctOptionIndex = updated.correctOptionIndex ?? 0;
      }
      copy[selectedIdx] = updated;
      return copy;
    });
  };

  const addSlide = (type: SlideType = 'multiple_choice') => {
    const newSlide: LiveSlide = {
      id: `slide-${Date.now()}`,
      type,
      title: type === 'content'
        ? 'Theorie & Instructie'
        : type === 'wordcloud'
        ? 'Gedachtenwolk / Brainstorm'
        : type === 'open'
        ? 'Open Discussievraag'
        : type === 'poll'
        ? 'Klassikale Peiling'
        : type === 'true_false'
        ? 'Stelling: Waar of Niet Waar?'
        : 'Quiz Vraag',
      content: '',
      options: type === 'multiple_choice'
        ? ['Antwoord 1', 'Antwoord 2', 'Antwoord 3', 'Antwoord 4']
        : type === 'true_false'
        ? ['Waar', 'Niet Waar']
        : type === 'poll'
        ? ['Mee eens', 'Neutraal', 'Mee oneens']
        : undefined,
      correctOptionIndex: (type === 'multiple_choice' || type === 'true_false') ? 0 : undefined,
      timeLimitSeconds: type === 'content' ? 0 : 30,
      points: 1000,
      explanation: ''
    };
    setSlides(prev => [...prev, newSlide]);
    setSelectedIdx(slides.length);
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) {
      showToast('Een les moet minimaal 1 slide bevatten');
      return;
    }
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const moveSlide = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    setSlides(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    setSelectedIdx(targetIdx);
  };

  const saveLesson = async (thenStart = false): Promise<string | null> => {
    if (!title.trim()) {
      showToast('Vul a.u.b. een lestitel in');
      return null;
    }

    setSaving(true);
    try {
      const endpoint = lessonId ? `/api/live/lessons/${lessonId}` : '/api/live/lessons';
      const method = lessonId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          subject,
          targetGrade,
          modeDefault,
          slides
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');

      const savedId = data.lesson.id;
      setLessonId(savedId);
      showToast('Les succesvol opgeslagen! ✅');

      if (thenStart) {
        onStartSession(savedId);
      } else {
        onSaved(savedId);
      }
      return savedId;
    } catch (err: any) {
      showToast(err.message || 'Fout bij opslaan');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const queueForOffPeakReview = async () => {
    const savedId = await saveLesson(false);
    if (!savedId) return;
    try {
      const res = await fetch(`/api/live/lessons/${savedId}/queue-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ scheduleMode: 'offpeak' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inplannen mislukt');
      showToast(`🌙 ${data.message || 'Les in daluren-wachtrij gezet!'}`);
    } catch (err: any) {
      showToast(err.message || 'Fout bij inplannen van daluren-check');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Toast Notificatie */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(124, 92, 252, 0.95)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 99999,
          fontWeight: 600,
          fontSize: '0.9rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Top Header Toolbar */}
      <header style={{
        background: 'rgba(15, 20, 35, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.8rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '7px 12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>Overzicht</span>
          </button>

          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Lestitel..."
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'Outfit, sans-serif',
              padding: '4px 6px',
              outline: 'none',
              width: '320px'
            }}
          />

          <input
            type="text"
            list="builder-subject-options"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Vak..."
            style={{
              background: 'rgba(10, 14, 26, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#a5b4fc',
              fontSize: '0.82rem',
              width: '130px',
              outline: 'none'
            }}
          />
          <datalist id="builder-subject-options">
            {['Geschiedenis', 'Aardrijkskunde', 'Biologie', 'Nederlands', 'Engels', 'Frans', 'Duits', 'Wiskunde', 'Natuurkunde', 'Scheikunde', 'Informatica', 'Economie', 'Maatschappijleer', 'Algemeen'].map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <input
            type="text"
            list="builder-grade-options"
            value={targetGrade}
            onChange={e => setTargetGrade(e.target.value)}
            placeholder="Niveau / leerjaar..."
            title="Vul een willekeurig niveau of leerjaar in"
            style={{
              background: 'rgba(10, 14, 26, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#7dd3fc',
              fontSize: '0.82rem',
              width: '135px',
              outline: 'none'
            }}
          />
          <datalist id="builder-grade-options">
            {['Groep 7/8', '1-2 VMBO', '3-4 VMBO', '1-2 HAVO/VWO', '3 HAVO', '4-5 HAVO', '3 VWO', '4-6 VWO', 'MBO Niveau 3/4', 'HBO / WO'].map(g => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <select
            value={modeDefault}
            onChange={e => setModeDefault(e.target.value)}
            style={{
              background: 'rgba(124, 92, 252, 0.15)',
              border: '1px solid rgba(124, 92, 252, 0.35)',
              borderRadius: '8px',
              padding: '7px 12px',
              color: '#c4b5fd',
              fontSize: '0.82rem',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="hybrid">⚡ Locra Hybride (Les + Arena)</option>
            <option value="arcade">🎮 Locra Arena (Spel & Podium)</option>
            <option value="formative">📖 Locra Presentor (Rustige Instructie)</option>
          </select>

          <button
            onClick={() => saveLesson(false)}
            disabled={saving}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              padding: '8px 16px',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <Save size={16} />
            <span>{saving ? 'Opslaan...' : 'Opslaan'}</span>
            {saving && <Loader2 size={14} className="spin" />}
          </button>

          <button
            type="button"
            onClick={queueForOffPeakReview}
            disabled={saving}
            title="Sla deze les op en zet hem in de daluren-wachtrij (22:00–07:00 / weekend) om alle vragen grondig na te kijken en aan te scherpen"
            style={{
              background: 'rgba(139, 92, 246, 0.16)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '10px',
              padding: '8px 14px',
              color: '#ddd6fe',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              fontWeight: 600
            }}
          >
            <Moon size={15} />
            <span>Les Queuen (Daluren)</span>
          </button>

          <button
            onClick={() => saveLesson(true)}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 18px',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Play size={16} fill="#fff" />
            <span>{saving ? 'Starten...' : 'Start Live Sessie'}</span>
            {saving && <Loader2 size={14} className="spin" />}
          </button>
        </div>
      </header>

      {/* Main Studio Area (2 Columns) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar: Slides Timeline */}
        <div style={{
          width: '280px',
          background: 'rgba(10, 14, 26, 0.9)',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Slide List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {slides.map((s, idx) => {
              const isSelected = idx === selectedIdx;
              const typeIcon = s.type === 'content' ? '📄' : s.type === 'wordcloud' ? '☁️' : s.type === 'open' ? '💬' : s.type === 'poll' ? '📊' : s.type === 'true_false' ? '⚖️' : '🔴';

              return (
                <div
                  key={s.id || idx}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    background: isSelected ? 'rgba(124, 92, 252, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '2px solid #7c5cfc' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.4)', width: '18px' }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: '1.1rem' }}>{typeIcon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || 'Naamloze slide'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>{s.type}</span>
                      {s.timeLimitSeconds ? <span>• {s.timeLimitSeconds}s</span> : null}
                      {s.rtti && (
                        <span style={{ background: 'rgba(124, 92, 252, 0.25)', color: '#ddd6fe', padding: '0 4px', borderRadius: '4px', fontWeight: 800, fontSize: '0.62rem' }}>
                          {s.rtti}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Move Up/Down & Delete */}
                  {isSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                      {idx > 0 && (
                        <button onClick={() => moveSlide(idx, 'up')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '2px' }} title="Omhoog">
                          <ArrowUp size={13} />
                        </button>
                      )}
                      {idx < slides.length - 1 && (
                        <button onClick={() => moveSlide(idx, 'down')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '2px' }} title="Omlaag">
                          <ArrowDown size={13} />
                        </button>
                      )}
                      <button onClick={() => removeSlide(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px', marginLeft: '4px' }} title="Verwijder slide">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Slide Buttons */}
          <div style={{ padding: '0.8rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              onClick={() => addSlide('multiple_choice')}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#fca5a5',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Meerkeuze</span>
            </button>

            <button
              onClick={() => addSlide('true_false')}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#6ee7b7',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Waar/Niet waar</span>
            </button>

            <button
              onClick={() => addSlide('content')}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#93c5fd',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Theorie</span>
            </button>

            <button
              onClick={() => addSlide('wordcloud')}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#d8b4fe',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Gedachtenwolk</span>
            </button>

            <button
              onClick={() => addSlide('open')}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#fcd34d',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Open vraag</span>
            </button>

            <button
              onClick={() => addSlide('poll')}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#7dd3fc',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                fontWeight: 600
              }}
            >
              <Plus size={13} />
              <span>+ Peiling</span>
            </button>
          </div>
        </div>

        {/* Right Main Panel: Slide Content & WYSIWYG Editor */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            {initialLesson?.generationMeta && (
              <div style={{
                marginBottom: '1rem',
                background: initialLesson.generationMeta.aiPowered
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(56, 189, 248, 0.1))'
                  : 'rgba(245, 158, 11, 0.12)',
                border: initialLesson.generationMeta.aiPowered
                  ? '1px solid rgba(52, 211, 153, 0.35)'
                  : '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '14px',
                padding: '0.7rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.6rem',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Sparkles size={15} color={initialLesson.generationMeta.aiPowered ? '#34d399' : '#fbbf24'} />
                  <span style={{ fontWeight: 700, color: '#fff' }}>
                    {initialLesson.generationMeta.aiPowered
                      ? `AI-les gegenereerd (${initialLesson.generationMeta.modelUsed || 'LLM'})`
                      : 'Opgebouwd via Locra Vaktemplate (geen actieve AI-sleutel/Ollama gevonden)'}
                  </span>
                  {initialLesson.generationMeta.qualityUpgraded && (
                    <span style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.45)', color: '#e9d5ff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.71rem', fontWeight: 700 }}>
                      ✓ Kwaliteitscontrole uitgevoerd
                    </span>
                  )}
                </div>
                {initialLesson.generationMeta.sourcesUsed && initialLesson.generationMeta.sourcesUsed.length > 0 && (
                  <span style={{ color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 600 }}>
                    📚 Gebaseerd op: {initialLesson.generationMeta.sourcesUsed.join(', ')}
                  </span>
                )}
              </div>
            )}

            {/* Slide Header Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1.2rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Type slide:</span>
                <select
                  value={currentSlide.type}
                  onChange={e => updateCurrentSlide('type', e.target.value as SlideType)}
                  style={{
                    background: 'rgba(10, 14, 26, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="content">📄 Theorie & Instructie (Presentor)</option>
                  <option value="multiple_choice">🔴 Meerkeuzevraag (Arena)</option>
                  <option value="true_false">⚖️ Waar / Niet Waar (Arena)</option>
                  <option value="wordcloud">☁️ Gedachtenwolk / Brainstorm</option>
                  <option value="open">💬 Open Vraag (met AI Clustering & Post-Its)</option>
                  <option value="poll">📊 Peiling / Feedback</option>
                </select>
              </div>

              {currentSlide.type !== 'content' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} color="#a5b4fc" />
                    <select
                      value={currentSlide.timeLimitSeconds || 30}
                      onChange={e => updateCurrentSlide('timeLimitSeconds', parseInt(e.target.value))}
                      style={{
                        background: 'rgba(10, 14, 26, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        color: '#fff',
                        fontSize: '0.82rem'
                      }}
                    >
                      <option value={10}>10 sec</option>
                      <option value={20}>20 sec</option>
                      <option value={30}>30 sec (standaard)</option>
                      <option value={45}>45 sec</option>
                      <option value={60}>60 sec</option>
                      <option value={90}>90 sec</option>
                      <option value={0}>Geen timer (handmatig)</option>
                    </select>
                  </div>

                  {(currentSlide.type === 'multiple_choice' || currentSlide.type === 'true_false' || currentSlide.type === 'open') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 600 }}>RTTI:</span>
                      <select
                        value={currentSlide.rtti || ''}
                        onChange={e => updateCurrentSlide('rtti', e.target.value || undefined)}
                        style={{
                          background: 'rgba(10, 14, 26, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '5px 8px',
                          color: '#ddd6fe',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        <option value="">Geen</option>
                        <option value="R1">R1 (Reproductie)</option>
                        <option value="R2">R2 (Vaardigheid)</option>
                        <option value="T1">T1 (Toepassing)</option>
                        <option value="T2">T2 (Inzicht)</option>
                      </select>
                    </div>
                  )}

                  {(currentSlide.type === 'multiple_choice' || currentSlide.type === 'true_false') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 600 }}>Punten:</span>
                      <select
                        value={currentSlide.points || 1000}
                        onChange={e => updateCurrentSlide('points', parseInt(e.target.value))}
                        style={{
                          background: 'rgba(10, 14, 26, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '5px 10px',
                          color: '#fff',
                          fontSize: '0.82rem'
                        }}
                      >
                        <option value={1000}>1000 pnt</option>
                        <option value={2000}>2000 pnt (Dubbele punten!)</option>
                        <option value={0}>0 pnt (Geen score)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Slide Title */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.4rem' }}>
                {currentSlide.type === 'content' ? 'Titel van de theorie-dia' : 'Vraagstelling / Titel'}
              </label>
              <input
                type="text"
                value={currentSlide.title || ''}
                onChange={e => updateCurrentSlide('title', e.target.value)}
                placeholder="Typ hier de vraag of titel..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
            </div>

            {/* Content / Question Explanation Body */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {currentSlide.type === 'content' ? 'Uitleg & Rijke Informatieve Blokken (Markdown & LaTeX)' : 'Optionele context, bron of casus'}
                </label>

                {/* Snelle Invoegknoppen voor Rijke Blokken */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  {[
                    { label: '+ 🎯 Leerdoel', snippet: '> 🎯 **Leerdoel:** Na deze dia kun je uitleggen...' },
                    { label: '+ 💡 Kernbegrip', snippet: '> 💡 **Kernbegrip:** Belangrijke definitie of regel...' },
                    { label: '+ 🔍 Casus', snippet: '> 🔍 **Casus / Bron:** Concreet voorbeeld uit de praktijk...' },
                    { label: '+ ⚠️ Denkfout', snippet: '> ⚠️ **Veelgemaakte Denkfout:** Let op: verwar dit niet met...' },
                    { label: '+ 📊 Tabel', snippet: '| Begrip | Betekenis |\n| :--- | :--- |\n| Punt A | Uitleg A |\n| Punt B | Uitleg B |' }
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => insertDidacticBlock(btn.snippet)}
                      style={{
                        background: 'rgba(124, 92, 252, 0.14)',
                        border: '1px solid rgba(124, 92, 252, 0.3)',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        color: '#ddd6fe',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={currentSlide.type === 'content' ? 6 : 3}
                value={currentSlide.content || ''}
                onChange={e => updateCurrentSlide('content', e.target.value)}
                placeholder={currentSlide.type === 'content' ? 'Typ hier de theorie, of klik hierboven op een informatief blok om in te voegen...' : 'Optioneel: geef extra context, een citaat of casus bij deze vraag...'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '0.9rem',
                  color: '#fff',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />

              {/* Live Preview Box */}
              {currentSlide.content && (
                <div style={{
                  marginTop: '0.6rem',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '14px',
                  padding: '1rem 1.2rem',
                  fontSize: '0.92rem'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Digibord Weergave (Live Preview met Informatieve Blokken):
                  </div>
                  <DidacticMarkdownRenderer content={currentSlide.content} compact />
                </div>
              )}
            </div>

            {/* Afbeelding & Media (Automatisch zoeken of zelf invoeren) */}
            <div style={{
              marginBottom: '1.6rem',
              background: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1rem 1.2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={17} color="#38bdf8" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0' }}>
                    Afbeelding / Illustratie bij deze dia
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={suggestImageForCurrentSlide}
                    disabled={searchingImage}
                    style={{
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(124, 92, 252, 0.22))',
                      border: '1px solid rgba(56, 189, 248, 0.45)',
                      borderRadius: '10px',
                      padding: '6px 12px',
                      color: '#7dd3fc',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: searchingImage ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {searchingImage ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    <span>{searchingImage ? 'Zoeken...' : 'AI Afbeelding'}</span>
                    <span>{currentSlide.imageUrl ? 'Ander plaatje zoeken' : 'Vind automatisch plaatje'}</span>
                  </button>

                  {currentSlide.imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        updateCurrentSlide('imageUrl', '');
                        updateCurrentSlide('imageCaption', '');
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.14)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        color: '#fca5a5',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Verwijder
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: currentSlide.imageUrl ? '160px 1fr' : '1fr', gap: '1rem', alignItems: 'center' }}>
                {currentSlide.imageUrl && (
                  <img
                    src={currentSlide.imageUrl}
                    alt="Slide preview"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                    style={{
                      width: '160px',
                      height: '105px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: '#050814'
                    }}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={currentSlide.imageUrl || ''}
                    onChange={e => updateCurrentSlide('imageUrl', e.target.value)}
                    placeholder="Afbeeldings-URL (of klik op 'Vind automatisch plaatje')"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(10, 14, 26, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      padding: '0.55rem 0.85rem',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={currentSlide.imageCaption || ''}
                    onChange={e => updateCurrentSlide('imageCaption', e.target.value)}
                    placeholder="Optioneel onderschrift / bronvermelding..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(10, 14, 26, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '0.5rem 0.85rem',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Vraagtype Specifieke Controls */}
            {currentSlide.type === 'multiple_choice' && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.6rem' }}>
                  Antwoordopties (Klik op het vinkje om het juiste antwoord in te stellen)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  {(currentSlide.options || ['Optie 1', 'Optie 2', 'Optie 3', 'Optie 4']).map((opt, optIdx) => {
                    const isCorrect = currentSlide.correctOptionIndex === optIdx;
                    const color = OPTION_COLORS[optIdx % OPTION_COLORS.length];

                    return (
                      <div
                        key={optIdx}
                        style={{
                          background: `rgba(${optIdx === 0 ? '239, 68, 68' : optIdx === 1 ? '59, 130, 246' : optIdx === 2 ? '234, 179, 8' : '34, 197, 94'}, 0.12)`,
                          border: isCorrect ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '14px',
                          padding: '0.8rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.8rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => updateCurrentSlide('correctOptionIndex', optIdx)}
                          title={isCorrect ? 'Correct antwoord' : 'Markeer als correct'}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isCorrect ? color : 'rgba(255,255,255,0.08)',
                            border: `2px solid ${color}`,
                            color: isCorrect ? '#fff' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Check size={18} />
                        </button>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: '2px', textTransform: 'uppercase' }}>
                            {OPTION_LABELS[optIdx]}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...(currentSlide.options || [])];
                              newOpts[optIdx] = e.target.value;
                              updateCurrentSlide('options', newOpts);
                            }}
                            placeholder={`Antwoord ${optIdx + 1}...`}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '0.95rem',
                              fontWeight: 500,
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Waar / Niet Waar Stelling */}
            {currentSlide.type === 'true_false' && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.6rem' }}>
                  Stelling Antwoord (Kies welk antwoord correct is)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Waar', isCorrect: currentSlide.correctOptionIndex === 0, idx: 0, color: '#10b981', icon: '✅' },
                    { label: 'Niet Waar', isCorrect: currentSlide.correctOptionIndex === 1, idx: 1, color: '#ef4444', icon: '❌' }
                  ].map(tf => (
                    <div
                      key={tf.idx}
                      onClick={() => updateCurrentSlide('correctOptionIndex', tf.idx)}
                      style={{
                        background: tf.isCorrect ? `rgba(${tf.idx === 0 ? '16, 185, 129' : '239, 68, 68'}, 0.2)` : 'rgba(255, 255, 255, 0.04)',
                        border: tf.isCorrect ? `2px solid ${tf.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '1.2rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.6rem' }}>{tf.icon}</span>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: tf.color }}>{tf.label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            {tf.isCorrect ? '✅ Aangemerkt als correct' : 'Klik om als correct in te stellen'}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: `2px solid ${tf.color}`,
                        background: tf.isCorrect ? tf.color : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        {tf.isCorrect && <Check size={16} strokeWidth={3} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peiling Opties */}
            {currentSlide.type === 'poll' && (
              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.6rem' }}>
                  Peiling Keuzeopties
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(currentSlide.options || ['Optie 1', 'Optie 2']).map((opt, optIdx) => (
                    <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', width: '20px' }}>{optIdx + 1}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const newOpts = [...(currentSlide.options || [])];
                          newOpts[optIdx] = e.target.value;
                          updateCurrentSlide('options', newOpts);
                        }}
                        style={{
                          flex: 1,
                          background: 'rgba(10, 14, 26, 0.7)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '10px',
                          padding: '0.7rem 1rem',
                          color: '#fff',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open vraag / Woordwolk infobox */}
            {(currentSlide.type === 'open' || currentSlide.type === 'wordcloud') && (
              <div style={{
                background: 'rgba(124, 92, 252, 0.08)',
                border: '1px solid rgba(124, 92, 252, 0.2)',
                borderRadius: '14px',
                padding: '1rem',
                marginBottom: '1.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.8rem'
              }}>
                <Sparkles size={20} color="#c4b5fd" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5 }}>
                  {currentSlide.type === 'open' ? (
                    <span>
                      <strong>Live AI Clustering ingeschakeld:</strong> Tijdens de presentatie kunnen leerlingen hun eigen uitleg typen. Locra AI vat de antwoorden realtime samen op het digibord en toont de belangrijkste thema's en misconcepties!
                    </span>
                  ) : (
                    <span>
                      <strong>Dynamische Woordwolk:</strong> Leerlingen sturen kernbegrippen in vanaf hun smartphone. Begrippen die vaker worden ingestuurd groeien realtime dynamisch op het digibord.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Didactische Toelichting / Feedback */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.4rem' }}>
                Didactische Toelichting (Zichtbaar op het digibord bij het onthullen van de resultaten)
              </label>
              <textarea
                rows={2}
                value={currentSlide.explanation || ''}
                onChange={e => updateCurrentSlide('explanation', e.target.value)}
                placeholder="Bijv. Waarom is dit het juiste antwoord? Welke denkfout maakten veel leerlingen?"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 14, 26, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '0.8rem',
                  color: '#fff',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
