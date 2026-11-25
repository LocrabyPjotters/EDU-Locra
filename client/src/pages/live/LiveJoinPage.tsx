import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { liveAudio } from '../../utils/liveAudio';
import {
  Sparkles, Loader2, CheckCircle2, AlertCircle, Dice5, Rocket
} from 'lucide-react';
import LiveStudentPlayer from './LiveStudentPlayer';
import PlayfulLiveBackdrop from '../../components/live/PlayfulLiveBackdrop';

const AVATARS = [
  '🦊', '🚀', '⚡', '🦉', '🦁', '🐬',
  '🎨', '🦄', '🐯', '🐼', '🌟', '🤖',
  '🐸', '🐧', '🐙', '🦖', '🦋', '🎮'
];

const PLAYER_THEMES = [
  { hex: '#7c5cfc', shadow: '#5b21b6', name: 'Cosmic' },
  { hex: '#06b6d4', shadow: '#0e7490', name: 'Oceaan' },
  { hex: '#f97316', shadow: '#c2410c', name: 'Vuur' },
  { hex: '#10b981', shadow: '#047857', name: 'Smaragd' },
  { hex: '#ec4899', shadow: '#be185d', name: 'Neon' },
  { hex: '#eab308', shadow: '#a16207', name: 'Goud' }
];

export default function LiveJoinPage() {
  const location = useLocation();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  const queryPin = new URLSearchParams(location.search).get('pin') || '';

  const [pin, setPin] = useState(queryPin);
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState('🦊');
  const [themeColor, setThemeColor] = useState(PLAYER_THEMES[0]);
  const [avatarHop, setAvatarHop] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionInfo, setSessionInfo] = useState<any | null>(null);
  const [joinedData, setJoinedData] = useState<{
    sessionId: string;
    participantId: string;
    nickname: string;
    avatar?: string;
    color?: string;
  } | null>(null);

  const cleanPin = pin.replace(/[^0-9]/g, '');

  useEffect(() => {
    if (cleanPin.length === 6) {
      fetch(`/api/live/sessions/by-pin/${cleanPin}`)
        .then(r => r.json())
        .then(d => {
          if (!d.error) {
            setSessionInfo(d);
            setError(null);
            liveAudio.playTap();
          } else {
            setSessionInfo(null);
            setError(d.error);
          }
        })
        .catch(() => {
          setSessionInfo(null);
        });
    } else {
      setSessionInfo(null);
    }
  }, [cleanPin]);

  const triggerHop = () => {
    setAvatarHop(true);
    liveAudio.playTap();
    setTimeout(() => setAvatarHop(false), 380);
  };

  const pickRandomCharacter = () => {
    const nextAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const nextTheme = PLAYER_THEMES[Math.floor(Math.random() * PLAYER_THEMES.length)];
    setAvatar(nextAvatar);
    setThemeColor(nextTheme);
    triggerHop();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPin.length < 6) {
      setError('Voer een geldige 6-cijferige kamercode in.');
      return;
    }

    const cleanNick = nickname.trim();
    if (!cleanNick || cleanNick.length < 2) {
      setError('Kies een schermnaam van minimaal 2 tekens.');
      return;
    }

    setLoading(true);
    setError(null);
    liveAudio.playTap();

    try {
      const res = await fetch(`/api/live/sessions/by-pin/${cleanPin}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: cleanNick,
          avatar,
          color: themeColor.hex,
          token: token || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deelnemen mislukt');

      setJoinedData({
        sessionId: data.sessionId,
        participantId: data.participantId,
        nickname: data.nickname,
        avatar: data.avatar || avatar,
        color: data.color || themeColor.hex
      });
    } catch (err: any) {
      setError(err.message || 'Fout bij deelnemen');
    } finally {
      setLoading(false);
    }
  };

  if (joinedData) {
    return (
      <LiveStudentPlayer
        sessionId={joinedData.sessionId}
        participantId={joinedData.participantId}
        initialNickname={joinedData.nickname}
        initialAvatar={joinedData.avatar || '🦊'}
        initialColor={joinedData.color || themeColor.hex}
        onLeave={() => {
          setJoinedData(null);
          setPin('');
        }}
      />
    );
  }

  const canJoin = cleanPin.length === 6 && nickname.trim().length >= 2 && !loading;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      padding: '1.2rem',
      fontFamily: 'Outfit, sans-serif',
      position: 'relative',
      overflowY: 'auto'
    }}>
      <PlayfulLiveBackdrop accentColor={themeColor.hex} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(19, 24, 48, 0.88)',
        backdropFilter: 'blur(20px)',
        border: `2px solid ${themeColor.hex}55`,
        borderRadius: '32px',
        width: '100%',
        maxWidth: '450px',
        padding: '1.8rem 1.7rem',
        boxShadow: `0 25px 70px -15px rgba(0, 0, 0, 0.85), 0 0 45px ${themeColor.hex}25`,
        textAlign: 'center',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease'
      }}>
        {/* Speelse Mascotte / Character Preview Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.2rem' }}>
          <button
            type="button"
            onClick={triggerHop}
            title="Tik op je mascotte!"
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '26px',
              background: `linear-gradient(145deg, ${themeColor.hex}, ${themeColor.shadow})`,
              border: '3px solid rgba(255, 255, 255, 0.35)',
              borderBottom: `7px solid ${themeColor.shadow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.9rem',
              cursor: 'pointer',
              boxShadow: `0 12px 28px ${themeColor.hex}55`,
              transform: avatarHop ? 'translateY(-10px) scale(1.12) rotate(-6deg)' : 'translateY(0) scale(1)',
              transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease',
              userSelect: 'none'
            }}
          >
            {avatar}
          </button>

          <div style={{ marginTop: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.14)' }}>
            <Sparkles size={13} color="#facc15" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', color: '#e2e8f0' }}>
              LOCRA LIVE ARENA
            </span>
          </div>

          <h1 style={{ margin: '0.4rem 0 2px 0', fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
            {nickname.trim() ? `Hoi, ${nickname.trim()}!` : 'Klaar om mee te spelen?'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.65)' }}>
            Vul de code van het digibord in & kies jouw karakter
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.18)',
            border: '2px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '16px',
            padding: '0.75rem 1rem',
            color: '#fecaca',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
            animation: 'fadeIn 0.2s ease'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Kamercode Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.35rem', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🎮 Kamercode (6 cijfers)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000 000"
              autoFocus={!queryPin}
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(8, 12, 24, 0.85)',
                border: sessionInfo ? '2.5px solid #34d399' : `2px solid ${themeColor.hex}44`,
                borderRadius: '18px',
                padding: '0.8rem',
                color: '#fff',
                fontSize: '1.75rem',
                fontWeight: 900,
                letterSpacing: '0.26em',
                textAlign: 'center',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: sessionInfo ? '0 0 22px rgba(52, 211, 153, 0.3)' : 'inset 0 3px 8px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          {/* Gevonden sessie kaartje */}
          {sessionInfo && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.14))',
              border: '2px solid rgba(52, 211, 153, 0.5)',
              borderRadius: '18px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'left',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <CheckCircle2 size={22} color="#34d399" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessionInfo.lesson.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: 600 }}>
                  {sessionInfo.lesson.subject || 'Vak'} • {sessionInfo.participantCount} spelers online
                </div>
              </div>
            </div>
          )}

          {/* Nickname Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.35rem', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🏷️ Jouw Spelersnaam
            </label>
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Bijv. Lisa, SnelleVos, Boaz"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(8, 12, 24, 0.85)',
                border: '2px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '16px',
                padding: '0.85rem 1rem',
                color: '#fff',
                fontSize: '1.08rem',
                fontWeight: 700,
                textAlign: 'center',
                outline: 'none'
              }}
            />
          </div>

          {/* Mascotte & Kleurthema Kiezer */}
          <div style={{
            background: 'rgba(8, 12, 24, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Kies Mascotte & Kleur
              </span>
              <button
                type="button"
                onClick={pickRandomCharacter}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  color: '#fde047',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Dice5 size={13} />
                <span>Verrassing</span>
              </button>
            </div>

            {/* 18 Mascottes grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '0.75rem' }}>
              {AVATARS.map(a => {
                const isSelected = avatar === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAvatar(a);
                      triggerHop();
                    }}
                    style={{
                      background: isSelected ? `${themeColor.hex}55` : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected ? `2px solid ${themeColor.hex}` : '2px solid transparent',
                      borderRadius: '12px',
                      padding: '6px 2px',
                      fontSize: '1.35rem',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.14)' : 'scale(1)',
                      transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      boxShadow: isSelected ? `0 0 14px ${themeColor.hex}77` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>

            {/* Kleurthema stippen */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              {PLAYER_THEMES.map(t => {
                const isSelected = themeColor.hex === t.hex;
                return (
                  <button
                    key={t.hex}
                    type="button"
                    onClick={() => {
                      setThemeColor(t);
                      liveAudio.playTap();
                    }}
                    title={t.name}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: t.hex,
                      border: isSelected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 12px ${t.hex}` : 'none',
                      transition: 'all 0.15s ease',
                      padding: 0
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Chunky 3D Start Knop */}
          <button
            type="submit"
            disabled={!canJoin}
            style={{
              background: canJoin
                ? `linear-gradient(135deg, ${themeColor.hex}, #06b6d4)`
                : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderBottom: canJoin ? `6px solid ${themeColor.shadow}` : '4px solid rgba(255,255,255,0.1)',
              borderRadius: '18px',
              padding: '0.95rem 1.2rem',
              color: '#fff',
              fontSize: '1.12rem',
              fontWeight: 900,
              letterSpacing: '0.03em',
              cursor: canJoin ? 'pointer' : 'not-allowed',
              opacity: canJoin ? 1 : 0.45,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: canJoin ? `0 10px 28px ${themeColor.hex}55` : 'none',
              marginTop: '0.2rem',
              transition: 'all 0.12s ease',
              userSelect: 'none'
            }}
            onPointerDown={e => {
              if (canJoin) e.currentTarget.style.transform = 'translateY(3px)';
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="spin" />
                <span>Verbinden met Arena...</span>
              </>
            ) : (
              <>
                <Rocket size={20} />
                <span>START HET SPEL!</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
