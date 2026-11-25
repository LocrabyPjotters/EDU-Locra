import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { liveAudio } from '../../utils/liveAudio';
import DidacticMarkdownRenderer from '../../components/live/DidacticMarkdownRenderer';
import PlayfulLiveBackdrop from '../../components/live/PlayfulLiveBackdrop';
import {
  Flame, CheckCircle2, Send, Loader2,
  Trophy, Sparkles, ArrowRight,
  Plus, X, Volume2, VolumeX, Star, Zap
} from 'lucide-react';

interface LiveStudentPlayerProps {
  sessionId: string;
  participantId: string;
  initialNickname: string;
  initialAvatar?: string;
  initialColor?: string;
  onLeave?: () => void;
}

const OPTION_STYLES = [
  { bg: '#ef4444', edge: '#b91c1c', glow: 'rgba(239, 68, 68, 0.4)', icon: '▲', label: 'Rood' },
  { bg: '#3b82f6', edge: '#1d4ed8', glow: 'rgba(59, 130, 246, 0.4)', icon: '◆', label: 'Blauw' },
  { bg: '#f59e0b', edge: '#b45309', glow: 'rgba(245, 158, 11, 0.4)', icon: '●', label: 'Geel' },
  { bg: '#10b981', edge: '#047857', glow: 'rgba(16, 185, 129, 0.4)', icon: '■', label: 'Groen' }
];

const REACTION_EMOJIS = [
  { emoji: '💡', label: 'Inzicht!' },
  { emoji: '❓', label: 'Vraagje' },
  { emoji: '👍', label: 'Snap ik' },
  { emoji: '🔥', label: 'Lekker bezig!' },
  { emoji: '❤️', label: 'Super!' },
  { emoji: '🎉', label: 'Feest!' }
];

const CHIP_COLORS = [
  { bg: 'linear-gradient(135deg, #38bdf8, #3b82f6)', border: '#7dd3fc' },
  { bg: 'linear-gradient(135deg, #c084fc, #7c5cfc)', border: '#e9d5ff' },
  { bg: 'linear-gradient(135deg, #34d399, #059669)', border: '#6ee7b7' }
];

export default function LiveStudentPlayer({
  sessionId,
  participantId,
  initialNickname,
  initialAvatar = '🦊',
  initialColor = '#7c5cfc',
  onLeave
}: LiveStudentPlayerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const soundPlayedForRevealRef = useRef<number | null>(null);

  const [nickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [playerColor, setPlayerColor] = useState(initialColor);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [lastPointsAwarded, setLastPointsAwarded] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(liveAudio.isMuted());

  // Sessie state
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'finished'>('waiting');
  const [slideState, setSlideState] = useState<'question' | 'revealed' | 'leaderboard'>('question');
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [totalSlides, setTotalSlides] = useState(1);
  const [currentSlide, setCurrentSlide] = useState<any | null>(null);
  const [leaderboardList, setLeaderboardList] = useState<any[]>([]);
  const [finalPodium, setFinalPodium] = useState<any[]>([]);

  // Speler antwoord & reveal state
  const [submittedAnswer, setSubmittedAnswer] = useState<any | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<any | null>(null);
  const [revealInfo, setRevealInfo] = useState<{ explanation?: string; correctOptionIndex?: number } | null>(null);
  const [openText, setOpenText] = useState('');

  // Gedachtenwolk chips
  const [thoughtChips, setThoughtChips] = useState<string[]>([]);
  const [currentThoughtInput, setCurrentThoughtInput] = useState('');
  const [thoughtsSent, setThoughtsSent] = useState(false);

  // Speelse micro-interacties
  const [avatarHop, setAvatarHop] = useState(false);
  const [lobbyTapCount, setLobbyTapCount] = useState(0);
  const [activeReactionPop, setActiveReactionPop] = useState<string | null>(null);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    liveAudio.setMuted(next);
    if (!next) liveAudio.playTap();
  };

  const hopAvatar = () => {
    setAvatarHop(true);
    liveAudio.playTap();
    setTimeout(() => setAvatarHop(false), 380);
    if (sessionStatus === 'waiting') {
      const nextCount = lobbyTapCount + 1;
      setLobbyTapCount(nextCount);
      if (nextCount % 5 === 0) {
        try {
          confetti({ particleCount: 28, spread: 55, origin: { y: 0.45 } });
        } catch (_) {}
      }
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'player_init',
        sessionId,
        participantId
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'player_ready') {
          setScore(data.participant.score || 0);
          setStreak(data.participant.streak || 0);
          setBestStreak(prev => Math.max(prev, data.participant.streak || 0));
          if (data.participant.avatar) setAvatar(data.participant.avatar);
          if (data.participant.color) setPlayerColor(data.participant.color);
          setSessionStatus(data.session.status);
          setCurrentSlideIdx(data.session.currentSlideIdx);
          setSlideState(data.session.slideState);
          setTotalSlides(data.session.totalSlides || 1);
          setCurrentSlide(data.currentSlide);
          questionStartTimeRef.current = Date.now();
        } else if (data.type === 'session_started') {
          setSessionStatus('active');
          setCurrentSlideIdx(0);
          setSlideState('question');
          setCurrentSlide(data.slide);
          setSubmittedAnswer(null);
          setAnswerFeedback(null);
          setRevealInfo(null);
          setOpenText('');
          setThoughtChips([]);
          setCurrentThoughtInput('');
          setThoughtsSent(false);
          setLastPointsAwarded(null);
          soundPlayedForRevealRef.current = null;
          questionStartTimeRef.current = Date.now();
          liveAudio.playTap();
        } else if (data.type === 'slide_changed') {
          setCurrentSlideIdx(data.currentSlideIdx);
          setSlideState('question');
          setCurrentSlide(data.slide);
          setSubmittedAnswer(null);
          setAnswerFeedback(null);
          setRevealInfo(null);
          setOpenText('');
          setThoughtChips([]);
          setCurrentThoughtInput('');
          setThoughtsSent(false);
          setLastPointsAwarded(null);
          soundPlayedForRevealRef.current = null;
          questionStartTimeRef.current = Date.now();
          liveAudio.playTap();
        } else if (data.type === 'slide_revealed') {
          setSlideState('revealed');
          setRevealInfo({
            explanation: data.explanation,
            correctOptionIndex: data.correctOptionIndex
          });
        } else if (data.type === 'leaderboard_update') {
          setSlideState('leaderboard');
          if (Array.isArray(data.leaderboard)) {
            setLeaderboardList(data.leaderboard);
            const idx = data.leaderboard.findIndex((p: any) => p.id === participantId);
            if (idx !== -1) setRank(idx + 1);
          }
        } else if (data.type === 'session_finished') {
          setSessionStatus('finished');
          if (Array.isArray(data.podium)) {
            setFinalPodium(data.podium);
            const idx = data.podium.findIndex((p: any) => p.id === participantId);
            if (idx !== -1) setRank(idx + 1);
          }
          liveAudio.playSuccessChime();
          try {
            confetti({
              particleCount: 110,
              spread: 75,
              origin: { y: 0.6 }
            });
          } catch (_) {}
        } else if (data.type === 'answer_confirmed') {
          setScore(data.totalScore);
          setStreak(data.streak);
          setBestStreak(prev => Math.max(prev, data.streak || 0));
          setAnswerFeedback(data);
          if (data.pointsAwarded && data.pointsAwarded > 0) {
            setLastPointsAwarded(data.pointsAwarded);
            setTimeout(() => setLastPointsAwarded(null), 3000);
          }
        } else if (data.type === 'participant_kicked') {
          if (data.participantId === participantId) {
            alert('Je bent uit de sessie verwijderd door de docent.');
            if (onLeave) onLeave();
          }
        }
      } catch (e) {
        console.error('Player WS parse error:', e);
      }
    };

    return () => {
      socket.close();
    };
  }, [sessionId, participantId]);

  // Speel feedback geluid + mini-confetti wanneer resultaat onthuld wordt
  useEffect(() => {
    if (
      sessionStatus === 'active' &&
      slideState === 'revealed' &&
      (currentSlide?.type === 'multiple_choice' || currentSlide?.type === 'true_false') &&
      soundPlayedForRevealRef.current !== currentSlideIdx
    ) {
      soundPlayedForRevealRef.current = currentSlideIdx;
      if (answerFeedback?.isCorrect) {
        liveAudio.playSuccessChime();
        try {
          confetti({ particleCount: 55, spread: 65, origin: { y: 0.55 } });
        } catch (_) {}
      } else if (submittedAnswer !== null) {
        liveAudio.playWrongBoop();
      }
    }
  }, [sessionStatus, slideState, currentSlideIdx, currentSlide?.type, answerFeedback, submittedAnswer]);

  const submitAnswer = (val: string) => {
    if (submittedAnswer !== null) return;
    const responseTimeMs = Date.now() - questionStartTimeRef.current;

    liveAudio.playTap();
    setSubmittedAnswer(val);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player_answer',
        slideIndex: currentSlideIdx,
        answerValue: val,
        responseTimeMs
      }));
    }
  };

  const addThoughtChip = () => {
    const trimmed = currentThoughtInput.trim();
    if (!trimmed) return;
    if (thoughtChips.includes(trimmed) || thoughtChips.length >= 3) {
      setCurrentThoughtInput('');
      return;
    }
    liveAudio.playTap();
    setThoughtChips(prev => [...prev, trimmed]);
    setCurrentThoughtInput('');
  };

  const removeThoughtChip = (indexToRemove: number) => {
    liveAudio.playTap();
    setThoughtChips(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const sendThoughtCloud = () => {
    const remaining = currentThoughtInput.trim();
    const finalChips = remaining && !thoughtChips.includes(remaining) && thoughtChips.length < 3
      ? [...thoughtChips, remaining]
      : thoughtChips;

    if (finalChips.length === 0) return;

    liveAudio.playTap();
    setThoughtChips(finalChips);
    setThoughtsSent(true);
    setSubmittedAnswer(finalChips.join(', '));

    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player_answer',
        slideIndex: currentSlideIdx,
        answerValue: finalChips.join(', '),
        responseTimeMs
      }));
    }
  };

  const sendReaction = (emoji: string) => {
    liveAudio.playTap();
    setActiveReactionPop(emoji);
    setTimeout(() => setActiveReactionPop(null), 650);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player_reaction',
        reaction: emoji,
        nickname,
        avatar
      }));
    }
  };

  const progressPercent = totalSlides > 0 ? Math.min(100, Math.round(((currentSlideIdx + 1) / totalSlides) * 100)) : 0;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      overflow: 'hidden',
      fontFamily: 'Outfit, sans-serif',
      position: 'relative'
    }}>
      <PlayfulLiveBackdrop accentColor={playerColor} />

      {/* Top Game HUD Header */}
      <header style={{
        position: 'relative',
        zIndex: 20,
        padding: '0.7rem 1rem',
        background: 'rgba(13, 18, 38, 0.8)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem'
      }}>
        {/* Links: Bouncende Mascotte & Naam */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <button
            type="button"
            onClick={hopAvatar}
            style={{
              fontSize: '1.35rem',
              background: `${playerColor}33`,
              border: `2px solid ${playerColor}`,
              borderRadius: '12px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transform: avatarHop ? 'scale(1.22) rotate(-8deg)' : 'scale(1)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {avatar}
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.94rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nickname}
            </div>
            {sessionStatus === 'active' && (
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>
                Dia {currentSlideIdx + 1} van {totalSlides}
              </div>
            )}
          </div>
          {streak >= 2 && (
            <span style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.35), rgba(239, 68, 68, 0.35))',
              border: '1px solid rgba(251, 146, 60, 0.7)',
              color: '#fed7aa',
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              animation: 'pulse 1.3s infinite',
              flexShrink: 0
            }}>
              <Flame size={13} color="#fb923c" fill="#f97316" />
              <span>{streak}×</span>
            </span>
          )}
        </div>

        {/* Midden: Live Rang Pill */}
        {rank && (
          <div style={{
            background: rank <= 3 ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.25), rgba(245, 158, 11, 0.2))' : 'rgba(255, 255, 255, 0.08)',
            border: rank <= 3 ? '1.5px solid #facc15' : '1px solid rgba(255, 255, 255, 0.16)',
            color: rank <= 3 ? '#fef08a' : '#e2e8f0',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.76rem',
            fontWeight: 900,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'}</span>
            <span>#{rank}</span>
          </div>
        )}

        {/* Rechts: Geluid + Score Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={toggleSound}
            title={isMuted ? 'Geluid aanzetten' : 'Geluid dempen'}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMuted ? '#64748b' : '#38bdf8',
              cursor: 'pointer'
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <div style={{
            position: 'relative',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1.5px solid rgba(56, 189, 248, 0.45)',
            borderRadius: '999px',
            padding: '4px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {lastPointsAwarded && (
              <div style={{
                position: 'absolute',
                top: '-22px',
                right: '4px',
                color: '#4ade80',
                fontWeight: 900,
                fontSize: '0.92rem',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                animation: 'floatUpScore 2.2s ease-out forwards',
                whiteSpace: 'nowrap'
              }}>
                +{lastPointsAwarded} ⚡
              </div>
            )}
            <Star size={14} color="#facc15" fill="#facc15" />
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>{score}</span>
          </div>
        </div>
      </header>

      {/* Vrolijke Voortgangsbalk */}
      {sessionStatus === 'active' && (
        <div style={{ position: 'relative', zIndex: 15, height: '5px', background: 'rgba(255,255,255,0.08)', width: '100%' }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: `linear-gradient(90deg, ${playerColor}, #38bdf8, #34d399)`,
            transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)'
          }} />
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '78px' }}>

        {/* ── 1. WACHTEN OP START (SPEELSE LOBBY SPEELPAS) ── */}
        {sessionStatus === 'waiting' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{
              background: 'rgba(19, 25, 50, 0.85)',
              backdropFilter: 'blur(16px)',
              border: `2px solid ${playerColor}77`,
              borderRadius: '30px',
              padding: '2rem 1.8rem',
              maxWidth: '370px',
              width: '100%',
              boxShadow: `0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px ${playerColor}25`
            }}>
              <button
                type="button"
                onClick={hopAvatar}
                style={{
                  width: '104px',
                  height: '104px',
                  borderRadius: '30px',
                  background: `linear-gradient(145deg, ${playerColor}, #06b6d4)`,
                  border: '3px solid rgba(255, 255, 255, 0.45)',
                  borderBottom: '8px solid rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  boxShadow: `0 14px 35px ${playerColor}66`,
                  fontSize: '3.6rem',
                  cursor: 'pointer',
                  transform: avatarHop ? 'translateY(-14px) scale(1.16) rotate(8deg)' : 'translateY(0) scale(1)',
                  transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {avatar}
              </button>

              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                ✓ Spelerspas Actief — Tik op je mascotte!
              </div>
              <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.75rem', fontWeight: 900 }}>
                Welkom, {nickname}!
              </h2>
              <p style={{ margin: '0 auto 1.3rem auto', color: 'rgba(255,255,255,0.72)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                Kijk op het digibord of jouw mascotte er al bij staat. De docent start zo de les!
              </p>

              {/* Stuur alvast een vrolijke hallo naar het bord */}
              <div style={{ background: 'rgba(8, 12, 24, 0.6)', borderRadius: '18px', padding: '0.8rem', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.1rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Stuur alvast een seintje naar het digibord:
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {['👋', '🚀', '🔥', '😎', '🎉'].map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => sendReaction(e)}
                      style={{
                        background: activeReactionPop === e ? `${playerColor}66` : 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.16)',
                        borderBottom: '4px solid rgba(0,0,0,0.4)',
                        borderRadius: '14px',
                        fontSize: '1.45rem',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        transform: activeReactionPop === e ? 'scale(1.25) translateY(-4px)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124, 92, 252, 0.16)', border: '1px solid rgba(124, 92, 252, 0.35)', padding: '8px 16px', borderRadius: '999px', fontSize: '0.84rem', color: '#ddd6fe', fontWeight: 700 }}>
                <Loader2 size={15} className="spin" />
                <span>Wachten op startsein...</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. DEDICATED TUSSENSTAND / LEADERBOARD WEERGAVE ── */}
        {sessionStatus === 'active' && slideState === 'leaderboard' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.2rem', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(19, 25, 50, 0.88)',
              border: '2px solid rgba(250, 204, 21, 0.45)',
              borderRadius: '28px',
              padding: '1.5rem',
              width: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(250, 204, 21, 0.18)', border: '1px solid rgba(250, 204, 21, 0.4)', color: '#fde047', padding: '4px 14px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 900, marginBottom: '0.5rem' }}>
                  <Trophy size={14} />
                  <span>TUSSENSTAND</span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 900 }}>
                  {rank ? `Jij staat op plek #${rank}!` : `Jouw score: ${score} pnt`}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                  {rank === 1 ? '👑 Je gaat aan de leiding, houd vol!' : rank && rank <= 3 ? '🔥 Je staat op het virtuele podium!' : '⚡ Pak extra snelheidspunten bij de volgende vraag!'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {leaderboardList.map((p, idx) => {
                  const isMe = p.id === participantId;
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: isMe ? `${playerColor}38` : 'rgba(255, 255, 255, 0.05)',
                        border: isMe ? `2px solid ${playerColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '0.7rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', width: '28px', color: idx === 0 ? '#facc15' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#f59e0b' : '#94a3b8' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <span style={{ fontSize: '1.35rem' }}>{p.avatar || '🦊'}</span>
                        <span style={{ fontWeight: isMe ? 900 : 700, fontSize: '0.96rem' }}>
                          {p.nickname} {isMe && <span style={{ color: '#38bdf8', fontSize: '0.78rem' }}>(Jij)</span>}
                        </span>
                      </div>
                      <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#38bdf8' }}>
                        {p.score} <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>pnt</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. THEORIE / INHOUD SLIDE ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'content' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.2rem', maxWidth: '540px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(17, 23, 46, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '2px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '26px',
              padding: '1.3rem',
              width: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)'
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.16)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#7dd3fc', padding: '4px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.7rem' }}>
                <span>📖 THEORIE & INSTRUCTIE</span>
              </div>

              {currentSlide.imageUrl && (
                <div style={{ marginBottom: '0.9rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.16)' }}>
                  <img
                    src={currentSlide.imageUrl}
                    alt={currentSlide.imageCaption || currentSlide.title}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', maxHeight: '175px', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              )}

              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0 0 0.7rem 0', lineHeight: 1.25 }}>
                {currentSlide.title || 'Kijk naar het digibord'}
              </h2>

              {currentSlide.content ? (
                <div style={{ maxHeight: '38vh', overflowY: 'auto', paddingRight: '4px' }}>
                  <DidacticMarkdownRenderer content={currentSlide.content} compact />
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
                  De docent licht dit onderdeel klassikaal toe. Reageer gerust onderaan met 💡 of ❓!
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── 4. MEERKEUZE VRAAG (3D CHUNKY ARCADE GAMEPAD) ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'multiple_choice' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.9rem 1rem', maxWidth: '560px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {slideState === 'question' ? (
              submittedAnswer === null ? (
                <>
                  {/* Vraagkaartje bovenaan */}
                  <div style={{
                    background: 'rgba(17, 23, 46, 0.85)',
                    border: '1.5px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '20px',
                    padding: '0.85rem 1rem',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.35)'
                  }}>
                    {currentSlide.imageUrl && (
                      <img
                        src={currentSlide.imageUrl}
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        style={{ width: '58px', height: '58px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                        ⚡ Kies het juiste antwoord
                      </div>
                      <div style={{ fontSize: '1.02rem', fontWeight: 800, lineHeight: 1.3 }}>
                        {currentSlide.title}
                      </div>
                    </div>
                  </div>

                  {/* 3D Chunky Arcade Optie-Knoppen */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '0.75rem' }}>
                    {(currentSlide.options || ['A', 'B', 'C', 'D']).map((opt: string, idx: number) => {
                      const cfg = OPTION_STYLES[idx % OPTION_STYLES.length];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => submitAnswer(idx.toString())}
                          style={{
                            background: cfg.bg,
                            border: '2px solid rgba(255,255,255,0.22)',
                            borderBottom: `7px solid ${cfg.edge}`,
                            borderRadius: '24px',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer',
                            boxShadow: `0 10px 24px ${cfg.glow}`,
                            transition: 'transform 0.08s ease',
                            userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent',
                            gap: '6px',
                            textAlign: 'center'
                          }}
                          onPointerDown={e => (e.currentTarget.style.transform = 'translateY(4px) scale(0.97)')}
                          onPointerUp={e => (e.currentTarget.style.transform = 'none')}
                        >
                          <span style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, textShadow: '0 3px 6px rgba(0,0,0,0.25)' }}>{cfg.icon}</span>
                          <span style={{ fontSize: '0.94rem', fontWeight: 800, lineHeight: 1.25 }}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Antwoord Vergrendeld Kaart */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  {(() => {
                    const chosenIdx = parseInt(submittedAnswer, 10);
                    const chosenCfg = OPTION_STYLES[chosenIdx % OPTION_STYLES.length] || OPTION_STYLES[0];
                    return (
                      <div style={{
                        background: 'rgba(19, 25, 50, 0.88)',
                        border: `2px solid ${chosenCfg.bg}`,
                        borderRadius: '28px',
                        padding: '2rem',
                        maxWidth: '340px',
                        width: '100%',
                        boxShadow: `0 18px 45px ${chosenCfg.glow}`
                      }}>
                        <div style={{
                          width: '78px',
                          height: '78px',
                          borderRadius: '24px',
                          background: chosenCfg.bg,
                          borderBottom: `6px solid ${chosenCfg.edge}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 1rem auto',
                          fontSize: '2.5rem',
                          fontWeight: 900
                        }}>
                          {chosenCfg.icon}
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 6px 0' }}>
                          Antwoord vergrendeld! 🔒
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', margin: '0 0 1rem 0' }}>
                          Even spannend afwachten tot de rest van de klas klaar is...
                        </p>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.84rem', fontWeight: 700 }}>
                          <Loader2 size={15} className="spin" />
                          <span>Wachten op uitslag</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            ) : (
              /* Reveal State Celebration / Feedback */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0.5rem' }}>
                {answerFeedback?.isCorrect ? (
                  <div style={{
                    background: 'linear-gradient(155deg, rgba(16, 185, 129, 0.28), rgba(6, 182, 212, 0.2))',
                    border: '2.5px solid #34d399',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: '0 20px 50px rgba(16, 185, 129, 0.35)'
                  }}>
                    <div style={{ fontSize: '4.2rem', marginBottom: '6px' }}>🎉</div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#6ee7b7', margin: '0 0 6px 0' }}>
                      BAM! Helemaal goed!
                    </h2>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#10b981',
                      borderBottom: '4px solid #047857',
                      padding: '6px 18px',
                      borderRadius: '999px',
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      marginBottom: '0.8rem'
                    }}>
                      <Zap size={18} fill="#fff" />
                      <span>+{answerFeedback.pointsAwarded} punten!</span>
                    </div>
                    {streak >= 2 && (
                      <div style={{ color: '#fed7aa', fontWeight: 800, fontSize: '0.96rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <Flame size={18} color="#fb923c" fill="#f97316" />
                        <span>{streak} op een rij! Je gaat lekker!</span>
                      </div>
                    )}
                  </div>
                ) : submittedAnswer === null ? (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.16)',
                    border: '2px solid rgba(251, 191, 36, 0.5)',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '3.6rem', marginBottom: '6px' }}>⏰</div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fcd34d', margin: '0 0 6px 0' }}>
                      De tijd was om!
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', margin: 0 }}>
                      Snel reageren levert extra punten op — klaar voor de volgende!
                    </p>
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(155deg, rgba(239, 68, 68, 0.22), rgba(124, 92, 252, 0.18))',
                    border: '2px solid rgba(248, 113, 113, 0.55)',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '3.8rem', marginBottom: '6px' }}>💪</div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fca5a5', margin: '0 0 6px 0' }}>
                      Bijna raak!
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', margin: 0 }}>
                      Volgende vraag pak je de punten gewoon terug!
                    </p>
                  </div>
                )}

                {revealInfo?.explanation && (
                  <div style={{
                    marginTop: '0.9rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '18px',
                    padding: '0.9rem 1.1rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'left'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💡 Uitleg
                    </div>
                    <DidacticMarkdownRenderer content={revealInfo.explanation} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 5. WAAR / NIET WAAR (3D REUZEN ARCADE KNOPPEN) ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'true_false' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.9rem 1rem', maxWidth: '520px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {slideState === 'question' ? (
              submittedAnswer === null ? (
                <>
                  <div style={{
                    background: 'rgba(17, 23, 46, 0.85)',
                    border: '1.5px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '20px',
                    padding: '0.9rem 1.1rem',
                    marginBottom: '0.9rem',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.35)'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                      ⚖️ Stelling — Waar of Niet Waar?
                    </div>
                    <div style={{ fontSize: '1.06rem', fontWeight: 800, lineHeight: 1.35 }}>
                      {currentSlide.content || currentSlide.title}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', gap: '0.9rem' }}>
                    <button
                      type="button"
                      onClick={() => submitAnswer('0')}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: '2px solid rgba(255,255,255,0.28)',
                        borderBottom: '8px solid #047857',
                        borderRadius: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.9rem',
                        color: '#fff',
                        fontSize: '2.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: '0 12px 30px rgba(16, 185, 129, 0.45)',
                        transition: 'transform 0.08s ease',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                      onPointerDown={e => (e.currentTarget.style.transform = 'translateY(4px) scale(0.97)')}
                      onPointerUp={e => (e.currentTarget.style.transform = 'none')}
                    >
                      <span>✅</span>
                      <span>WAAR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => submitAnswer('1')}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        border: '2px solid rgba(255,255,255,0.28)',
                        borderBottom: '8px solid #991b1b',
                        borderRadius: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.9rem',
                        color: '#fff',
                        fontSize: '2.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: '0 12px 30px rgba(239, 68, 68, 0.45)',
                        transition: 'transform 0.08s ease',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                      onPointerDown={e => (e.currentTarget.style.transform = 'translateY(4px) scale(0.97)')}
                      onPointerUp={e => (e.currentTarget.style.transform = 'none')}
                    >
                      <span>❌</span>
                      <span>NIET WAAR</span>
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{
                    background: 'rgba(19, 25, 50, 0.88)',
                    border: `2px solid ${submittedAnswer === '0' ? '#10b981' : '#ef4444'}`,
                    borderRadius: '28px',
                    padding: '2rem',
                    maxWidth: '340px',
                    width: '100%'
                  }}>
                    <div style={{ fontSize: '3.8rem', marginBottom: '0.6rem' }}>
                      {submittedAnswer === '0' ? '✅' : '❌'}
                    </div>
                    <h3 style={{ fontSize: '1.45rem', fontWeight: 900, margin: '0 0 6px 0' }}>
                      Gestemd: {submittedAnswer === '0' ? 'WAAR' : 'NIET WAAR'}!
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.9rem', margin: 0 }}>
                      Spannend... zo meteen zie je het antwoord!
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0.5rem' }}>
                {answerFeedback?.isCorrect ? (
                  <div style={{
                    background: 'linear-gradient(155deg, rgba(16, 185, 129, 0.28), rgba(6, 182, 212, 0.2))',
                    border: '2.5px solid #34d399',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '4.2rem', marginBottom: '6px' }}>🎉</div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#6ee7b7', margin: '0 0 6px 0' }}>
                      Spot on!
                    </h2>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                      +{answerFeedback.pointsAwarded} punten! ⚡
                    </div>
                  </div>
                ) : submittedAnswer === null ? (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.16)',
                    border: '2px solid rgba(251, 191, 36, 0.5)',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '3.6rem', marginBottom: '6px' }}>⏰</div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fcd34d', margin: '0 0 6px 0' }}>
                      Tijd was om!
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', margin: 0 }}>
                      Kijk op het digibord voor het juiste antwoord.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(155deg, rgba(239, 68, 68, 0.22), rgba(124, 92, 252, 0.18))',
                    border: '2px solid rgba(248, 113, 113, 0.55)',
                    borderRadius: '28px',
                    padding: '1.8rem 1.4rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '3.8rem', marginBottom: '6px' }}>😅</div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fca5a5', margin: '0 0 6px 0' }}>
                      Helaas, niet juist!
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', margin: 0 }}>
                      Check de uitleg hieronder of op het bord!
                    </p>
                  </div>
                )}

                {revealInfo?.explanation && (
                  <div style={{
                    marginTop: '0.9rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '18px',
                    padding: '0.9rem 1.1rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'left'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💡 Uitleg
                    </div>
                    <DidacticMarkdownRenderer content={revealInfo.explanation} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 6. GEDACHTENWOLK / BRAINSTORM ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'wordcloud' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.2rem', maxWidth: '470px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(17, 23, 46, 0.85)',
              border: '2px solid rgba(168, 85, 247, 0.45)',
              borderRadius: '26px',
              padding: '1.3rem',
              marginBottom: '1rem',
              textAlign: 'center',
              boxShadow: '0 12px 32px rgba(168, 85, 247, 0.2)'
            }}>
              <div style={{ fontSize: '2.6rem', marginBottom: '4px' }}>☁️</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 4px 0' }}>
                {currentSlide.title || 'Gedachtenwolk'}
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.72)', margin: 0 }}>
                Voeg tot 3 kernbegrippen toe — ze vliegen live het digibord op!
              </p>
            </div>

            {!thoughtsSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={25}
                    value={currentThoughtInput}
                    onChange={e => setCurrentThoughtInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addThoughtChip();
                      }
                    }}
                    placeholder={thoughtChips.length >= 3 ? 'Maximum van 3 bereikt!' : `Typ woord ${thoughtChips.length + 1} van 3...`}
                    disabled={thoughtChips.length >= 3}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'rgba(8, 12, 24, 0.88)',
                      border: '2px solid rgba(168, 85, 247, 0.5)',
                      borderRadius: '16px',
                      padding: '0.85rem 1rem',
                      color: '#fff',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={addThoughtChip}
                    disabled={!currentThoughtInput.trim() || thoughtChips.length >= 3}
                    style={{
                      background: 'linear-gradient(135deg, #a855f7, #7c5cfc)',
                      border: 'none',
                      borderBottom: '5px solid #5b21b6',
                      color: '#fff',
                      borderRadius: '16px',
                      padding: '0 16px',
                      cursor: !currentThoughtInput.trim() || thoughtChips.length >= 3 ? 'not-allowed' : 'pointer',
                      opacity: !currentThoughtInput.trim() || thoughtChips.length >= 3 ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Plus size={22} strokeWidth={3} />
                  </button>
                </div>

                {/* Wolk-chips met kleurtjes */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', minHeight: '56px', padding: '0.5rem 0' }}>
                  {thoughtChips.map((chip, idx) => {
                    const c = CHIP_COLORS[idx % CHIP_COLORS.length];
                    return (
                      <span
                        key={idx}
                        style={{
                          background: c.bg,
                          border: `2px solid ${c.border}`,
                          color: '#fff',
                          borderRadius: '999px',
                          padding: '8px 16px',
                          fontSize: '1rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                        }}
                      >
                        <span>☁️ {chip}</span>
                        <button
                          type="button"
                          onClick={() => removeThoughtChip(idx)}
                          style={{ background: 'rgba(0,0,0,0.25)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={sendThoughtCloud}
                  disabled={thoughtChips.length === 0 && !currentThoughtInput.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                    border: 'none',
                    borderBottom: '6px solid #0e7490',
                    borderRadius: '20px',
                    padding: '1rem',
                    color: '#fff',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: thoughtChips.length === 0 && !currentThoughtInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: thoughtChips.length === 0 && !currentThoughtInput.trim() ? 0.45 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 10px 28px rgba(168, 85, 247, 0.4)',
                    marginTop: 'auto'
                  }}
                >
                  <Sparkles size={20} />
                  <span>LANCEER NAAR GEDACHTENWOLK!</span>
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '4.5rem', marginBottom: '0.6rem', animation: 'pulse 2s infinite' }}>☁️</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 8px 0', color: '#e9d5ff' }}>
                  Gelanceerd in de wolk!
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '0.9rem' }}>
                  {thoughtChips.map((chip, idx) => (
                    <span key={idx} style={{ background: CHIP_COLORS[idx % CHIP_COLORS.length].bg, padding: '6px 14px', borderRadius: '999px', fontWeight: 800, fontSize: '0.92rem' }}>
                      {chip}
                    </span>
                  ))}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', maxWidth: '300px', margin: 0 }}>
                  Kijk naar het digibord — zie je jouw begrippen al meedrijven?
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 7. OPEN VRAAG INVOER (SPEELSEL POST-IT WHITEBOARD KAART) ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'open' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.2rem', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(17, 23, 46, 0.85)',
              border: '1.5px solid rgba(255,255,255,0.14)',
              borderRadius: '20px',
              padding: '0.95rem 1.15rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#fcd34d', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                📝 Open Whiteboard Vraag
              </div>
              <div style={{ fontSize: '1.12rem', fontWeight: 800 }}>
                <DidacticMarkdownRenderer content={currentSlide.title} compact />
              </div>
            </div>

            {submittedAnswer === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                {/* Sticky Note Styling */}
                <div style={{
                  background: 'linear-gradient(155deg, #fef08a, #fde047)',
                  color: '#422006',
                  borderRadius: '22px',
                  padding: '1.2rem 1.1rem 0.9rem 1.1rem',
                  boxShadow: '0 14px 32px rgba(250, 204, 21, 0.25)',
                  position: 'relative',
                  borderBottom: '6px solid #eab308'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '62px',
                    height: '16px',
                    background: 'rgba(255, 255, 255, 0.55)',
                    borderRadius: '4px'
                  }} />
                  <textarea
                    rows={5}
                    maxLength={280}
                    value={openText}
                    onChange={e => setOpenText(e.target.value)}
                    placeholder="Schrijf hier op jouw Post-it wat jij denkt..."
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'transparent',
                      border: 'none',
                      color: '#422006',
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.74rem', fontWeight: 800, color: 'rgba(66, 32, 6, 0.55)' }}>
                    {openText.length} / 280 tekens
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (openText.trim()) submitAnswer(openText.trim());
                  }}
                  disabled={!openText.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                    border: 'none',
                    borderBottom: '6px solid #047857',
                    borderRadius: '20px',
                    padding: '1rem',
                    color: '#fff',
                    fontSize: '1.08rem',
                    fontWeight: 900,
                    cursor: !openText.trim() ? 'not-allowed' : 'pointer',
                    opacity: !openText.trim() ? 0.45 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 10px 26px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <Send size={18} />
                  <span>PLAK OP HET WHITEBOARD!</span>
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <CheckCircle2 size={60} color="#4ade80" />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0.8rem 0 4px 0' }}>
                  Geplakt! 📌
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.94rem', maxWidth: '300px' }}>
                  Jouw sticky note verschijnt op het bord — wie weet krijg jij wel de Spotlight!
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 8. PEILING / FEEDBACK ── */}
        {sessionStatus === 'active' && slideState !== 'leaderboard' && currentSlide?.type === 'poll' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.2rem', maxWidth: '470px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(17, 23, 46, 0.85)',
              border: '1.5px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '20px',
              padding: '1rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                📊 Jouw Mening Telt
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                <DidacticMarkdownRenderer content={currentSlide.title} compact />
              </div>
            </div>

            {submittedAnswer === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
                {(currentSlide.options || ['Optie 1', 'Optie 2']).map((opt: string, optIdx: number) => (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => submitAnswer(optIdx.toString())}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '2px solid rgba(255, 255, 255, 0.16)',
                      borderBottom: '5px solid rgba(56, 189, 248, 0.45)',
                      borderRadius: '18px',
                      padding: '1rem 1.2rem',
                      color: '#fff',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'transform 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                    onPointerDown={e => (e.currentTarget.style.transform = 'translateY(3px) scale(0.98)')}
                    onPointerUp={e => (e.currentTarget.style.transform = 'none')}
                  >
                    <span>{opt}</span>
                    <ArrowRight size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <CheckCircle2 size={58} color="#38bdf8" />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0.8rem 0 4px 0' }}>Stem meegeteld! ✅</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.94rem' }}>
                  Bekijk op het digibord hoe de rest van de klas stemt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 9. EINDE / FEESTELIJK PODIUM ── */}
        {sessionStatus === 'finished' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', maxWidth: '460px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              background: 'rgba(19, 25, 50, 0.88)',
              border: '2px solid rgba(250, 204, 21, 0.5)',
              borderRadius: '30px',
              padding: '2rem 1.5rem',
              width: '100%',
              boxSizing: 'border-box',
              boxShadow: '0 22px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(250, 204, 21, 0.2)'
            }}>
              <div style={{ fontSize: '4.2rem', marginBottom: '0.3rem' }}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆'}
              </div>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '0 0 0.4rem 0' }}>
                {rank && rank <= 3 ? `Podiumplek #${rank}!` : 'Geweldig gespeeld!'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.96rem', margin: '0 0 1.4rem 0' }}>
                {avatar} <strong>{nickname}</strong>, hier is jouw eindscore:
              </p>

              {/* Stats Raster */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.4rem' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.14)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '18px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#7dd3fc', fontWeight: 800, textTransform: 'uppercase' }}>Totaal Score</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>{score}</div>
                </div>
                <div style={{ background: 'rgba(249, 115, 22, 0.14)', border: '1px solid rgba(249, 115, 22, 0.35)', borderRadius: '18px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#fed7aa', fontWeight: 800, textTransform: 'uppercase' }}>Beste Reeks</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>{bestStreak}🔥</div>
                </div>
              </div>

              {finalPodium.length > 0 && (
                <div style={{ textAlign: 'left', marginBottom: '1.4rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fde047', textTransform: 'uppercase', marginBottom: '0.5rem', textAlign: 'center' }}>
                    Top 3 van de Klas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {finalPodium.slice(0, 3).map((p, idx) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: p.id === participantId ? `${playerColor}44` : 'rgba(255,255,255,0.05)', padding: '7px 12px', borderRadius: '12px', fontSize: '0.88rem' }}>
                        <span style={{ fontWeight: 700 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {p.avatar || '🦊'} {p.nickname}
                        </span>
                        <span style={{ fontWeight: 900, color: '#38bdf8' }}>{p.score} pnt</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onLeave) onLeave();
                  else window.location.href = '/live';
                }}
                style={{
                  width: '100%',
                  background: `linear-gradient(135deg, ${playerColor}, #06b6d4)`,
                  border: 'none',
                  borderBottom: '5px solid rgba(0,0,0,0.35)',
                  borderRadius: '16px',
                  padding: '0.9rem 1.5rem',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Nog een ronde spelen 🚀
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Live Reaction Arcade Dock */}
      {sessionStatus === 'active' && (
        <div style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(14px)',
          border: '1.5px solid rgba(255, 255, 255, 0.18)',
          borderBottom: '5px solid rgba(0,0,0,0.45)',
          borderRadius: '999px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
          zIndex: 50
        }}>
          {REACTION_EMOJIS.map(r => {
            const isAnimating = activeReactionPop === r.emoji;
            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => sendReaction(r.emoji)}
                title={r.label}
                style={{
                  background: isAnimating ? `${playerColor}66` : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  fontSize: '1.35rem',
                  cursor: 'pointer',
                  transform: isAnimating ? 'scale(1.38) translateY(-6px)' : 'scale(1)',
                  transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {r.emoji}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes floatUpScore {
          0% { opacity: 0; transform: translateY(0) scale(0.8); }
          25% { opacity: 1; transform: translateY(-10px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-28px) scale(1); }
        }
      `}</style>
    </div>
  );
}
