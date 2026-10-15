import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAcademyName } from '../../store/orgStore';
import { 
  ACADEMY_MODULES, 
  ACADEMY_GLOSSARY, 
  ACADEMY_CHECKLISTS,
  ACADEMY_PRESENTATIONS
} from './academyData';
import type { AcademyModule } from './academyData';
import ReactMarkdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import confetti from 'canvas-confetti';

export default function AcademyLayout() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(state => state.user);
  const academyName = useAcademyName();

  // Active view: 'overview' | 'module' | 'glossary' | 'checklists'
  const activeTab = searchParams.get('tab') || 'overview';
  const moduleId = searchParams.get('module') || 'wat-is-ai';

  const currentModule = ACADEMY_MODULES.find(m => m.id === moduleId) || ACADEMY_MODULES[0];

  // Quiz state: { [moduleId]: { [qId]: selectedIndex } }
  const [userAnswers, setUserAnswers] = useState<Record<string, Record<number, number>>>(() => {
    try {
      const saved = localStorage.getItem('locra_academy_answers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Quiz submitted state: { [moduleId]: boolean }
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('locra_academy_submitted');
      if (saved) return JSON.parse(saved);
      if (user?.academyProgress) return JSON.parse(user.academyProgress).submitted || {};
      return {};
    } catch {
      return {};
    }
  });

  const [xp, setXp] = useState(user?.academyXp || 0);
  const [level, setLevel] = useState(user?.academyLevel || 1);

  // Sync to backend
  const syncProgressToBackend = async (newXp: number, newLevel: number, submitted: Record<string, boolean>) => {
    if (!user) return;
    try {
      const token = useAuthStore.getState().token;
      await fetch('/api/users/me/academy', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          academyXp: newXp,
          academyLevel: newLevel,
          academyProgress: JSON.stringify({ submitted })
        })
      });
      // optionally update the store but it's okay for now
    } catch (e) {
      console.error('Failed to sync progress', e);
    }
  };

  const addXp = (amount: number) => {
    const newXp = xp + amount;
    const newLevel = Math.floor(newXp / 100) + 1; // Elke 100 XP is een level
    setXp(newXp);
    setLevel(newLevel);
    syncProgressToBackend(newXp, newLevel, quizSubmitted);
  };

  // Certificate modal
  const [showCertificate, setShowCertificate] = useState(false);

  // Search in Glossary
  const [searchTerm, setSearchTerm] = useState('');
  const [glossaryCategory, setGlossaryCategory] = useState<string>('all');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [glossaryViewMode, setGlossaryViewMode] = useState<'cards' | 'flashcards'>('flashcards');

  // --- Interactive Tools State ---
  // Tool 1: Groen AI / Efficiëntie Explorer
  const [dailyPrompts, setDailyPrompts] = useState(15);
  const [tokensPerPrompt, setTokensPerPrompt] = useState(800);
  const [modelType, setModelType] = useState<'large-cloud' | 'compact-cloud' | 'local'>('compact-cloud');

  // Tool 2: Confusion Matrix
  const [tp, setTp] = useState(45);
  const [fp, setFp] = useState(5);
  const [tn, setTn] = useState(40);
  const [fn, setFn] = useState(10);

  // Tool 5: CLEAR Prompt Studio
  const [clearContext, setClearContext] = useState('Biologieles over fotosynthese voor klas 2');
  const [clearLength, setClearLength] = useState('150 woorden in 3 alinea\'s');
  const [clearExamples, setClearExamples] = useState('Geef een alledaagse vergelijking zoals zonnepanelen');
  const [clearVerb, setClearVerb] = useState('Leg stapsgewijs uit en vergelijk');
  const [clearRole, setClearRole] = useState('Je bent een enthousiaste biologiedocent');
  
  // AI Professor Widget State
  // Interactive presentation state
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [presentationSlide, setPresentationSlide] = useState(0);
  const [presentationAnswers, setPresentationAnswers] = useState<Record<string, number>>({});
  const currentPresentation = ACADEMY_PRESENTATIONS[currentModule.id];

  const openPresentation = () => {
    setPresentationSlide(0);
    setPresentationAnswers({});
    setIsPresentationOpen(true);
  };

  const closePresentation = () => setIsPresentationOpen(false);

  useEffect(() => {
    if (!isPresentationOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePresentation();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPresentationSlide(prev => Math.min(prev + 1, (currentPresentation?.slides.length || 1) - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPresentationSlide(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresentationOpen, currentPresentation?.slides.length]);

  const [isProfessorOpen, setIsProfessorOpen] = useState(false);
  const [profMessages, setProfMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: `Hallo! Ik ben professor ${academyName || 'Locra'}. Heb je vragen over de theorie van deze module?` }
  ]);
  const [profInput, setProfInput] = useState('');
  const [isProfTyping, setIsProfTyping] = useState(false);

  // CLEAR Live Studio State
  const [liveClearResponse, setLiveClearResponse] = useState('');
  const [isLiveClearLoading, setIsLiveClearLoading] = useState(false);

  // Save quiz progress to localStorage
  useEffect(() => {
    localStorage.setItem('locra_academy_answers', JSON.stringify(userAnswers));
  }, [userAnswers]);

  useEffect(() => {
    localStorage.setItem('locra_academy_submitted', JSON.stringify(quizSubmitted));
  }, [quizSubmitted]);

  // Calculate scores
  const getModuleScore = (mod: AcademyModule) => {
    const answers = userAnswers[mod.id] || {};
    let correct = 0;
    mod.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) correct++;
    });
    return { correct, total: mod.questions.length, pct: Math.round((correct / mod.questions.length) * 100) };
  };

  const completedModulesCount = ACADEMY_MODULES.filter(m => quizSubmitted[m.id]).length;
  const allCompleted = completedModulesCount === ACADEMY_MODULES.length;

  const handleSelectAnswer = (modId: string, qId: number, optIndex: number) => {
    if (quizSubmitted[modId]) return; // locked once submitted
    setUserAnswers(prev => ({
      ...prev,
      [modId]: {
        ...(prev[modId] || {}),
        [qId]: optIndex
      }
    }));
  };

  const handleSubmitQuiz = (modId: string) => {
    const nextSubmitted = { ...quizSubmitted, [modId]: true };
    setQuizSubmitted(nextSubmitted);
    
    // Gamification
    addXp(50); // 50 XP per completed module
    syncProgressToBackend(xp + 50, Math.floor((xp + 50) / 100) + 1, nextSubmitted);

    // Confetti effect!
    const mod = ACADEMY_MODULES.find(m => m.id === modId);
    if (mod) {
      const score = getModuleScore(mod);
      if (score.pct === 100) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a5b4fc', '#38bdf8']
        });
      }
    }
  };

  const handleResetQuiz = (modId: string) => {
    setQuizSubmitted(prev => ({ ...prev, [modId]: false }));
    setUserAnswers(prev => {
      const next = { ...prev };
      delete next[modId];
      return next;
    });
  };

  const setView = (tab: string, modId?: string) => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (modId) params.set('module', modId);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculations for Green AI / Efficiency Explorer
  // These are deliberately relative indicators, not physical CO₂/water measurements.
  const totalTokensPerDay = dailyPrompts * tokensPerPrompt;
  const totalTokensPerMonth = totalTokensPerDay * 30;
  const relativeComputeFactor = modelType === 'large-cloud' ? 4 : modelType === 'compact-cloud' ? 2 : 1;
  const relativeComputeIndexMonth = Math.round((totalTokensPerMonth / 1000) * relativeComputeFactor);
  const efficiencyMessage =
    modelType === 'local'
      ? 'Lokaal kan controle over data en infrastructuur geven; beveiliging en energiegebruik blijven aandachtspunten.'
      : modelType === 'compact-cloud'
        ? 'Compact cloudmodel: vaak een logische start voor eenvoudige taken als de kwaliteit voldoende is.'
        : 'Krachtig cloudmodel: gebruik dit wanneer extra capaciteit aantoonbaar nodig is.';

  // Calculations for Confusion Matrix Tool
  const totalSamples = tp + fp + tn + fn || 1;
  const accuracy = Math.round(((tp + tn) / totalSamples) * 100);
  const precision = (tp + fp) > 0 ? Math.round((tp / (tp + fp)) * 100) : 0;
  const recall = (tp + fn) > 0 ? Math.round((tp / (tp + fn)) * 100) : 0;
  const f1Score = (precision + recall) > 0 ? Math.round((2 * precision * recall) / (precision + recall)) : 0;

  // CLEAR prompt constructor
  const constructedClearPrompt = `[ROL: ${clearRole}]\n[CONTEXT: ${clearContext}]\n\nOPDRACHT:\n${clearVerb}. Zorg voor een omvang van ongeveer ${clearLength}.${clearExamples ? `\n\nVOORBEELD / STIJL:\n${clearExamples}` : ''}\n\nAntwoord helder en gestructureerd.`;

  const handleTestInChat = (promptText: string) => {
    navigate(`/chat?prefill=${encodeURIComponent(promptText)}`);
  };

  const handleLiveClearTest = async () => {
    setIsLiveClearLoading(true);
    setLiveClearResponse('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: constructedClearPrompt }],
          model: 'llama3' // default model or logic
        })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setLiveClearResponse(data.message?.content || 'Geen antwoord ontvangen.');
      addXp(10); // Reward for testing
    } catch (e) {
      setLiveClearResponse('Fout bij het ophalen van het antwoord.');
    } finally {
      setIsLiveClearLoading(false);
    }
  };

  const handleProfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profInput.trim()) return;
    const userMsg = profInput.trim();
    setProfInput('');
    setProfMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsProfTyping(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `Je bent professor ${academyName}. Je beantwoordt vragen van studenten over de lesstof van Locra Academy. De huidige module gaat over: ${currentModule.title}. Houd je antwoord kort, educatief en vriendelijk.` },
            ...profMessages,
            { role: 'user', content: userMsg }
          ],
          model: 'llama3'
        })
      });
      const data = await res.json();
      if (data.message?.content) {
        setProfMessages(prev => [...prev, { role: 'assistant', content: data.message.content }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProfTyping(false);
    }
  };

  // Filter glossary
  const filteredGlossary = ACADEMY_GLOSSARY.filter(item => {
    const matchesCat = glossaryCategory === 'all' || item.category === glossaryCategory;
    const matchesSearch = item.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.definition.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Top Header Navigation ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 24px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => navigate('/chat')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ← Naar Chat
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>🎓</span>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(135deg, #a5b4fc, #6366f1, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {academyName}
                </h1>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Interactieve AI-Geletterdheid & Verantwoord Gebruik (12–18 jr)
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setView('overview')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'overview' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === 'overview' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📚 Modules ({completedModulesCount}/{ACADEMY_MODULES.length})
            </button>
            <button
              onClick={() => setView('glossary')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'glossary' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === 'glossary' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📖 Begrippenlijst
            </button>
            <button
              onClick={() => setView('checklists')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'checklists' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === 'checklists' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✅ Checklists
            </button>

            {allCompleted && (
              <button
                onClick={() => setShowCertificate(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #eab308',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#facc15',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🏆 Certificaat
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* ── Main Body Content ── */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '24px 20px' }}>
        
        {/* VIEW 1: OVERVIEW / MODULE SELECTOR */}
        {activeTab === 'overview' && (
          <div>
            {/* Hero Card */}
            {/* Hero Card met Mascotte & Kindergerichte tekst */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '24px',
              padding: '40px',
              marginBottom: '40px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              gap: '30px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {/* Tekst Content */}
              <div style={{ flex: '1 1 500px', zIndex: 2 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '20px', color: '#bae6fd', fontSize: '0.85rem', fontWeight: 700, marginBottom: '20px' }}>
                  <span>🚀</span> Locra AI Avontuur
                </div>
                <h2 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '0 0 16px 0', letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                  Welkom in de AI Wereld, {user?.displayName?.split(' ')[0] || 'verkenner'}!
                </h2>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)', margin: '0 0 24px 0', maxWidth: '600px' }}>
                  Heb je je ooit afgevraagd hoe robots en AI eigenlijk écht nadenken? In deze Locra Academy ontdek je alle geheimen van Kunstmatige Intelligentie. 
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎯</div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#38bdf8', fontSize: '0.95rem' }}>Wat ga je leren?</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hoe je de baas wordt over AI. Je leert hoe je AI de beste opdrachten ("prompts") geeft, neppe video's (deepfakes) herkent en hoe je checkt of een AI wel de waarheid spreekt.</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>💡</div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#a78bfa', fontSize: '0.95rem' }}>Waarom is dit belangrijk?</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Omdat AI de toekomst is! Als jij weet hoe het werkt, kun je het gebruiken als een superkracht voor je huiswerk en je toekomstige baan, zonder in de valkuilen te trappen.</p>
                  </div>
                </div>

                {/* Level & XP Badge */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.8rem' }}>🏆</span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#86efac', fontWeight: 700, textTransform: 'uppercase' }}>Jouw Niveau</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Level {level}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '12px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.8rem' }}>⚡</span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#bae6fd', fontWeight: 700, textTransform: 'uppercase' }}>Totale XP</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{xp} XP</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mascotte Graphic (Robot) */}
              <div style={{ flex: '1 1 250px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '240px',
                  height: '240px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  borderRadius: '50%',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 60px rgba(168, 85, 247, 0.4)'
                }}>
                  <span style={{ fontSize: '8rem', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}>🤖</span>
                  
                  {/* Zwevende elementen rond mascotte */}
                  <div style={{ position: 'absolute', top: '10%', right: '-10%', fontSize: '2rem', animation: 'float 3s ease-in-out infinite' }}>✨</div>
                  <div style={{ position: 'absolute', bottom: '20%', left: '-15%', fontSize: '2.5rem', animation: 'float 4s ease-in-out infinite reverse' }}>💡</div>
                  <div style={{ position: 'absolute', top: '-10%', left: '10%', fontSize: '1.8rem', animation: 'float 3.5s ease-in-out infinite' }}>🔍</div>
                </div>
              </div>
            </div>

            {/* Voortgangs- en Skill overzicht */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '40px',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1 1 400px' }}>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>Jouw Voortgang</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        {completedModulesCount} van de {ACADEMY_MODULES.length} modules afgerond ({Math.round((completedModulesCount / ACADEMY_MODULES.length) * 100)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(completedModulesCount / ACADEMY_MODULES.length) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                </div>
              </div>

                {/* Skill Radar Chart */}
                <div style={{ flex: '1 1 300px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                      { subject: 'AI Basis', A: quizSubmitted['wat-is-ai'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Prompting', A: quizSubmitted['prompt-engineering'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Fact-check', A: quizSubmitted['betrouwbaarheid-factchecking'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Metrics', A: quizSubmitted['begrippen-metrics'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Modellen', A: quizSubmitted['modelkeuze'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Groen AI', A: quizSubmitted['groen-ai'] ? 100 : 20, fullMark: 100 },
                      { subject: 'Ethiek', A: quizSubmitted['ethiek-deepfakes'] ? 100 : 20, fullMark: 100 },
                    ]}>
                      <PolarGrid stroke="rgba(255,255,255,0.2)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Skills" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Modules Grid */}
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📑</span> Lesmodules
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {ACADEMY_MODULES.map(m => {
                const score = getModuleScore(m);
                const isDone = quizSubmitted[m.id];

                return (
                  <div 
                    key={m.id}
                    onClick={() => setView('module', m.id)}
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: isDone ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '24px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = isDone ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '2rem' }}>{m.icon}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)'
                          }}>
                            Les {m.number}
                          </span>
                          {isDone && (
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '6px',
                              color: '#4ade80',
                              fontWeight: 600
                            }}>
                              ✓ {score.correct}/{score.total} goed ({score.pct}%)
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>
                        {m.title}
                      </h4>
                      <div style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} />, strong: ({node, ...props}) => <strong style={{ color: 'var(--text-primary)' }} {...props} /> }}>{m.summary}</ReactMarkdown>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', marginTop: '14px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {m.badge}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                        Start Les →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: SINGLE MODULE VIEW */}
        {activeTab === 'module' && (
          <div>
            {/* Back button and Module switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <button 
                onClick={() => setView('overview')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Terug naar Module Overzicht
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                {ACADEMY_MODULES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setView('module', m.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: m.id === currentModule.id ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                      color: m.id === currentModule.id ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {m.icon} {m.number}
                  </button>
                ))}
              </div>
            </div>

            {/* Module Header */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '28px',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>{currentModule.icon}</span>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Les {currentModule.number} • {currentModule.badge}
                  </span>
                  <h2 style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 800 }}>
                    {currentModule.title}
                  </h2>
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>
                <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} />, strong: ({node, ...props}) => <strong style={{ color: 'var(--text-primary)' }} {...props} /> }}>{currentModule.summary}</ReactMarkdown>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(56,189,248,0.08))',
              border: '1px solid rgba(129,140,248,0.28)',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '28px'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a5b4fc', marginBottom: '5px' }}>
                  🎬 Interactieve presentatie
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  {currentPresentation?.durationMinutes || 10} minuten • {currentPresentation?.slides.length || 0} slides • met mini-challenges
                </div>
              </div>
              <button
                onClick={openPresentation}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(165,180,252,0.35)',
                  background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(99,102,241,0.22)'
                }}
              >
                ▶ Start presentatie
              </button>
            </div>

            {/* Study Text & Theory */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '28px',
              marginBottom: '32px'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                📖 Lesstof & Theorie
              </h3>
              <div style={{ fontSize: '1.05rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.9)' }}>
                <ReactMarkdown
                  components={{
                    p: ({node, ...props}) => <p style={{ marginBottom: '16px' }} {...props} />,
                    strong: ({node, ...props}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }} {...props} />,
                    ul: ({node, ...props}) => <ul style={{ marginLeft: '24px', marginBottom: '16px' }} {...props} />,
                    li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
                    h1: ({node, ...props}) => <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '24px 0 16px' }} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '24px 0 12px' }} {...props} />,
                    h3: ({node, ...props}) => <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '20px 0 10px' }} {...props} />
                  }}
                >
                  {currentModule.studyText}
                </ReactMarkdown>
              </div>
            </div>

            {/* --- SPECIAL INTERACTIVE TOOLS PER MODULE --- */}

            {/* Module 1: Groen AI / Efficiency Explorer */}
            {currentModule.id === 'groen-ai' && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚡</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
                    Interactieve Tool: AI-Efficiëntie Explorer
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  Onderzoek hoe aantal prompts, tokens en modelkeuze samenhangen met relatief rekenwerk. Dit is bewust <strong>geen CO₂-, water- of prijsmeting</strong>: echte impact verschilt per model, hardware, datacenter en energiebron.
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
                  De IEA benadrukt dat zulke schattingen contextafhankelijk zijn en dat energiegebruik sterk varieert tussen toepassingen.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Prompts per dag: <strong>{dailyPrompts}</strong>
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={dailyPrompts} 
                      onChange={e => setDailyPrompts(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Tokens per prompt: <strong>{tokensPerPrompt}</strong>
                    </label>
                    <input 
                      type="range" 
                      min="200" 
                      max="4000" 
                      step="100"
                      value={tokensPerPrompt} 
                      onChange={e => setTokensPerPrompt(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Modelklasse:
                    </label>
                    <select 
                      value={modelType} 
                      onChange={e => setModelType(e.target.value as 'large-cloud' | 'compact-cloud' | 'local')}
                      className="input-field"
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                    >
                      <option value="large-cloud">Krachtig cloudmodel</option>
                      <option value="compact-cloud">Compact cloudmodel</option>
                      <option value="local">Lokaal / edge model</option>
                    </select>
                  </div>
                </div>

                {/* Relative results */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tokens per maand</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                      {totalTokensPerMonth.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      input + output van jouw gebruiksschatting
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Relatieve compute-index</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                      {relativeComputeIndexMonth}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      educatieve vergelijking, geen kWh of kg CO₂
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Slimme keuze voor deze instelling</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f0fdf4', marginTop: '4px', lineHeight: 1.45 }}>
                      {efficiencyMessage}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Module 2: Confusion Matrix Simulator */}
            {currentModule.id === 'begrippen-metrics' && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🧮</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#a5b4fc' }}>
                    Interactieve Tool: Confusion Matrix & Metric Calculator
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                  Pas de matrixwaarden aan of kies een preset om live te zien hoe Accuracy, Precision, Recall en F1-score veranderen.
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => { setTp(45); setFp(5); setTn(40); setFn(10); }}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Preset: Spamfilter (Lescasus)
                  </button>
                  <button 
                    onClick={() => { setTp(2); setFp(10); setTn(980); setFn(8); }}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Preset: Zeldzame Ziekte (Scheve Data)
                  </button>
                  <button 
                    onClick={() => { setTp(50); setFp(0); setTn(50); setFn(0); }}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Preset: Perfect Model (100%)
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
                  {/* Confusion Matrix Table */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      Voorspelling vs. Werkelijkheid
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#86efac' }}>True Positive (TP)</div>
                        <input type="number" value={tp} onChange={e => setTp(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }} />
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>False Positive (FP)</div>
                        <input type="number" value={fp} onChange={e => setFp(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }} />
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>False Negative (FN)</div>
                        <input type="number" value={fn} onChange={e => setFn(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }} />
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#86efac' }}>True Negative (TN)</div>
                        <input type="number" value={tn} onChange={e => setTn(Math.max(0, Number(e.target.value)))} style={{ width: '100%', padding: '4px', marginTop: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Accuracy</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{accuracy}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(TP+TN) / Totaal</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Precision (Precisie)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{precision}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TP / (TP+FP)</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Recall (Vangst)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fb923c' }}>{recall}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TP / (TP+FN)</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>F1-Score</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>{f1Score}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Harmonisch gemiddelde</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Module 3: Modelkeuze Vergelijkingstabel */}
            {currentModule.id === 'modelkeuze' && (
              <div style={{
                background: 'rgba(168, 85, 247, 0.06)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚖️</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#c084fc' }}>
                    Vergelijkingstabel: Welk model kies je wanneer?
                  </h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px' }}>Modeltype</th>
                        <th style={{ padding: '10px' }}>Voorbeelden</th>
                        <th style={{ padding: '10px' }}>Sterke punten</th>
                        <th style={{ padding: '10px' }}>Zwakke punten</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>Regelmodel (If-Then)</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Excel formules, beslislogica</td>
                        <td style={{ padding: '10px', color: '#86efac' }}>100% uitlegbaar, razendsnel, 0 GPU-kosten</td>
                        <td style={{ padding: '10px', color: '#fca5a5' }}>Niet zelflerend, faalt bij vrije tekst</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>Klassiek ML</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Decision Trees, SVM, K-Means</td>
                        <td style={{ padding: '10px', color: '#86efac' }}>Weinig data nodig, snel getraind op tabellen</td>
                        <td style={{ padding: '10px', color: '#fca5a5' }}>Minder geschikt voor audio/video/taal</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>CNN (Beeldnetwerk)</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>ResNet, EfficientNet</td>
                        <td style={{ padding: '10px', color: '#86efac' }}>Bewezen kampioen in beeldherkenning</td>
                        <td style={{ padding: '10px', color: '#fca5a5' }}>Veel data en zware GPU training vereist</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', fontWeight: 600 }}>LLM / Transformers</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>GPT, LLaMA, Claude</td>
                        <td style={{ padding: '10px', color: '#86efac' }}>Uitzonderlijk taalbegrip, multi-inzetbaar</td>
                        <td style={{ padding: '10px', color: '#fca5a5' }}>Kans op hallucinaties, privacy- en tokenkosten</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Module 4: De AI-Vraagloop Flowchart */}
            {currentModule.id === 'betrouwbaarheid-factchecking' && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.06)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🔄</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
                    Interactieve Flowchart: De AI-Vraagloop
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                  Volg deze stappen bij elk AI-antwoord om feitelijke betrouwbaarheid te garanderen:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { step: '1', title: 'Vraag stellen aan het AI-model', desc: 'Formuleer een afgebakende prompt.', icon: '💬' },
                    { step: '2', title: 'AI verwerkt en genereert antwoord', desc: 'Statistische woordvoorspelling vindt plaats.', icon: '⚙️' },
                    { step: '3', title: 'Kritische evaluatie: Klopt dit antwoord?', desc: 'Bevat het jaartallen, citaten of wiskunde? Wees extra alert!', icon: '🧐' },
                    { step: '4', title: 'Feitencontrole (Fact-checking)', desc: 'Check minstens 2 betrouwbare externe bronnen (Google Scholar, Wikipedia, schoolboek).', icon: '🔍' },
                    { step: '5', title: 'Besluit: Gebruiken of Bijsturen', desc: 'Klopt het? Gebruik het! Klopt het niet? Verbeter je vraag of gooi de uitvoer weg.', icon: '✅' }
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.3)', padding: '14px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                        {s.step}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
                      </div>
                      <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module 5: CLEAR Prompt Studio */}
            {currentModule.id === 'prompt-engineering' && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.06)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>✍️</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#facc15' }}>
                    CLEAR Prompt Studio: Bouw je Superprompt
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                  Vul de 5 onderdelen van het CLEAR-framework in en test de prompt direct in de Locra Chat!
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'block', marginBottom: '4px' }}>
                      C - Context
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={clearContext} 
                      onChange={e => setClearContext(e.target.value)}
                      placeholder="Waar gaat het over?" 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'block', marginBottom: '4px' }}>
                      L - Lengte & Vorm
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={clearLength} 
                      onChange={e => setClearLength(e.target.value)}
                      placeholder="Bv. 150 woorden, 3 alinea's" 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'block', marginBottom: '4px' }}>
                      E - Examples (Voorbeelden)
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={clearExamples} 
                      onChange={e => setClearExamples(e.target.value)}
                      placeholder="Bv. zoals: 1. Stap een..." 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'block', marginBottom: '4px' }}>
                      A - Actief werkwoord
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={clearVerb} 
                      onChange={e => setClearVerb(e.target.value)}
                      placeholder="Bv. Analyseer, Vergelijk, Leg uit" 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#facc15', display: 'block', marginBottom: '4px' }}>
                      R - Rol (Persona)
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={clearRole} 
                      onChange={e => setClearRole(e.target.value)}
                      placeholder="Bv. Je bent een geduldige wiskundeleraar" 
                    />
                  </div>
                </div>

                {/* Preview Box */}
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Gegenereerde CLEAR Prompt:
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: '#fef08a' }}>
                    {constructedClearPrompt}
                  </pre>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleLiveClearTest}
                    disabled={isLiveClearLoading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: isLiveClearLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: isLiveClearLoading ? 0.7 : 1
                    }}
                  >
                    {isLiveClearLoading ? 'Bezig met testen...' : '🚀 Test Live in Academy'}
                  </button>
                  <button
                    onClick={() => handleTestInChat(constructedClearPrompt)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid var(--primary)',
                      background: 'transparent',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    Open in grote Chat →
                  </button>
                </div>

                {liveClearResponse && (
                  <div style={{ marginTop: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Live AI Antwoord:
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {liveClearResponse}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Praktijkopdracht Box */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Praktijkopdracht
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                    {currentModule.assignment.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleTestInChat(currentModule.assignment.samplePrompt)}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px',
                    color: '#c7d2fe',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  💬 Oefen direct in Chat →
                </button>
              </div>

              <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                {currentModule.assignment.description}
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Voorbeeld prompt voor deze opdracht:
                </div>
                <code style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
                  "{currentModule.assignment.samplePrompt}"
                </code>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Beoordelingscriteria (Rubric):
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {currentModule.assignment.rubric.map((r, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Interactive Quiz Section */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '28px',
              marginBottom: '32px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                    ✍️ Kennisquiz: 5 Toetsvragen
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Test je kennis van {currentModule.shortTitle}.
                  </span>
                </div>

                {quizSubmitted[currentModule.id] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      background: getModuleScore(currentModule).pct >= 60 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${getModuleScore(currentModule).pct >= 60 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      color: getModuleScore(currentModule).pct >= 60 ? '#4ade80' : '#f87171',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}>
                      Score: {getModuleScore(currentModule).correct}/{getModuleScore(currentModule).total} goed ({getModuleScore(currentModule).pct}%)
                    </div>
                    <button
                      onClick={() => handleResetQuiz(currentModule.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-secondary)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Opnieuw
                    </button>
                  </div>
                )}
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {currentModule.questions.map((q, qIndex) => {
                  const selected = (userAnswers[currentModule.id] || {})[q.id];
                  const isSubmitted = quizSubmitted[currentModule.id];

                  return (
                    <div 
                      key={q.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '18px'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '14px' }}>
                        {qIndex + 1}. {q.question}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.options.map((opt, optIdx) => {
                          const isOptSelected = selected === optIdx;
                          const isCorrect = optIdx === q.correctIndex;

                          let bg = 'rgba(255,255,255,0.03)';
                          let border = '1px solid rgba(255,255,255,0.08)';
                          let textColor = 'var(--text-primary)';

                          if (isSubmitted) {
                            if (isCorrect) {
                              bg = 'rgba(34, 197, 94, 0.15)';
                              border = '1px solid rgba(34, 197, 94, 0.4)';
                              textColor = '#86efac';
                            } else if (isOptSelected && !isCorrect) {
                              bg = 'rgba(239, 68, 68, 0.15)';
                              border = '1px solid rgba(239, 68, 68, 0.4)';
                              textColor = '#fca5a5';
                            }
                          } else if (isOptSelected) {
                            bg = 'rgba(99, 102, 241, 0.2)';
                            border = '1px solid var(--primary)';
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={isSubmitted}
                              onClick={() => handleSelectAnswer(currentModule.id, q.id, optIdx)}
                              style={{
                                textAlign: 'left',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: bg,
                                border: border,
                                color: textColor,
                                fontSize: '0.88rem',
                                cursor: isSubmitted ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {isSubmitted && (
                        <div style={{
                          marginTop: '12px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: selected === q.correctIndex ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          fontSize: '0.82rem',
                          color: selected === q.correctIndex ? '#86efac' : '#fca5a5',
                          lineHeight: '1.5'
                        }}>
                          💡 <strong>Uitleg:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!quizSubmitted[currentModule.id] && (
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleSubmitQuiz(currentModule.id)}
                    disabled={Object.keys(userAnswers[currentModule.id] || {}).length < 5}
                    style={{
                      padding: '12px 28px',
                      borderRadius: '8px',
                      background: Object.keys(userAnswers[currentModule.id] || {}).length < 5 ? 'rgba(255,255,255,0.1)' : 'var(--primary)',
                      color: Object.keys(userAnswers[currentModule.id] || {}).length < 5 ? 'var(--text-muted)' : '#fff',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      border: 'none',
                      cursor: Object.keys(userAnswers[currentModule.id] || {}).length < 5 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Antwoorden Controleren ({Object.keys(userAnswers[currentModule.id] || {}).length}/5 beantwoord)
                  </button>
                </div>
              )}
            </div>

            {/* Next Module CTA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
              {currentModule.number > 1 ? (
                <button
                  onClick={() => setView('module', ACADEMY_MODULES[currentModule.number - 2].id)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ← Vorige Les
                </button>
              ) : <div />}

              {currentModule.number < 5 ? (
                <button
                  onClick={() => setView('module', ACADEMY_MODULES[currentModule.number].id)}
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Volgende Les: {ACADEMY_MODULES[currentModule.number].shortTitle} →
                </button>
              ) : (
                <button
                  onClick={() => setView('overview')}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🎉 Afronden & Naar Overzicht →
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: GLOSSARY / BEGRIPPENLIJST – FLASHCARDS */}
        {activeTab === 'glossary' && (
          <div>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0' }}>
                  📖 Begrippenlijst & AI Lexicon
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
                  {glossaryViewMode === 'flashcards' ? 'Klik op een kaart om hem om te draaien en het antwoord te zien!' : 'Alle essentiële termen overzichtelijk uitgelegd.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setGlossaryViewMode('flashcards')}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    background: glossaryViewMode === 'flashcards' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: glossaryViewMode === 'flashcards' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  🃏 Flashcards
                </button>
                <button
                  onClick={() => setGlossaryViewMode('cards')}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    background: glossaryViewMode === 'cards' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: glossaryViewMode === 'cards' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  📋 Lijst
                </button>
              </div>
            </div>

            {/* Category Filters */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {['all', 'Techniek', 'Metrics', 'Prompting', 'Ethiek & Wet'].map(cat => (
                <button
                  key={cat}
                  onClick={() => { setGlossaryCategory(cat); setFlashcardIndex(0); setFlashcardFlipped(false); }}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    background: glossaryCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: glossaryCategory === cat ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {cat === 'all' ? 'Alle Categorieën' : cat}
                </button>
              ))}
            </div>

            {glossaryViewMode === 'flashcards' ? (
              /* ── FLASHCARD MODE ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                {/* Progress */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Kaart {flashcardIndex + 1} van {filteredGlossary.length}
                </div>

                {/* The Flashcard */}
                {filteredGlossary.length > 0 && (
                  <div
                    onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                    style={{
                      width: '100%',
                      maxWidth: '560px',
                      minHeight: '320px',
                      perspective: '1000px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '320px',
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: flashcardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}>
                      {/* FRONT */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%', minHeight: '320px',
                        backfaceVisibility: 'hidden',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(30, 41, 59, 0.9))',
                        border: '2px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '24px',
                        padding: '40px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                      }}>
                        <span style={{
                          fontSize: '0.7rem', padding: '4px 12px', borderRadius: '12px',
                          background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', marginBottom: '20px'
                        }}>
                          {filteredGlossary[flashcardIndex]?.category}
                        </span>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 16px 0', color: '#a5b4fc' }}>
                          {filteredGlossary[flashcardIndex]?.term}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                          Klik om de definitie te zien 👆
                        </p>
                      </div>

                      {/* BACK */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%', minHeight: '320px',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(30, 41, 59, 0.95))',
                        border: '2px solid rgba(34, 197, 94, 0.4)',
                        borderRadius: '24px',
                        padding: '40px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                      }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0', color: '#86efac' }}>
                          {filteredGlossary[flashcardIndex]?.term}
                        </h3>
                        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px 0' }}>
                          {filteredGlossary[flashcardIndex]?.definition}
                        </p>
                        {filteredGlossary[flashcardIndex]?.example && (
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            🔍 <em>{filteredGlossary[flashcardIndex].example}</em>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFlashcardFlipped(false); setFlashcardIndex(Math.max(0, flashcardIndex - 1)); }}
                    disabled={flashcardIndex === 0}
                    style={{
                      padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: flashcardIndex === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                      color: flashcardIndex === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                      fontSize: '1rem', fontWeight: 600
                    }}
                  >
                    ← Vorige
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFlashcardFlipped(false); setFlashcardIndex(Math.min(filteredGlossary.length - 1, flashcardIndex + 1)); }}
                    disabled={flashcardIndex >= filteredGlossary.length - 1}
                    style={{
                      padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: flashcardIndex >= filteredGlossary.length - 1 ? 'rgba(255,255,255,0.03)' : 'var(--primary)',
                      color: flashcardIndex >= filteredGlossary.length - 1 ? 'rgba(255,255,255,0.3)' : '#fff',
                      fontSize: '1rem', fontWeight: 600
                    }}
                  >
                    Volgende →
                  </button>
                </div>

                {/* Mini dot indicators */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {filteredGlossary.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => { setFlashcardIndex(i); setFlashcardFlipped(false); }}
                      style={{
                        width: '10px', height: '10px', borderRadius: '50%', cursor: 'pointer',
                        background: i === flashcardIndex ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* ── LIST/CARD MODE ── */
              <div>
                <input 
                  type="text" 
                  placeholder="Zoek een begrip of definitie..." 
                  className="input-field"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', marginBottom: '20px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {filteredGlossary.map((g, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#a5b4fc' }}>
                            {g.term}
                          </h4>
                          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                            {g.category}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                          {g.definition}
                        </p>
                      </div>
                      {g.example && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          🔍 <em>Voorbeeld: {g.example}</em>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: CHECKLISTS */}
        {activeTab === 'checklists' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0' }}>
                ✅ AI Checklists voor Scholieren & Docenten
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
                Praktische vuistregels en richtlijnen voor veilig, verantwoord en doeltreffend AI-gebruik.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {ACADEMY_CHECKLISTS.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '20px'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '6px' }}>
                    {c.category}
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 700 }}>
                    {c.rule}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    💡 {c.tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Certificate Modal ── */}
      {showCertificate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '2px solid #eab308',
            borderRadius: '24px',
            maxWidth: '680px',
            width: '100%',
            padding: '40px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            position: 'relative',
            textAlign: 'center'
          }}>
            <button
              onClick={() => setShowCertificate(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🏆</div>
            <span style={{ fontSize: '0.85rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Officiële Bekroning
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '8px 0 16px 0', color: '#fff' }}>
              Certificaat van AI-Geletterdheid
            </h2>

            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              Dit certificaat bevestigt dat <strong>{user?.displayName || 'de leerling'}</strong> met succes alle {ACADEMY_MODULES.length} interactieve modules en toetsen heeft afgerond aan de
            </p>

            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginBottom: '24px' }}>
              {academyName}
            </div>

            {/* Badges row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#4ade80' }}>
                🌱 Groen AI Expert
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#38bdf8' }}>
                📊 Metrics & F1-Score
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(251, 146, 60, 0.15)', border: '1px solid rgba(251, 146, 60, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#fb923c' }}>
                ⚖️ Modelkeuze Specialist
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#c084fc' }}>
                🛡️ Fact-check Verificator
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#facc15' }}>
                ✍️ CLEAR Prompt Master
              </span>
              <span style={{ padding: '6px 12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '20px', fontSize: '0.8rem', color: '#fb7185' }}>
                🎭 Deepfake Detective
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Uitreikingsdatum: {new Date().toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            <button
              onClick={() => window.print()}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                color: '#000',
                fontWeight: 800,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              🖨️ Certificaat Afdrukken of Opslaan als PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Presentation Overlay ── */}
      {isPresentationOpen && currentPresentation && (() => {
        const slide = currentPresentation.slides[presentationSlide];
        if (!slide) return null;
        const selected = presentationAnswers[slide.id];
        const answered = typeof selected === 'number';
        const isLast = presentationSlide === currentPresentation.slides.length - 1;
        const goNext = () => {
          if (isLast) {
            setIsPresentationOpen(false);
            return;
          }
          setPresentationSlide(prev => Math.min(prev + 1, currentPresentation.slides.length - 1));
        };

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(2, 6, 23, 0.94)',
            backdropFilter: 'blur(18px)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '1.35rem' }}>{currentModule.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Les {currentModule.number} • Presentatie
                  </div>
                  <div style={{ fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentModule.shortTitle}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {presentationSlide + 1} / {currentPresentation.slides.length}
                </span>
                <button
                  onClick={closePresentation}
                  aria-label="Presentatie sluiten"
                  style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: '1rem'
                  }}
                >✕</button>
              </div>
            </div>

            <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${((presentationSlide + 1) / currentPresentation.slides.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #38bdf8)', transition: 'width 0.25s ease' }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px' }}>
              <div style={{ width: 'min(980px, 100%)' }}>
                <div style={{
                  background: 'linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '24px',
                  padding: 'clamp(24px, 5vw, 52px)',
                  boxShadow: '0 30px 90px rgba(0,0,0,0.45)'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(99,102,241,0.14)',
                    border: '1px solid rgba(129,140,248,0.3)',
                    color: '#c7d2fe',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '18px'
                  }}>
                    {slide.eyebrow}
                  </div>

                  <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', lineHeight: 1.08, color: '#fff', fontWeight: 900 }}>
                    {slide.title}
                  </h2>

                  <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: '1.06rem', lineHeight: 1.7 }}>
                    <ReactMarkdown components={{
                      p: ({node, ...props}) => <p style={{ margin: '0 0 18px' }} {...props} />,
                      strong: ({node, ...props}) => <strong style={{ color: '#fff' }} {...props} />
                    }}>
                      {slide.body}
                    </ReactMarkdown>
                  </div>

                  {slide.bullets && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '22px' }}>
                      {slide.bullets.map((bullet, index) => (
                        <div key={index} style={{
                          background: 'rgba(255,255,255,0.045)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '14px',
                          padding: '14px 16px',
                          color: 'rgba(255,255,255,0.84)',
                          lineHeight: 1.5,
                          fontSize: '0.9rem'
                        }}>
                          <span style={{ color: '#67e8f9', fontWeight: 900, marginRight: '8px' }}>{String(index + 1).padStart(2, '0')}</span>
                          {bullet}
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.callout && (
                    <div style={{
                      marginTop: '22px',
                      padding: '16px 18px',
                      borderRadius: '14px',
                      background: 'rgba(56,189,248,0.08)',
                      border: '1px solid rgba(56,189,248,0.22)',
                      color: '#bae6fd',
                      lineHeight: 1.55,
                      fontSize: '0.9rem'
                    }}>
                      💡 {slide.callout}
                    </div>
                  )}

                  {slide.question && (
                    <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem', marginBottom: '14px' }}>
                        🧩 Mini-check: {slide.question.prompt}
                      </div>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {slide.question.options.map((option, index) => {
                          const isSelected = selected === index;
                          const isCorrect = answered && index === slide.question!.correctIndex;
                          const isWrongSelected = answered && isSelected && !isCorrect;
                          return (
                            <button
                              key={index}
                              onClick={() => setPresentationAnswers(prev => ({ ...prev, [slide.id]: index }))}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '13px 15px',
                                borderRadius: '12px',
                                border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.55)' : isWrongSelected ? 'rgba(248,113,113,0.5)' : isSelected ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                background: isCorrect ? 'rgba(34,197,94,0.12)' : isWrongSelected ? 'rgba(239,68,68,0.10)' : isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.035)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.88rem',
                                lineHeight: 1.45
                              }}
                            >
                              <strong style={{ color: isCorrect ? '#86efac' : isWrongSelected ? '#fca5a5' : '#c7d2fe', marginRight: '8px' }}>
                                {String.fromCharCode(65 + index)}
                              </strong>
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <div style={{ marginTop: '14px', color: '#dbeafe', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '12px', padding: '12px 14px', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          {selected === slide.question.correctIndex ? '✅ Goed! ' : '💭 Bijna. '}{slide.question.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 'min(980px, 100%)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {currentPresentation.slides.map((_, index) => (
                    <button
                      key={index}
                      aria-label={`Ga naar slide ${index + 1}`}
                      onClick={() => setPresentationSlide(index)}
                      style={{
                        width: index === presentationSlide ? '26px' : '8px',
                        height: '8px',
                        borderRadius: '999px',
                        border: 'none',
                        background: index === presentationSlide ? '#818cf8' : 'rgba(255,255,255,0.18)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPresentationSlide(prev => Math.max(prev - 1, 0))}
                    disabled={presentationSlide === 0}
                    style={{ padding: '9px 13px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: presentationSlide === 0 ? 'rgba(255,255,255,0.3)' : '#fff', cursor: presentationSlide === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    ← Vorige
                  </button>
                  <button
                    onClick={goNext}
                    style={{ padding: '9px 15px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #38bdf8)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {isLast ? '✓ Afronden' : 'Volgende →'}
                  </button>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '7px' }}>
                Tip: gebruik ← → op je toetsenbord • Esc om te sluiten
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AI Professor Widget ── */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '16px'
      }}>
        {isProfessorOpen && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            width: '320px',
            height: '400px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <div style={{ background: 'var(--primary)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Professor {academyName || 'Locra'}</div>
              <button onClick={() => setIsProfessorOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {profMessages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  maxWidth: '85%',
                  lineHeight: '1.4'
                }}>
                  {msg.content}
                </div>
              ))}
              {isProfTyping && (
                <div style={{ alignSelf: 'flex-start', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Professor typt...
                </div>
              )}
            </div>

            <form onSubmit={handleProfSubmit} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
              <input
                type="text"
                value={profInput}
                onChange={e => setProfInput(e.target.value)}
                placeholder="Stel een theorie-vraag..."
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', outline: 'none' }}
              />
              <button type="submit" style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#fff' }}>
                ➤
              </button>
            </form>
          </div>
        )}

        <button
          onClick={() => setIsProfessorOpen(!isProfessorOpen)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
            border: 'none',
            color: '#fff',
            fontSize: '1.8rem',
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isProfessorOpen ? '✕' : '🎓'}
        </button>
      </div>

    </div>
  );
}
