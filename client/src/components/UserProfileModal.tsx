import React, { useState, useEffect } from 'react';
import { Brain, Trash2, Save, X, Sparkles, Tag, Plus, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface UserProfileModalProps {
  userId: string;
  userName: string;
  userDisplayName: string;
  userRole: string;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function UserProfileModal({
  userId,
  userName,
  userDisplayName,
  userRole,
  onClose,
  onProfileUpdated
}: UserProfileModalProps) {
  const token = useAuthStore(state => state.token);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterestInput, setNewInterestInput] = useState('');
  
  const [learningStyle, setLearningStyle] = useState('');
  
  const [strengths, setStrengths] = useState<string[]>([]);
  const [newStrengthInput, setNewStrengthInput] = useState('');

  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [newDifficultyInput, setNewDifficultyInput] = useState('');

  const [goals, setGoals] = useState<string[]>([]);
  const [newGoalInput, setNewGoalInput] = useState('');

  const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
  const [newTraitInput, setNewTraitInput] = useState('');

  const [aiPersonaSummary, setAiPersonaSummary] = useState('');
  const [analysisCount, setAnalysisCount] = useState(0);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/profiles/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Laden mislukt');

        if (data.profile) {
          const p = data.profile;
          try { if (p.interests) setInterests(JSON.parse(p.interests)); } catch {}
          if (p.learningStyle) setLearningStyle(p.learningStyle);
          try { if (p.strengths) setStrengths(JSON.parse(p.strengths)); } catch {}
          try { if (p.difficulties) setDifficulties(JSON.parse(p.difficulties)); } catch {}
          try { if (p.goals) setGoals(JSON.parse(p.goals)); } catch {}
          try { if (p.personalityTraits) setPersonalityTraits(JSON.parse(p.personalityTraits)); } catch {}
          if (p.aiPersonaSummary) setAiPersonaSummary(p.aiPersonaSummary);
          setAnalysisCount(p.analysisCount || 0);
          setLastAnalyzedAt(p.lastAnalyzedAt);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/profiles/user/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          interests,
          learningStyle,
          strengths,
          difficulties,
          goals,
          personalityTraits,
          aiPersonaSummary
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
      setSuccessMsg('✅ Profiel succesvol opgeslagen!');
      setTimeout(() => setSuccessMsg(null), 3000);
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzeNow = async () => {
    setAnalyzing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/profiles/user/${userId}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analyse mislukt');

      if (data.profile) {
        const p = data.profile;
        try { if (p.interests) setInterests(JSON.parse(p.interests)); } catch {}
        if (p.learningStyle) setLearningStyle(p.learningStyle);
        try { if (p.strengths) setStrengths(JSON.parse(p.strengths)); } catch {}
        try { if (p.difficulties) setDifficulties(JSON.parse(p.difficulties)); } catch {}
        try { if (p.goals) setGoals(JSON.parse(p.goals)); } catch {}
        try { if (p.personalityTraits) setPersonalityTraits(JSON.parse(p.personalityTraits)); } catch {}
        if (p.aiPersonaSummary) setAiPersonaSummary(p.aiPersonaSummary);
        setAnalysisCount(p.analysisCount || 0);
        setLastAnalyzedAt(p.lastAnalyzedAt);
      }

      setSuccessMsg('✨ AI-analyse voltooid op basis van recente chats!');
      setTimeout(() => setSuccessMsg(null), 4000);
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(`Weet je zeker dat je het AI-profiel van ${userDisplayName} volledig wilt resetten? Alle geleerde interesses en observaties worden gewist.`)) {
      return;
    }

    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/user/${userId}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resetten mislukt');

      setInterests([]);
      setLearningStyle('');
      setStrengths([]);
      setDifficulties([]);
      setGoals([]);
      setPersonalityTraits([]);
      setAiPersonaSummary('');
      setAnalysisCount(0);
      setLastAnalyzedAt(null);
      setSuccessMsg('🧹 AI-profiel is volledig gewist!');
      setTimeout(() => setSuccessMsg(null), 3000);
      onProfileUpdated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  const addTag = (list: string[], setList: (l: string[]) => void, input: string, setInput: (s: string) => void) => {
    const val = input.trim();
    if (val && !list.includes(val)) {
      setList([...list, val]);
      setInput('');
    }
  };

  const removeTag = (list: string[], setList: (l: string[]) => void, tagToRemove: string) => {
    setList(list.filter(t => t !== tagToRemove));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
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
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          padding: 0,
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.2)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.15))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8'
              }}
            >
              <Brain size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  AI-Leerlingprofiel: {userDisplayName}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontFamily: 'monospace'
                  }}
                >
                  @{userName}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                {analysisCount > 0
                  ? `✨ ${analysisCount} analyses uitgevoerd • Laatst bijgewerkt: ${lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleDateString('nl-NL') : 'Onbekend'}`
                  : 'Nog geen automatische analyses voltooid'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAnalyzeNow}
              disabled={analyzing || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.35))',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                color: '#f3e8ff',
                padding: '7px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 700,
                transition: 'all 0.2s',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.25)'
              }}
              title="Analyseer recente chats van deze gebruiker en update het profiel direct"
            >
              <Sparkles size={14} />
              <span>{analyzing ? 'Analyseren...' : '✨ Nu Analyseren'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '10px', color: '#fca5a5', fontSize: '0.85rem' }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '10px', color: '#86efac', fontSize: '0.85rem' }}>
              {successMsg}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              ⏳ AI-Profiel inladen...
            </div>
          ) : (
            <>
              {/* 1. Interesses & Passies */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
                  <span>🎯 Interesses & Belevingswereld</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>(Hobby's, sport, games, technologie)</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.65rem' }}>
                  {interests.map((item, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#c7d2fe',
                        fontSize: '0.82rem'
                      }}
                    >
                      {item}
                      <button onClick={() => removeTag(interests, setInterests, item)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0 }}>×</button>
                    </span>
                  ))}
                  {interests.length === 0 && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Nog geen interesses gedetecteerd.</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                    placeholder="Nieuwe interesse toevoegen..."
                    value={newInterestInput}
                    onChange={e => setNewInterestInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(interests, setInterests, newInterestInput, setNewInterestInput))}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    onClick={() => addTag(interests, setInterests, newInterestInput, setNewInterestInput)}
                  >
                    + Toevoegen
                  </button>
                </div>
              </div>

              {/* 2. Leerstijl & Uitlegvoorkeur */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '0.35rem' }}>
                  💡 Leerstijl & Denkniveau
                </label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '65px', fontSize: '0.85rem' }}
                  placeholder="Bijv. Beelddenker, heeft baat bij analogieën en stapsgewijze voorbeelden..."
                  value={learningStyle}
                  onChange={e => setLearningStyle(e.target.value)}
                />
              </div>

              {/* 3. Sterktes & Moeilijkheden */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#34d399', marginBottom: '0.4rem', display: 'block' }}>
                    🌟 Sterke vakken & Vaardigheden
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                    {strengths.map((s, idx) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', fontSize: '0.78rem' }}>
                        {s} <button onClick={() => removeTag(strengths, setStrengths, s)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    placeholder="Sterkte toevoegen..."
                    value={newStrengthInput}
                    onChange={e => setNewStrengthInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(strengths, setStrengths, newStrengthInput, setNewStrengthInput))}
                  />
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fbbf24', marginBottom: '0.4rem', display: 'block' }}>
                    ⚠️ Aandachtspunten / Hulp nodig
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                    {difficulties.map((d, idx) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fde68a', fontSize: '0.78rem' }}>
                        {d} <button onClick={() => removeTag(difficulties, setDifficulties, d)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer' }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    placeholder="Moeite toevoegen..."
                    value={newDifficultyInput}
                    onChange={e => setNewDifficultyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(difficulties, setDifficulties, newDifficultyInput, setNewDifficultyInput))}
                  />
                </div>
              </div>

              {/* 4. Toekomstdromen & Doelen */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8', marginBottom: '0.4rem' }}>
                  🚀 Leerdoelen & Toekomstdromen
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '0.5rem' }}>
                  {goals.map((g, idx) => (
                    <span key={idx} style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#bae6fd', fontSize: '0.78rem' }}>
                      {g} <button onClick={() => removeTag(goals, setGoals, g)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  className="input-field"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  placeholder="Doel toevoegen (bijv. wil piloot worden)..."
                  value={newGoalInput}
                  onChange={e => setNewGoalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(goals, setGoals, newGoalInput, setNewGoalInput))}
                />
              </div>

              {/* 5. Prompt Samenvatting (Actieve AI-instructie) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', color: '#a855f7', marginBottom: '0.35rem' }}>
                  <Sparkles size={14} />
                  <span>AI-Persona Systeemprompt Samenvatting</span>
                </label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '60px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  placeholder="Korte samenvatting die direct aan de AI wordt doorgegeven..."
                  value={aiPersonaSummary}
                  onChange={e => setAiPersonaSummary(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            background: 'rgba(15, 23, 42, 0.8)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            className="btn"
            style={{ width: 'auto', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={resetting || loading}
            onClick={handleReset}
          >
            <Trash2 size={15} />
            <span>{resetting ? 'Resetten...' : 'AI-Profiel Resetten'}</span>
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              onClick={onClose}
            >
              Sluiten
            </button>
            <button
              type="button"
              className="btn"
              style={{
                width: 'auto',
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#e9d5ff',
                fontWeight: 600
              }}
              disabled={analyzing || loading}
              onClick={handleAnalyzeNow}
            >
              <Sparkles size={15} />
              <span>{analyzing ? 'Analyseren...' : 'Nu Bijwerken met AI'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={saving || loading || analyzing}
              onClick={handleSave}
            >
              <Save size={15} />
              <span>{saving ? 'Opslaan...' : 'Wijzigingen Opslaan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

