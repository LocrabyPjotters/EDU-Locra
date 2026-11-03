import React, { useState } from 'react';

interface MonthlyPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MonthlyPrivacyModal({ isOpen, onClose }: MonthlyPrivacyModalProps) {
  const [agreed, setAgreed] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setAgreed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAcknowledge = () => {
    try {
      localStorage.setItem('locra_last_privacy_check', new Date().toISOString());
    } catch {}
    onClose();
  };

  const currentMonthName = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2100,
      padding: '1.25rem'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #090d16 100%)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '580px',
        padding: '2.25rem',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
        textAlign: 'center',
        position: 'relative',
        animation: 'fadeIn 0.25s ease'
      }}>
        {/* Header Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 1rem'
        }}>
          🛡️
        </div>

        {/* Badge */}
        <span style={{
          fontSize: '0.74rem',
          fontWeight: 700,
          color: '#34d399',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          background: 'rgba(16, 185, 129, 0.12)',
          padding: '4px 14px',
          borderRadius: '999px',
          display: 'inline-block',
          marginBottom: '0.75rem'
        }}>
          Maandelijkse Privacy Check · {currentMonthName}
        </span>

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
          Veilig & Verantwoord Leren met AI
        </h3>

        <p style={{ margin: '0 auto 1.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: '480px' }}>
         Hoewel alle data binnen deze Locra AI omgeving beveiligd is - is het toch super belangrijk dat je nooit de volgende dingen aan AI deelt, omdat er op die data getraind kan worden.
        </p>

        {/* 4 Privacy Rules Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '1.5rem' }}>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '10px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>👤</span>
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>Geen privégegevens in je vragen typen</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Typ nooit je achternaam, woonadres, telefoonnummer, BSN, e-mailadres of wachtwoorden in de chat.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '10px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>👥</span>
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>Bescherm klasgenoten en docenten</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Voer geen cijfers, persoonlijke verhalen, roddels of vertrouwelijke dossiers van medeleerlingen in.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '10px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🔍</span>
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>Blijf altijd kritisch op antwoorden</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                AI kan soms overtuigend 'hallucineren' of fouten maken. Controleer formules en jaartallen altijd met je schoolboek.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '10px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🎓</span>
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>Academische integriteit & watermerken</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Locra bevat onzichtbare watermerken. Gebruik AI om te begrijpen en te oefenen — neem nooit teksten klakkeloos over voor een werkstuk.
              </div>
            </div>
          </div>

        </div>

        {/* Checkbox agreement */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: 'center',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          color: '#cbd5e1'
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
          />
          <span>Ik let op mijn persoonsgegevens en die van anderen.</span>
        </label>

        {/* Action Button */}
        <button
          onClick={handleAcknowledge}
          disabled={!agreed}
          style={{
            width: '100%',
            background: agreed
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: agreed ? '#ffffff' : 'var(--text-muted)',
            padding: '12px 24px',
            borderRadius: '12px',
            cursor: agreed ? 'pointer' : 'not-allowed',
            fontWeight: 700,
            fontSize: '0.95rem',
            boxShadow: agreed ? '0 4px 20px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          {agreed ? 'Begrepen, ga door naar de chat (Geldig voor 30 dagen) ✓' : 'Vink eerst de bevestiging hierboven aan'}
        </button>

      </div>
    </div>
  );
}
