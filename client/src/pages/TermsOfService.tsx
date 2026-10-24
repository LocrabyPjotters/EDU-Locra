import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f172a 0%, #0b0f19 100%)',
      color: '#e2e8f0',
      padding: '3rem 1.5rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div 
            onClick={() => navigate('/')} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem'
            }}>🎓</div>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Locra</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => navigate('/privacy')}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '10px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}
            >
              Privacybeleid ➔
            </button>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '10px',
                cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              ← Terug
            </button>
          </div>
        </div>

        {/* Header Hero */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.08))',
          borderRadius: '24px', padding: '2.5rem',
          border: '1px solid rgba(99,102,241,0.25)', marginBottom: '2.5rem',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            <span>📜</span> Algemene Voorwaarden & Verwerkersovereenkomst
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#fff', margin: '0 0 1rem' }}>
            Locra Gebruiksvoorwaarden & DPA
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
            Geldig vanaf: 18 oktober 2026 • Versie 2.5 • Van toepassing op alle softwarelicenties van Pjotters B.V. / RowMatch.
          </p>
        </div>

        {/* Content Body */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '2.5rem',
          border: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.7, fontSize: '0.95rem'
        }}>
          
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              1. Toepasselijkheid & Definities
            </h2>
            <p>
              Deze Algemene Voorwaarden zijn van toepassing op elk gebruik van de Locra software, mobiele applicaties en aanverwante diensten van <strong>Pjotters B.V.</strong> (hierna: "Locra" of "Leverancier") door onderwijsinstellingen, docenten, medewerkers en leerlingen (hierna: "Klant" of "Gebruiker").
            </p>
            <p>
              Door de installatie, configuratie of het gebruik van Locra gaat de Klant akkoord met deze voorwaarden en de bijbehorende Verwerkersovereenkomst conform artikel 28 AVG.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              2. Licentie-Tiers & Tarieven
            </h2>
            <p>
              Locra wordt geleverd op basis van jaarlijkse licenties. De beschikbare plannen zijn:
            </p>
            <ul style={{ paddingLeft: '1.5rem', color: '#cbd5e1', lineHeight: 1.8 }}>
              <li><strong>EDU-Free (€0 / jaar):</strong> Gratis basislicentie met AI Chat, Modellen en Gebruikersbeheer. Bevat geanonimiseerde telemetriedeling ter kwaliteitsverbetering.</li>
              <li><strong>EDU-Basic (€50 / jaar):</strong> Licentie voor startende scholen inclusief docententools, SlimCheck en Examenruimte. Geen RAG, Limieten, Klassen of Watermarking. Bevat geanonimiseerde telemetrie.</li>
              <li><strong>EDU-Plus (€100 / jaar):</strong> Complete vaksectie-licentie inclusief Onzichtbare Watermerkdetectie, Klassen & Groepen, Limieten & Quota, RAG Kennisbanken (tot 15) en SOMtoday integratie. 100% on-premise isolatie (géén telemetrie).</li>
              <li><strong>EDU-Premium (€250 / jaar):</strong> Onbeperkte schoolbrede licentie voor 1 vestiging inclusief CodeMatch IDE, Locra Academy met digitale certificaten en onbeperkte RAG. 100% geïsoleerd.</li>
              <li><strong>Enterprise (Op Maat):</strong> Multi-locatie schoolbesturen, Kennisnet/Entree SSO integratie, maatwerk SLA en dedicated ondersteuning.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              3. Automatische 3-Maandelijkse Controle & Lock-down Bepaling
            </h2>
            <div style={{ background: 'rgba(99,102,241,0.08)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#818cf8' }}>Licentievalidatiecyclus (90 dagen):</p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                Elke Locra installatie voert automatisch elke 90 dagen een online licentieverificatie uit via <code>api.rowmatch.nl</code>. Bij het ontbreken van internetverbinding treedt een <strong>14-daagse coulanceperiode (grace period)</strong> in werking waarin de beheerder via alerts wordt gewaarschuwd.
                Indien na 104 dagen (90 + 14) geen geldige verificatie heeft plaatsgevonden, schakelt het systeem automatisch over naar de <strong>Lock-down modus</strong>. In deze modus blijft uitsluitend het licentiebeheer voor beheerders toegankelijk om de software te heractiveren.
              </p>
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              4. Verantwoordelijk Gebruik & Academische Integriteit
            </h2>
            <p>
              De Klant ziet erop toe dat leerlingen en personeel de AI-functionaliteiten verantwoord gebruiken:
            </p>
            <ul style={{ paddingLeft: '1.5rem', color: '#cbd5e1' }}>
              <li>De software mag niet worden gebruikt voor het genereren van discriminerende, haatdragende of illegale content.</li>
              <li>Locra's ingebouwde watermerktechnologie is ontworpen om docenten te helpen bij het opsporen van ongeoorloofd AI-gebruik bij huiswerk en essays. Het omzeilen van deze watermerken is in strijd met de licentie.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              5. Model Verwerkersovereenkomst (DPA - Art. 28 AVG)
            </h2>
            <p>
              Deze clausule geldt als wettelijke Verwerkersovereenkomst tussen de School (Verwerkingsverantwoordelijke) en Pjotters B.V. (Verwerker):
            </p>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ol style={{ paddingLeft: '1.25rem', margin: 0, color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.8 }}>
                <li><strong>Opdracht:</strong> Verwerker verwerkt persoonsgegevens uitsluitend ten behoeve van de uitvoering van de overeengekomen onderwijsdiensten.</li>
                <li><strong>Geheimhouding:</strong> Verwerker legt een strikte geheimhoudingsplicht op aan al haar medewerkers en ingeschakelde derden.</li>
                <li><strong>Beveiliging:</strong> Verwerker treft passende technische en organisatorische maatregelen tegen verlies of onrechtmatige verwerking (minimaal TLS 1.3, versleutelde wachtwoorden, audit trails).</li>
                <li><strong>Meldplicht Datalekken:</strong> Verwerker meldt een eventueel geconstateerd datalek onverwijld, doch uiterlijk binnen 48 uur na ontdekking, aan de Verwerkingsverantwoordelijke.</li>
                <li><strong>Verwijdering:</strong> Na beëindiging van de licentieovereenkomst worden alle gegevens binnen 30 dagen definitief gewist of aan de school overgedragen.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              6. Toepasselijk Recht & Geschillen
            </h2>
            <p>
              Op deze overeenkomst is uitsluitend Nederlands recht van toepassing. Eventuele geschillen worden voorgelegd aan de bevoegde rechter te Amsterdam.
            </p>
            <p style={{ color: '#06b6d4', fontWeight: 600 }}>
              Pjotters B.V. • KvK Nederland • Contact: <a href="mailto:info@locra.nl" style={{ color: '#06b6d4' }}>info@locra.nl</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
