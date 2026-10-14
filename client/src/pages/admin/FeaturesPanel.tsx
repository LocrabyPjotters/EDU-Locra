import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

function FeatureCard({
  icon,
  title,
  description,
  enabled,
  onChange,
  subSettings,
  badge
}: {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
  subSettings?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div style={{
      background: enabled ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${enabled ? 'rgba(99, 102, 241, 0.28)' : 'rgba(255, 255, 255, 0.06)'}`,
      borderRadius: '16px',
      padding: '1.4rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      boxShadow: enabled ? '0 10px 30px -10px rgba(99, 102, 241, 0.15)' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          <div style={{
            fontSize: '1.6rem',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: enabled ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>{title}</h4>
              {badge && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  {badge}
                </span>
              )}
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.55)', lineHeight: 1.45 }}>
              {description}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', flexShrink: 0, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => onChange(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: enabled ? '#6366f1' : 'rgba(255, 255, 255, 0.15)',
            borderRadius: '26px',
            transition: '0.2s',
            boxShadow: enabled ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none'
          }}>
            <span style={{
              position: 'absolute',
              height: '20px',
              width: '20px',
              left: enabled ? '25px' : '3px',
              bottom: '3px',
              backgroundColor: '#fff',
              borderRadius: '50%',
              transition: '0.2s'
            }} />
          </span>
        </label>
      </div>

      {/* Sub-settings if enabled */}
      {enabled && subSettings && (
        <div style={{
          marginTop: '0.35rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {subSettings}
        </div>
      )}
    </div>
  );
}

export default function FeaturesPanel() {
  const token = useAuthStore(state => state.token);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [features, setFeatures] = useState<any>({
    enableWebSearch: false,
    enableWebSearchPiiFilter: true,
    enableAttachments: true,
    enableSharedChats: true,
    enableCollabChats: true,
    enableQuizMode: true,
    enableEssayCoach: true,
    enableThinkingMode: true,
    enableDeepResearch: true,
    allowStudentCoop: true,
    enableFeedback: true,
    enableExamMode: false
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setFeatures((prev: any) => ({
            ...prev,
            ...data
          }));
        }
      })
      .catch(() => showToast('error', 'Fout bij het ophalen van functie-instellingen'))
      .finally(() => setLoading(false));
  }, [token]);

  const update = (key: string, val: any) => {
    setFeatures((prev: any) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(features)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Opslaan mislukt');
      showToast('success', '✨ Functie-instellingen succesvol opgeslagen!');
    } catch (err: any) {
      showToast('error', '❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'rgba(255,255,255,0.4)' }}>
        Functie-instellingen laden...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '0.85rem 1.4rem',
          borderRadius: '12px',
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          fontWeight: 600,
          zIndex: 1000,
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚡</span> Functiebeheer
          </h2>
          <p style={{ margin: '0.4rem 0 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.92rem' }}>
            Schakel platformmodules en AI-leertools in of uit voor alle leerlingen en docenten binnen de school.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.75rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? '⏳ Opslaan...' : '💾 Wijzigingen Opslaan'}
        </button>
      </div>

      {/* Grid of Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' }}>
        
        {/* 1. Live Internet Zoeken */}
        <FeatureCard
          icon="🌐"
          title="Live Internet Zoeken"
          badge="DuckDuckGo"
          description="Stelt leerlingen en docenten in staat om actuele informatie en bronnen van het internet op te halen via /zoeken."
          enabled={features.enableWebSearch}
          onChange={val => update('enableWebSearch', val)}
          subSettings={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.25)', borderRadius: '10px' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛡️</span> Persoonsgegevens & PII Privacy Filter
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                  Filtert namen, e-mailadressen en leerlingnummers automatisch uit zoekopdrachten vóór verzending naar het web.
                </div>
              </div>
              <input
                type="checkbox"
                checked={features.enableWebSearchPiiFilter !== false}
                onChange={e => update('enableWebSearchPiiFilter', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </div>
          }
        />

        {/* 2. Denkmodus & Redenering */}
        <FeatureCard
          icon="🧠"
          title="Denkmodus & Diepgaand Onderzoek"
          badge="Geavanceerd"
          description="Laat gebruikers denkmodi inschakelen via /denkmodus of /diepgaand om stap-voor-stap redeneringen te zien."
          enabled={features.enableThinkingMode !== false}
          onChange={val => update('enableThinkingMode', val)}
        />

        {/* 3. Interactieve Quiz Modus */}
        <FeatureCard
          icon="🧪"
          title="Interactieve Quiz Modus (@quiz)"
          badge="AI Overhoren"
          description="Geeft leerlingen toegang tot interactieve meerkeuzequizzen direct in de chat om leerstof te oefenen en scoren."
          enabled={features.enableQuizMode !== false}
          onChange={val => update('enableQuizMode', val)}
        />

        {/* 4. Opstel-Coach */}
        <FeatureCard
          icon="✏️"
          title="Opstel-Coach (/opstel)"
          badge="Didactisch"
          description="AI begeleider die teksten en verslagen kritisch nakijkt op structuur, argumentatie en spelling zonder het voor te kauwen."
          enabled={features.enableEssayCoach !== false}
          onChange={val => update('enableEssayCoach', val)}
        />

        {/* 5. Bijlagen & Bestandsuploads */}
        <FeatureCard
          icon="📎"
          title="Bijlagen & Bestandsuploads"
          description="Stelt gebruikers in staat om PDF's, Word-documenten en afbeeldingen mee te sturen in de chat voor analyse."
          enabled={features.enableAttachments}
          onChange={val => update('enableAttachments', val)}
        />

        {/* 6. Gedeelde Gesprekken */}
        <FeatureCard
          icon="🔗"
          title="Gedeelde Gesprekken"
          description="Laat gebruikers een beveiligde alleen-lezen deellink genereren om een conversatie met een docent of klasgenoot te delen."
          enabled={features.enableSharedChats}
          onChange={val => update('enableSharedChats', val)}
        />

        {/* 7. Samenwerkingsgesprekken */}
        <FeatureCard
          icon="👥"
          title="Coöperatieve Chatrooms (Co-Op)"
          description="Maakt het mogelijk om klasgenoten uit te nodigen in een gezamenlijk realtime AI-gesprek voor groepswerk."
          enabled={features.enableCollabChats}
          onChange={val => update('enableCollabChats', val)}
        />

        {/* 8. Toets- en Examenomgeving */}
        <FeatureCard
          icon="🔒"
          title="Online Toets- en Examenmodus"
          badge="Beveiligd"
          description="Activeert de afgeschermde toetsomgeving (/toets) met optioneel toegangswachtwoord en anti-tab-switch controle."
          enabled={features.enableExamMode}
          onChange={val => update('enableExamMode', val)}
        />

      </div>
    </div>
  );
}
