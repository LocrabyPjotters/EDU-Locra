import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { liveAudio } from '../../utils/liveAudio';
import {
  Users, Play, ArrowRight, ArrowLeft, Volume2, VolumeX,
  Maximize2, Minimize2, Check, X, Trophy, Flame,
  Clock, Sparkles, HelpCircle, AlertCircle, Loader2,
  Copy, LogOut, CheckCircle2, BarChart2, Pin, ZoomIn
} from 'lucide-react';
import Gedachtenwolk from '../../components/live/Gedachtenwolk';
import DidacticMarkdownRenderer from '../../components/live/DidacticMarkdownRenderer';

interface Participant {
  id: string;
  nickname: string;
  avatar?: string;
  color?: string;
  score: number;
  streak: number;
}

interface Slide {
  id: string;
  type: 'content' | 'multiple_choice' | 'true_false' | 'open' | 'wordcloud' | 'poll';
  title: string;
  content?: string;
  imageUrl?: string;
  imageCaption?: string;
  options?: string[];
  correctOptionIndex?: number;
  timeLimitSeconds?: number;
  points?: number;
  explanation?: string;
}

const OPTION_COLORS = [
  { bg: '#ef4444', icon: '▲', label: 'Rood' },
  { bg: '#3b82f6', icon: '◆', label: 'Blauw' },
  { bg: '#eab308', icon: '●', label: 'Geel' },
  { bg: '#22c55e', icon: '■', label: 'Groen' }
];

export default function LiveHostScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sessiestatus
  const [session, setSession] = useState<any>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [slideState, setSlideState] = useState<'question' | 'revealed' | 'leaderboard'>('question');
  const [status, setStatus] = useState<'waiting' | 'active' | 'finished'>('waiting');

  // Deelnemers & Antwoorden
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [revealedData, setRevealedData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [podium, setPodium] = useState<Participant[]>([]);

  // Open Vraag AI Clustering
  const [aiClusterAnalysis, setAiClusterAnalysis] = useState<any>(null);
  const [clusteringLoading, setClusteringLoading] = useState(false);

  // Audio & Fullscreen
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Realtime Live Features
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; reaction: string; nickname?: string; avatar?: string; leftPercent: number }>>([]);
  const [liveThoughts, setLiveThoughts] = useState<string[]>([]);
  const [spotlightedAnswerId, setSpotlightedAnswerId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; caption?: string } | null>(null);

  const currentSlide: Slide | null = slides[currentSlideIdx] || null;

  // 1. Initialiseer WebSocket en Sessie
  useEffect(() => {
    if (!sessionId || !token) return;

    // Haal initiele sessie data op
    fetch(`/api/live/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setSession(d.session);
        setStatus(d.session.status);
        setCurrentSlideIdx(d.session.currentSlideIdx);
        setSlideState(d.session.slideState);
        setParticipants(d.session.participants || []);

        try {
          const parsed = JSON.parse(d.session.lesson.slidesJson || '[]');
          setSlides(parsed);
        } catch (_) {}

        setLoading(false);
        initWebSocket();
      })
      .catch(e => {
        setError(e.message || 'Kon sessie niet laden');
        setLoading(false);
      });

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
      liveAudio.stopLobbyMusic();
    };
  }, [sessionId, token]);

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'host_init',
        sessionId,
        token
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'host_ready') {
          // Sessie bevestigd
        } else if (data.type === 'participant_joined') {
          setParticipants(prev => {
            const exists = prev.some(p => p.id === data.participant.id);
            if (exists) return prev;
            return [...prev, data.participant];
          });
        } else if (data.type === 'participant_left' || data.type === 'participant_kicked') {
          setParticipants(prev => prev.filter(p => p.id !== data.participantId));
        } else if (data.type === 'response_count_update') {
          setAnswerCount(data.count);
        } else if (data.type === 'reaction_received') {
          const newReaction = {
            id: `${Date.now()}-${Math.random()}`,
            reaction: data.reaction,
            nickname: data.nickname,
            avatar: data.avatar,
            leftPercent: 60 + Math.random() * 30
          };
          setFloatingReactions(prev => [...prev.slice(-20), newReaction]);
          setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 3200);
        } else if (data.type === 'live_thought_added') {
          // Server stuurt 'words' array (gesplitste woorden) + 'word' (originele tekst)
          if (data.words && Array.isArray(data.words)) {
            setLiveThoughts(prev => [...prev, ...data.words]);
          } else if (data.word) {
            setLiveThoughts(prev => [...prev, data.word]);
          }
        } else if (data.type === 'answer_spotlighted') {
          setSpotlightedAnswerId(prev => prev === data.answerId ? null : data.answerId);
        } else if (data.type === 'session_started') {
          setStatus('active');
          setCurrentSlideIdx(0);
          setSlideState('question');
          setAnswerCount(0);
          setRevealedData(null);
          setAiClusterAnalysis(null);
          setLiveThoughts([]);
          setSpotlightedAnswerId(null);
          liveAudio.stopLobbyMusic();
        } else if (data.type === 'slide_changed') {
          setCurrentSlideIdx(data.currentSlideIdx);
          setSlideState('question');
          setAnswerCount(0);
          setRevealedData(null);
          setAiClusterAnalysis(null);
          setLiveThoughts([]);
          setSpotlightedAnswerId(null);
        } else if (data.type === 'slide_revealed') {
          setSlideState('revealed');
          setRevealedData(data);
          liveAudio.playReveal();
        } else if (data.type === 'leaderboard_update') {
          setSlideState('leaderboard');
          setLeaderboard(data.leaderboard);
        } else if (data.type === 'session_finished') {
          setStatus('finished');
          setPodium(data.podium || []);
          liveAudio.playVictoryFanfare();
          try {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
          } catch (_) {}
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
  };

  // 2. Timer management per slide
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (status === 'active' && slideState === 'question' && currentSlide && currentSlide.type !== 'content') {
      const limit = currentSlide.timeLimitSeconds || 30;
      if (limit > 0) {
        setTimeLeft(limit);

        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(timerRef.current);
              // Tijd om: trigger automatisch reveal in Arena modus
              sendHostAction('reveal');
              return 0;
            }
            if (prev <= 5) {
              liveAudio.playUrgentTick();
            } else {
              liveAudio.playTick();
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setTimeLeft(null);
      }
    } else {
      setTimeLeft(null);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, slideState, currentSlideIdx]);

  // 3. Audio & Lobby muziek
  useEffect(() => {
    if (status === 'waiting' && !isMuted) {
      liveAudio.startLobbyMusic();
    } else {
      liveAudio.stopLobbyMusic();
    }
  }, [status, isMuted]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    liveAudio.setMuted(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const sendHostAction = (action: string, targetId?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'host_control',
        action,
        targetId
      }));
    }
  };

  // AI clustering aanroepen voor open vraag
  const runAiClustering = async () => {
    if (!revealedData?.responses || revealedData.responses.length === 0) return;
    setClusteringLoading(true);
    try {
      const res = await fetch('/api/live/cluster-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: currentSlide?.title,
          answers: revealedData.responses
        })
      });
      const d = await res.json();
      if (d.analysis) setAiClusterAnalysis(d.analysis);
    } catch (_) {}
    finally {
      setClusteringLoading(false);
    }
  };

  const copyPin = () => {
    if (session?.pinCode) {
      navigator.clipboard.writeText(session.pinCode);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const joinUrl = `${window.location.origin}/live`;

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', color: '#fff' }}>
        <Loader2 size={42} className="spin" color="#7c5cfc" />
        <p style={{ marginTop: '1.2rem', fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)' }}>Digibord sessie initialiseren...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', color: '#fff' }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ marginTop: '1rem', color: '#fca5a5' }}>{error || 'Sessie kon niet worden geladen'}</h2>
        <button onClick={() => navigate('/teacher')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Terug naar Docentenportaal
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(circle at 50% 20%, #151a33 0%, #090c18 100%)',
      color: '#fff',
      overflow: 'hidden',
      userSelect: 'none',
      fontFamily: 'Outfit, sans-serif'
    }}>
      {/* Top Bar Controls */}
      <header style={{
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10, 14, 26, 0.6)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 50
      }}>
        {/* Links: Titel & PIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <button
            onClick={() => {
              if (confirm('Wil je deze live sessie verlaten?')) navigate('/teacher');
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.65)',
              padding: '8px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem'
            }}
          >
            <LogOut size={14} />
            <span>Afsluiten</span>
          </button>

          <div>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>{session.lesson.title}</span>
            <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#c4b5fd', background: 'rgba(124,92,252,0.2)', padding: '2px 8px', borderRadius: '6px' }}>
              {session.lesson.subject || 'Vak'}
            </span>
          </div>
        </div>

        {/* Midden: PIN Badge */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kamercode:
          </span>
          <strong style={{ fontSize: '1.2rem', color: '#38bdf8', letterSpacing: '0.12em' }}>
            {session.pinCode}
          </strong>
        </div>

        {/* Rechts: Audio, Deelnemers, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.88rem' }}>
            <Users size={16} color="#a5b4fc" />
            <span style={{ fontWeight: 700 }}>{participants.length}</span>
          </div>

          <button
            onClick={toggleMute}
            title={isMuted ? 'Geluid inschakelen' : 'Dempen'}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: isMuted ? 'rgba(255,255,255,0.4)' : '#38bdf8',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={toggleFullscreen}
            title="Volledig scherm (F11)"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* ── STATE 1: WACHTRUIMTE / LOBBY ── */}
      {status === 'waiting' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 3rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(25, 33, 60, 0.85), rgba(14, 18, 38, 0.95))',
            border: '2px solid rgba(124, 92, 252, 0.35)',
            borderRadius: '32px',
            padding: '2.5rem 3.5rem',
            boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(124, 92, 252, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '3rem',
            maxWidth: '920px',
            width: '100%',
            marginBottom: '2.5rem'
          }}>
            {/* QR Code */}
            <div style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '20px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <QRCodeSVG
                value={`${joinUrl}?pin=${session.pinCode}`}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Instructies & Grote PIN */}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.9rem', color: '#c4b5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Doe mee op je mobiel of laptop
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', marginBottom: '1.2rem', color: '#fff' }}>
                Ga naar <span style={{ color: '#38bdf8' }}>{window.location.host}/live</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '2px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '16px',
                  padding: '10px 24px',
                  fontSize: '2.8rem',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  color: '#fff',
                  fontFamily: 'monospace'
                }}>
                  {session.pinCode}
                </div>
                <button
                  onClick={copyPin}
                  title="Kopieer kamercode"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {copiedPin ? <Check size={20} color="#4ade80" /> : <Copy size={20} />}
                </button>
              </div>

              {/* Start Knop */}
              <button
                onClick={() => sendHostAction('start')}
                style={{
                  background: participants.length > 0 ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '14px 36px',
                  color: '#fff',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: participants.length > 0 ? '0 8px 30px rgba(16, 185, 129, 0.4)' : 'none',
                  transition: 'all 0.2s',
                  animation: participants.length > 0 ? 'pulse 2s infinite' : 'none'
                }}
              >
                <Play size={20} fill="#fff" />
                <span>Start Les & Quiz ({participants.length} gereed)</span>
              </button>
            </div>
          </div>

          {/* Lobby Deelnemers Badges */}
          <div style={{ width: '100%', maxWidth: '1100px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '1.2rem' }}>
              Deelnemers in de wachtruimte ({participants.length})
            </h3>

            {participants.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem' }}>
                Wachten tot de eerste leerling de kamercode invoert of de QR-code scant...
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'center', maxHeight: '180px', overflowY: 'auto' }}>
                {participants.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.05))',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '16px',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                      animation: 'fadeIn 0.25s ease-out'
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{p.avatar || '🦊'}</span>
                    <span>{p.nickname}</span>
                    <button
                      onClick={() => sendHostAction('kick', p.id)}
                      title="Verwijder uit lobby"
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px', marginLeft: '4px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STATE 2 & 3: ACTIEVE SLIDE (VRAAG OF ONTHULLING) ── */}
      {status === 'active' && slideState !== 'leaderboard' && currentSlide && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem 3rem', overflowY: 'auto' }}>
          {/* Subheader: Voortgang & Timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1rem', color: '#c4b5fd', fontWeight: 700 }}>
              Onderdeel {currentSlideIdx + 1} van {slides.length} • {currentSlide.type.toUpperCase()}
            </span>

            {/* Timer Bubble */}
            {timeLeft !== null && slideState === 'question' && (
              <div style={{
                background: timeLeft <= 5 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(124, 92, 252, 0.2)',
                border: timeLeft <= 5 ? '2px solid #ef4444' : '2px solid #7c5cfc',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                fontWeight: 900,
                color: timeLeft <= 5 ? '#fca5a5' : '#fff',
                boxShadow: timeLeft <= 5 ? '0 0 20px rgba(239, 68, 68, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}>
                {timeLeft}
              </div>
            )}

            {/* Antwoorden teller */}
            {currentSlide.type !== 'content' && (
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 16px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700 }}>
                Antwoorden: <span style={{ color: '#38bdf8' }}>{answerCount}</span> / {participants.length}
              </div>
            )}
          </div>

          {/* Slide Hoofdtitel, Informatieve Blokken & Afbeelding */}
          {currentSlide.type === 'content' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '1240px', width: '100%', margin: '0 auto 1.5rem auto' }}>
              <h1 style={{ fontSize: '2.35rem', fontWeight: 900, margin: '0 0 1.4rem 0', lineHeight: 1.2, textAlign: 'center', letterSpacing: '-0.01em' }}>
                {currentSlide.title}
              </h1>

              <div style={{
                display: 'grid',
                gridTemplateColumns: currentSlide.imageUrl ? 'minmax(0, 1.3fr) minmax(0, 0.9fr)' : 'minmax(0, 1fr)',
                gap: '1.8rem',
                alignItems: 'center'
              }}>
                {currentSlide.content && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '24px',
                    padding: '1.8rem 2.2rem',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(12px)',
                    maxHeight: '58vh',
                    overflowY: 'auto'
                  }}>
                    <DidacticMarkdownRenderer content={currentSlide.content} />
                  </div>
                )}

                {currentSlide.imageUrl && (
                  <div
                    onClick={() => setZoomedImage({ url: currentSlide.imageUrl!, caption: currentSlide.imageCaption || currentSlide.title })}
                    title="Klik om afbeelding schermvullend te bekijken"
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '24px',
                      padding: '0.85rem',
                      boxShadow: '0 18px 45px rgba(0, 0, 0, 0.45)',
                      cursor: 'zoom-in',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#050814' }}>
                      <img
                        src={currentSlide.imageUrl}
                        alt={currentSlide.imageCaption || currentSlide.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        style={{
                          width: '100%',
                          maxHeight: '420px',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(10, 14, 26, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#e2e8f0'
                      }}>
                        <ZoomIn size={14} color="#38bdf8" />
                        <span>Vergroot</span>
                      </div>
                    </div>
                    {currentSlide.imageCaption && (
                      <div style={{ marginTop: '0.7rem', padding: '0 0.4rem', fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.78)', fontWeight: 500, textAlign: 'center' }}>
                        🖼️ {currentSlide.imageCaption}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', margin: '0 auto 1.5rem auto', maxWidth: '1120px', width: '100%' }}>
              <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 1rem 0', lineHeight: 1.25 }}>
                {currentSlide.title}
              </h1>

              {(currentSlide.content || currentSlide.imageUrl) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: currentSlide.imageUrl && currentSlide.content ? 'minmax(0, 1.4fr) minmax(0, 0.7fr)' : 'minmax(0, 1fr)',
                  gap: '1.2rem',
                  alignItems: 'center',
                  maxWidth: '1060px',
                  margin: '0 auto'
                }}>
                  {currentSlide.content && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '18px',
                      padding: '1rem 1.4rem',
                      textAlign: 'left'
                    }}>
                      <DidacticMarkdownRenderer content={currentSlide.content} compact />
                    </div>
                  )}

                  {currentSlide.imageUrl && (
                    <div
                      onClick={() => setZoomedImage({ url: currentSlide.imageUrl!, caption: currentSlide.imageCaption || currentSlide.title })}
                      title="Klik om bronafbeelding te vergroten"
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '16px',
                        padding: '6px',
                        cursor: 'zoom-in',
                        position: 'relative',
                        margin: currentSlide.content ? '0' : '0 auto',
                        maxWidth: currentSlide.content ? '100%' : '360px'
                      }}
                    >
                      <img
                        src={currentSlide.imageUrl}
                        alt={currentSlide.imageCaption || currentSlide.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        style={{
                          width: '100%',
                          maxHeight: '190px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          display: 'block'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Vraagtype Inhoud */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
            {/* A. Meerkeuze Arena Tegels */}
            {currentSlide.type === 'multiple_choice' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '2rem' }}>
                {(currentSlide.options || []).map((opt, optIdx) => {
                  const cfg = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                  const isCorrect = currentSlide.correctOptionIndex === optIdx;
                  const isRevealed = slideState === 'revealed';
                  const count = revealedData?.optionCounts?.[optIdx] || 0;

                  return (
                    <div
                      key={optIdx}
                      style={{
                        background: cfg.bg,
                        borderRadius: '20px',
                        padding: '1.8rem 2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                        opacity: isRevealed && !isCorrect ? 0.35 : 1,
                        border: isRevealed && isCorrect ? '4px solid #fff' : 'none',
                        transform: isRevealed && isCorrect ? 'scale(1.02)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, opacity: 0.9 }}>{cfg.icon}</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 700 }}>{opt}</span>
                      </div>

                      {isRevealed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{count}</span>
                          {isCorrect && <Check size={28} strokeWidth={3} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* B. Waar / Niet Waar Stelling (Arena) */}
            {currentSlide.type === 'true_false' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {[
                  { label: 'WAAR', icon: '✅', idx: 0, bg: 'linear-gradient(135deg, #10b981, #059669)', border: '#34d399', count: revealedData?.optionCounts?.[0] || 0 },
                  { label: 'NIET WAAR', icon: '❌', idx: 1, bg: 'linear-gradient(135deg, #ef4444, #dc2626)', border: '#f87171', count: revealedData?.optionCounts?.[1] || 0 }
                ].map(tf => {
                  const isCorrect = currentSlide.correctOptionIndex === tf.idx;
                  const isRevealed = slideState === 'revealed';
                  const totalVotes = (revealedData?.optionCounts?.[0] || 0) + (revealedData?.optionCounts?.[1] || 0);
                  const pct = totalVotes > 0 ? Math.round((tf.count / totalVotes) * 100) : 0;

                  return (
                    <div
                      key={tf.idx}
                      style={{
                        background: tf.bg,
                        borderRadius: '24px',
                        padding: '2.5rem 2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: '1rem',
                        boxShadow: '0 12px 35px rgba(0,0,0,0.35)',
                        opacity: isRevealed && !isCorrect ? 0.35 : 1,
                        border: isRevealed && isCorrect ? '5px solid #fff' : `2px solid ${tf.border}`,
                        transform: isRevealed && isCorrect ? 'scale(1.03)' : 'none',
                        transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <span style={{ fontSize: '3.5rem' }}>{tf.icon}</span>
                      <span style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '0.04em' }}>{tf.label}</span>

                      {isRevealed && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '2.4rem', fontWeight: 900 }}>{tf.count} stemmen</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 700, opacity: 0.9 }}>({pct}%)</span>
                          {isCorrect && (
                            <div style={{ marginTop: '8px', background: '#fff', color: '#059669', padding: '6px 16px', borderRadius: '999px', fontWeight: 900, fontSize: '1rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
                              ✓ Juiste Antwoord
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* C. Gedachtenwolk / Brainstorm */}
            {currentSlide.type === 'wordcloud' && (
              <div style={{ marginBottom: '2rem' }}>
                <Gedachtenwolk
                  words={revealedData?.wordFrequencies}
                  rawThoughts={liveThoughts}
                  title="Klassikale Gedachtenwolk"
                  emptyMessage="Leerlingen kunnen nu woorden of gedachten insturen vanaf hun telefoon. De wolk verschijnt en groeit live op het scherm zodra antwoorden binnenkomen!"
                />
              </div>
            )}

            {/* D. Peiling / Feedback */}
            {currentSlide.type === 'poll' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {(currentSlide.options || ['Optie 1', 'Optie 2']).map((opt, optIdx) => {
                  const count = revealedData?.optionCounts?.[optIdx] || 0;
                  const totalVotes = Object.values(revealedData?.optionCounts || {}).reduce((a: any, b: any) => a + b, 0) as number || 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const palette = ['#38bdf8', '#a855f7', '#34d399', '#f472b6', '#fbbf24'][optIdx % 5];

                  return (
                    <div
                      key={optIdx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '16px',
                        padding: '1.4rem 1.8rem',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {slideState === 'revealed' && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${palette}30, ${palette}70)`,
                            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                          }}
                        />
                      )}

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{opt}</span>
                        {slideState === 'revealed' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: 900 }}>{count} stemmen</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: palette }}>({pct}%)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* E. Open Vraag: Post-It Whiteboard & AI Clustering */}
            {currentSlide.type === 'open' && (
              <div style={{ marginBottom: '2rem' }}>
                {slideState === 'revealed' && (
                  <div style={{ marginBottom: '1.5rem', background: 'rgba(124, 92, 252, 0.12)', border: '1px solid rgba(124, 92, 252, 0.35)', borderRadius: '20px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={22} color="#c4b5fd" />
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#c4b5fd' }}>
                          Locra AI Realtime Antwoord-Clustering
                        </h3>
                      </div>
                      {!aiClusterAnalysis && (
                        <button
                          onClick={runAiClustering}
                          disabled={clusteringLoading}
                          style={{
                            background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
                            border: 'none',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {clusteringLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                          <span>Analyseer Antwoorden met AI</span>
                        </button>
                      )}
                    </div>

                    {aiClusterAnalysis ? (
                      <div>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#fff', lineHeight: 1.5 }}>
                          {aiClusterAnalysis.summary}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          {(aiClusterAnalysis.topThemes || []).map((t: string, i: number) => (
                            <span key={i} style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '6px 12px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600 }}>
                              📌 {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                        {revealedData?.responses?.length || 0} open antwoorden ontvangen. Klik hierboven om ze realtime door AI te laten samenvatten.
                      </p>
                    )}
                  </div>
                )}

                {/* Post-It Whiteboard met Sticky Notes */}
                {slideState === 'revealed' && revealedData?.responses && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    padding: '1.5rem',
                    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📋 Post-It Whiteboard ({revealedData.responses.length} inzendingen)
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                        Klik op Spotlight om een antwoord te vergroten voor de klas
                      </span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '1.2rem',
                      maxHeight: '320px',
                      overflowY: 'auto',
                      padding: '8px'
                    }}>
                      {revealedData.responses.map((r: any, idx: number) => {
                        const POST_IT_PALETTES = [
                          { bg: 'linear-gradient(135deg, #fef08a, #fde047)', text: '#713f12', border: '#facc15', tape: 'rgba(253, 224, 71, 0.7)' },
                          { bg: 'linear-gradient(135deg, #bae6fd, #7dd3fc)', text: '#0c4a6e', border: '#38bdf8', tape: 'rgba(125, 211, 252, 0.7)' },
                          { bg: 'linear-gradient(135deg, #fbcfe8, #f472b6)', text: '#831843', border: '#f472b6', tape: 'rgba(244, 114, 182, 0.7)' },
                          { bg: 'linear-gradient(135deg, #bbf7d0, #86efac)', text: '#14532d', border: '#4ade80', tape: 'rgba(74, 222, 128, 0.7)' },
                          { bg: 'linear-gradient(135deg, #fed7aa, #fdba74)', text: '#7c2d12', border: '#fb923c', tape: 'rgba(251, 146, 60, 0.7)' },
                          { bg: 'linear-gradient(135deg, #e9d5ff, #d8b4fe)', text: '#581c87', border: '#c084fc', tape: 'rgba(192, 132, 252, 0.7)' }
                        ];
                        const pal = POST_IT_PALETTES[idx % POST_IT_PALETTES.length];
                        const isSpotlighted = spotlightedAnswerId === r.id;
                        // Subtiele organische rotatie (-2 tot 2 graden)
                        const rotation = (idx % 5 - 2) * 1.2;

                        return (
                          <div
                            key={r.id || idx}
                            style={{
                              background: pal.bg,
                              color: pal.text,
                              borderRadius: '12px',
                              padding: '1.1rem 1.2rem',
                              boxShadow: isSpotlighted
                                ? '0 0 30px #facc15, 0 12px 28px rgba(0,0,0,0.5)'
                                : '0 6px 18px rgba(0,0,0,0.25)',
                              border: isSpotlighted ? '3px solid #facc15' : `1px solid ${pal.border}`,
                              transform: isSpotlighted ? 'scale(1.08) rotate(0deg)' : `rotate(${rotation}deg)`,
                              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              minHeight: '130px',
                              position: 'relative'
                            }}
                          >
                            {/* Tape visual bovenaan */}
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '45px',
                              height: '14px',
                              background: pal.tape,
                              borderRadius: '3px',
                              opacity: 0.8
                            }} />

                            <div style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.45, marginBottom: '0.8rem' }}>
                              "{r.answer}"
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed rgba(0,0,0,0.15)', paddingTop: '6px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.85 }}>
                                {r.avatar ? `${r.avatar} ` : ''}{r.nickname}
                              </span>
                              <button
                                onClick={() => sendHostAction('spotlight', r.id)}
                                style={{
                                  background: isSpotlighted ? '#d97706' : 'rgba(0,0,0,0.08)',
                                  color: isSpotlighted ? '#fff' : pal.text,
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Pin size={11} />
                                <span>{isSpotlighted ? 'Spotlight ★' : 'Spotlight'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Didactische toelichting box bij reveal */}
            {slideState === 'revealed' && currentSlide.explanation && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px',
                padding: '1.2rem 1.6rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                textAlign: 'left'
              }}>
                <CheckCircle2 size={24} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Toelichting</div>
                  <DidacticMarkdownRenderer content={currentSlide.explanation} compact />
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls: Vorige, Reveal, Leaderboard, Volgende */}
          <footer style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => sendHostAction('prev_slide')}
              disabled={currentSlideIdx === 0}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: currentSlideIdx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.8)',
                padding: '10px 18px',
                borderRadius: '12px',
                cursor: currentSlideIdx === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              <ArrowLeft size={16} />
              <span>Vorige</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {slideState === 'question' && currentSlide.type !== 'content' && (
                <button
                  onClick={() => sendHostAction('reveal')}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    border: 'none',
                    color: '#fff',
                    padding: '12px 28px',
                    borderRadius: '14px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)'
                  }}
                >
                  Onthul Antwoorden
                </button>
              )}

              {slideState === 'revealed' && (
                <button
                  onClick={() => sendHostAction('show_leaderboard')}
                  style={{
                    background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                    border: 'none',
                    color: '#fff',
                    padding: '12px 28px',
                    borderRadius: '14px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 20px rgba(124, 92, 252, 0.4)'
                  }}
                >
                  <Trophy size={18} />
                  <span>Toon Leaderboard</span>
                </button>
              )}

              <button
                onClick={() => sendHostAction('next_slide')}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  border: 'none',
                  color: '#fff',
                  padding: '12px 28px',
                  borderRadius: '14px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                }}
              >
                <span>{currentSlideIdx < slides.length - 1 ? 'Volgende Slide' : 'Naar Podium'}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* ── STATE 4: LEADERBOARD / TUSSENSTAND ── */}
      {status === 'active' && slideState === 'leaderboard' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 3rem' }}>
          <div style={{ width: '100%', maxWidth: '750px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(250, 204, 21, 0.15)', border: '1px solid rgba(250, 204, 21, 0.35)', color: '#facc15', padding: '6px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              <Trophy size={18} />
              <span>TUSSENSTAND TOP 5</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
              {leaderboard.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 75, 0.8), rgba(18, 25, 48, 0.9))',
                    border: idx === 0 ? '2px solid #facc15' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '18px',
                    padding: '1.2rem 2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                    animation: 'fadeIn 0.3s ease-out'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: idx === 0 ? '#facc15' : 'rgba(255,255,255,0.5)', width: '30px' }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontSize: '1.6rem' }}>{p.avatar || '🦊'}</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{p.nickname}</span>
                    {p.streak >= 2 && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Flame size={12} color="#ef4444" />
                        <span>{p.streak} streak</span>
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8' }}>
                    {p.score} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>pnt</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => sendHostAction('next_slide')}
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
                border: 'none',
                color: '#fff',
                padding: '14px 40px',
                borderRadius: '16px',
                fontSize: '1.15rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 25px rgba(124, 92, 252, 0.4)'
              }}
            >
              <span>{currentSlideIdx < slides.length - 1 ? 'Volgende Vraag' : 'Naar Podium'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STATE 5: EIND PODIUM / CELEBRATION ── */}
      {status === 'finished' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>👑</span>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '8px 0', background: 'linear-gradient(135deg, #facc15, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Gefeliciteerd Winnaars!
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Geweldig gespeeld door de hele klas. Hier is het podium:
            </p>
          </div>

          {/* 3-Traps Olympisch Podium */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1.5rem', marginBottom: '3rem', height: '320px', width: '100%', maxWidth: '800px' }}>
            {/* 2e Plaats (Zilver) */}
            {podium[1] && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🥈</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{podium[1].avatar || '🦊'}</span>
                  <span>{podium[1].nickname}</span>
                </div>
                <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1.1rem', marginBottom: '10px' }}>{podium[1].score} pnt</div>
                <div style={{
                  width: '100%',
                  height: '170px',
                  background: 'linear-gradient(180deg, #94a3b8, #475569)',
                  borderRadius: '16px 16px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#fff',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                }}>
                  2
                </div>
              </div>
            )}

            {/* 1e Plaats (Goud) */}
            {podium[0] && (
              <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: '6px' }}>🥇</div>
                <div style={{ fontWeight: 900, fontSize: '1.4rem', marginBottom: '4px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{podium[0].avatar || '🦊'}</span>
                  <span>{podium[0].nickname}</span>
                </div>
                <div style={{ color: '#fef08a', fontWeight: 800, fontSize: '1.3rem', marginBottom: '10px' }}>{podium[0].score} pnt</div>
                <div style={{
                  width: '100%',
                  height: '240px',
                  background: 'linear-gradient(180deg, #facc15, #ca8a04)',
                  borderRadius: '20px 20px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3.5rem',
                  fontWeight: 900,
                  color: '#fff',
                  boxShadow: '0 12px 40px rgba(250, 204, 21, 0.4)'
                }}>
                  1
                </div>
              </div>
            )}

            {/* 3e Plaats (Brons) */}
            {podium[2] && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🥉</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{podium[2].avatar || '🦊'}</span>
                  <span>{podium[2].nickname}</span>
                </div>
                <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1.1rem', marginBottom: '10px' }}>{podium[2].score} pnt</div>
                <div style={{
                  width: '100%',
                  height: '120px',
                  background: 'linear-gradient(180deg, #d97706, #92400e)',
                  borderRadius: '16px 16px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#fff',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                }}>
                  3
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/teacher')}
            style={{
              background: 'linear-gradient(135deg, #7c5cfc, #06b6d4)',
              border: 'none',
              color: '#fff',
              padding: '14px 36px',
              borderRadius: '16px',
              fontSize: '1.1rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 6px 25px rgba(124, 92, 252, 0.4)'
            }}
          >
            Terug naar Docentenportaal
          </button>
        </div>
      )}

      {/* Floating Live Reaction Stream */}
      <div style={{
        position: 'fixed',
        bottom: '80px',
        right: '25px',
        width: '320px',
        height: '420px',
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden'
      }}>
        {floatingReactions.map(r => (
          <div
            key={r.id}
            style={{
              position: 'absolute',
              bottom: '10px',
              left: `${r.leftPercent - 60}%`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 14px',
              borderRadius: '999px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
              animation: 'glideUpFade 3.2s ease-out forwards'
            }}
          >
            <span style={{ fontSize: '1.6rem' }}>{r.reaction}</span>
            {r.nickname && (
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                {r.avatar ? `${r.avatar} ` : ''}{r.nickname}
              </span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes glideUpFade {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.7);
          }
          15% {
            opacity: 1;
            transform: translateY(0px) scale(1.1);
          }
          25% {
            transform: translateY(-20px) scale(1);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translateY(-260px) scale(0.9);
          }
        }
      `}</style>

      {/* Lightbox voor vergrote afbeelding op digibord */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 20, 0.92)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomedImage.url}
            alt={zoomedImage.caption || 'Vergrote afbeelding'}
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              borderRadius: '20px',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8)',
              border: '2px solid rgba(56, 189, 248, 0.4)'
            }}
          />
          {zoomedImage.caption && (
            <p style={{ marginTop: '1rem', fontSize: '1.15rem', color: '#e2e8f0', fontWeight: 600 }}>
              🖼️ {zoomedImage.caption}
            </p>
          )}
          <span style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
            Klik ergens om te sluiten
          </span>
        </div>
      )}
    </div>
  );
}
