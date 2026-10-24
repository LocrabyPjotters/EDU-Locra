import React, { useState } from 'react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    {
      icon: '🎓',
      title: 'Welkom bij Locra EDU!',
      badge: 'Stap 1 van 5 · Introductie',
      headline: 'Jouw slimme, didactische AI-leeromgeving op school',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Locra is speciaal ontworpen voor het Nederlandse onderwijs. Het is geen simpele antwoordmachine, maar een geduldige tutor die jou helpt de lesstof écht te begrijpen.
          </p>
          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '1rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
              <span>✨</span> Wat kun je met Locra?
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <li>Moeilijke wiskunde-, taal- of scheikundevragen stap-voor-stap ontleden</li>
              <li>Oefentoetsen en quizzen maken ter voorbereiding op proefwerken</li>
              <li>Samenvattingen en denkvragen genereren over je eigen lesstof</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: '💡',
      title: 'De Socratische Manier van Leren',
      badge: 'Stap 2 van 5 · Didactiek',
      headline: 'Waarom geeft Locra geen kant-en-klaar antwoord?',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Als een AI jouw huiswerk voorkauwt, leer je er niets van voor je examen. Daarom werkt Locra volgens de <strong>Socratische methode</strong>:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.9rem', borderRadius: '10px' }}>
              <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>❌ Gewone AI</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Geeft direct de uitkomst. Je typt het over zonder na te denken en vergeet het weer.</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.9rem', borderRadius: '10px' }}>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>✓ Locra Socratisch</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stelt een prikkelende wedervraag of geeft een hint, zodat het kwartje zélf valt.</div>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            💡 <em>Tip: Vraag gerust "Kun je me een hint geven?" of "Leg stap 2 nog eens anders uit."</em>
          </div>
        </div>
      )
    },
    {
      icon: '⚡',
      title: 'Slash Commands & Leertools',
      badge: 'Stap 3 van 5 · Sneltoetsen',
      headline: 'Typ / in het invoerveld voor directe tools',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            Met commando's activeer je in 1 seconde speciale educatieve functies:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>/quiz</code>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Maak direct een interactieve multiple-choice oefenquiz over je onderwerp</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>/toets</code>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Genereer proefwerkvragen op RTTI-niveau (Reproductie, Toepassing, Inzicht)</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>/uitleg</code>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Eenvoudige uitleg in begrijpelijke B1-taal met metaforen en voorbeelden</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.15)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>/samenvat</code>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Haal de kernpunten, jaartallen en definities uit een lange lap tekst</span>
            </div>
          </div>
        </div>
      )
    },
    {
      icon: '📎',
      title: 'Bestanden, Wiskunde & Formules',
      badge: 'Stap 4 van 5 · Bestanden',
      headline: 'Upload lesmateriaal of sleep foto\'s in de chat',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Heb je een vraag over een grafiek of een ingewikkelde som? Je hoeft het niet over te typen:
          </p>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem', textAlign: 'left', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '1.8rem' }}>📸</div>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>Foto's van je schrift of werkboek</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Locra herkent handschrift, formules en wiskundige figuren.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '1.8rem' }}>📄</div>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>PDF-lesbrieven en Readers</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Upload een lesbrief en vraag de AI om vragen te stellen over specifieke paragrafen.</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#38bdf8' }}>
            ∑ Formules worden prachtig en leesbaar weergegeven via LaTeX.
          </div>
        </div>
      )
    },
    {
      icon: '🛡️',
      title: 'Privacy & Academische Eerlijkheid',
      badge: 'Stap 5 van 5 · Verantwoord Gebruik',
      headline: 'Veilig leren binnen de schoolmuren',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Op school gelden belangrijke afspraken over privacy en eerlijkheid:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ color: '#10b981', fontSize: '1rem' }}>🔒</span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <strong>100% Privacy:</strong> Jouw chats worden nooit gebruikt om openbare AI-modellen te trainen en blijven veilig binnen Nederland.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ color: '#f59e0b', fontSize: '1rem' }}>🚫</span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <strong>Geen Privégegevens:</strong> Deel nooit wachtwoorden, je adres, achternaam of BSN in een vraag.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ color: '#818cf8', fontSize: '1rem' }}>🎓</span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <strong>Eerlijkheid:</strong> Gebruik Locra om slimmer te worden, niet om te spieken. Locra bevat onzichtbare watermerken voor docenten.
              </span>
            </div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px', borderRadius: '10px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
            Je bent helemaal klaar om te starten met Locra! Veel succes met leren.
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleFinish = () => {
    try {
      localStorage.setItem('locra_tutorial_completed_v1', 'true');
    } catch {}
    onClose();
  };

  const active = steps[currentStep];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '560px',
        padding: '2rem',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        textAlign: 'center',
        position: 'relative',
        animation: 'fadeIn 0.25s ease'
      }}>
        {/* Close / Skip button */}
        <button
          onClick={handleFinish}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '6px'
          }}
          title="Sluiten of Overslaan"
        >
          ✕
        </button>

        {/* Badge & Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 1rem'
        }}>
          {active.icon}
        </div>

        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#818cf8',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          background: 'rgba(99, 102, 241, 0.1)',
          padding: '4px 12px',
          borderRadius: '999px',
          display: 'inline-block',
          marginBottom: '0.75rem'
        }}>
          {active.badge}
        </span>

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
          {active.title}
        </h3>

        <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>
          {active.headline}
        </h4>

        {/* Step Body */}
        <div style={{ minHeight: '220px', marginBottom: '1.5rem' }}>
          {active.content}
        </div>

        {/* Progress Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          {steps.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentStep(idx)}
              style={{
                width: idx === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '999px',
                background: idx === currentStep ? '#6366f1' : 'rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {currentStep > 0 ? (
            <button
              onClick={handleBack}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                padding: '9px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              ← Vorige
            </button>
          ) : (
            <button
              onClick={handleFinish}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Overslaan
            </button>
          )}

          <button
            onClick={handleNext}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.92rem',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.1s'
            }}
          >
            {currentStep === steps.length - 1 ? 'Aan de slag! 🚀' : 'Volgende →'}
          </button>
        </div>

      </div>
    </div>
  );
}
