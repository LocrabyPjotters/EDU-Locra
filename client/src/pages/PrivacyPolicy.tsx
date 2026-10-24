import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
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
              onClick={() => navigate('/terms')}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '10px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}
            >
              Algemene Voorwaarden (Terms) ➔
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            <span>🛡️</span> AVG & Privacy Convenant Onderwijs Conform
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#fff', margin: '0 0 1rem' }}>
            Privacybeleid Locra Onderwijsplatform
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
            Laatst bijgewerkt: 18 oktober 2026 • Versie 2.5 • Toepasselijk voor alle Locra schoolinstanties en mobiele applicaties van Pjotters / RowMatch.
          </p>
        </div>

        {/* Content Body */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '2.5rem',
          border: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.7, fontSize: '0.95rem'
        }}>
          
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              1. Inleiding & Rol van Betrokkenen
            </h2>
            <p>
              Locra is ontwikkeld door <strong>Pjotters B.V.</strong> (handelsnaam binnen het RowMatch ecosysteem) speciaal voor het primair, voortgezet, middelbaar en hoger onderwijs in Nederland en de Europese Unie.
            </p>
            <p>
              In de zin van de Algemene Verordening Gegevensbescherming (AVG / GDPR):
            </p>
            <ul style={{ paddingLeft: '1.5rem', color: '#cbd5e1' }}>
              <li><strong>De School / Het Schoolbestuur</strong> is de <em>Verwerkingsverantwoordelijke</em> voor alle persoonsgegevens van haar leerlingen, docenten en personeel.</li>
              <li><strong>Locra / Pjotters</strong> treedt uitsluitend op als <em>Verwerker</em> conform artikel 28 van de AVG en handelt strikt in opdracht van de Verwerkingsverantwoordelijke.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              2. Welke Gegevens Worden Verwerkt?
            </h2>
            <p>
              Locra hanteert het principe van minimale gegevensverwerking (dataminimalisatie). Afhankelijk van de configuratie door de school verwerkt het systeem:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ color: '#06b6d4', fontSize: '1rem', margin: '0 0 0.5rem' }}>Account- en Identiteitsgegevens</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  Gebruikersnaam, weergavenaam, rol (leerling, docent, beheerder), e-mailadres (indien geactiveerd voor wachtwoordherstel) en gehashte wachtwoorden (bcrypt).
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ color: '#a78bfa', fontSize: '1rem', margin: '0 0 0.5rem' }}>Didactische & AI Chat Context</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  Prompts, antwoorden, leerdoelen, gekoppelde toetsantwoorden en geüploade lesdocumenten voor RAG-kennisbanken. Deze data blijft lokaal op de server van de school.
                </p>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              3. Telemetrie & Gegevensdeling per Licentieplan
            </h2>
            <p>
              Locra kent 5 licentie-tiers met een transparant en strikt geregeld gegevensbeleid:
            </p>
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem' }}>Licentieplan</th>
                    <th style={{ padding: '0.75rem' }}>Prijs</th>
                    <th style={{ padding: '0.75rem' }}>Gegevensdeling met Locra / Pjotters</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fff' }}>EDU-Free</td>
                    <td style={{ padding: '0.75rem', color: '#4ade80' }}>Gratis (€0)</td>
                    <td style={{ padding: '0.75rem', color: '#f59e0b' }}>
                      Strikt geanonimiseerde telemetrie (aantal prompts, tokenverbruik, gemiddelde latency, foutcodes) ter kwaliteitsverbetering. <strong>Geen persoonsgegevens of chatberichten.</strong>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fff' }}>EDU-Basic</td>
                    <td style={{ padding: '0.75rem', color: '#60a5fa' }}>€50 / jaar</td>
                    <td style={{ padding: '0.75rem', color: '#f59e0b' }}>
                      Zelfde geanonimiseerde telemetrie als EDU-Free. <strong>Geen persoonsgegevens of chatberichten.</strong>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fff' }}>EDU-Plus</td>
                    <td style={{ padding: '0.75rem', color: '#818cf8' }}>€100 / jaar</td>
                    <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                      🛡️ <strong>100% On-Premise Isolatie.</strong> Geen telemetrie, geen datasharing.
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fff' }}>EDU-Premium</td>
                    <td style={{ padding: '0.75rem', color: '#facc15' }}>€250 / jaar</td>
                    <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                      🛡️ <strong>100% On-Premise Isolatie.</strong> Geen telemetrie, geen datasharing.
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fff' }}>Enterprise</td>
                    <td style={{ padding: '0.75rem', color: '#c084fc' }}>Op Maat</td>
                    <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                      🛡️ <strong>100% On-Premise Isolatie.</strong> Dedicated SLA & Custom DPA.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              4. Wat Wordt Pertinent NOOIT Verzonden?
            </h2>
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)', borderRadius: '14px', padding: '1.25rem',
              border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5'
            }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Onze harde privacy-garantie:</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                <li>NOOIT namen, leerlingnummers of e-mailadressen van leerlingen of docenten.</li>
                <li>NOOIT de inhoud van individuele chatgesprekken of prompts.</li>
                <li>NOOIT documenten, readers of boeken uit de RAG Kennisbanken.</li>
                <li>NOOIT toetsvragen, leerlingantwoorden of schoolcijfers.</li>
                <li>NOOIT wachtwoorden, encryptiesleutels of interne netwerk-IP's.</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              5. 3-Maandelijkse Licentiecontrole & Lock-down
            </h2>
            <p>
              Om misbruik van softwarelicenties te voorkomen, verifieert elke Locra server automatisch elke 90 kalenderdagen de licentiestatus bij <code>api.rowmatch.nl</code>.
            </p>
            <p>
              Bij deze controle worden uitsluitend verzonden: de licentiesleutel-hash, schoolnaam, de unieke mobiele koppelcode (ConnectCode) en het softwareversienummer. Mocht de server offline zijn, dan geldt een <strong>14-daagse waarschuwingsperiode (grace period)</strong> voordat de applicatie ter bescherming overschakelt naar lock-down modus.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              6. Beveiliging & Rechten van Betrokkenen
            </h2>
            <p>
              Locra past state-of-the-art beveiligingsmaatregelen toe:
            </p>
            <ul style={{ paddingLeft: '1.5rem', color: '#cbd5e1' }}>
              <li><strong>Transportbeveiliging:</strong> Uitsluitend HTTPS/TLS 1.3 encryptie met HSTS.</li>
              <li><strong>Opslagbeveiliging:</strong> Gehashte wachtwoorden via Bcrypt, optionele end-to-end encryptie voor chatgeschiedenis.</li>
              <li><strong>Rechten:</strong> Betrokkenen (leerlingen/ouders/docenten) kunnen via de beheerder van hun eigen school te allen tijde inzage, correctie of volledige verwijdering van hun account en gegevens verzoeken.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              7. Contact & Functionaris voor Gegevensbescherming (FG)
            </h2>
            <p>
              Vragen over dit privacybeleid of het afsluiten van een op maat gemaakte Verwerkersovereenkomst voor uw schoolbestuur?
            </p>
            <p style={{ color: '#06b6d4', fontWeight: 600 }}>
              Pjotters B.V. / Locra Onderwijsbeveiliging<br />
              E-mail: <a href="mailto:privacy@locra.nl" style={{ color: '#06b6d4' }}>privacy@locra.nl</a> / <a href="mailto:support@rowmatch.nl" style={{ color: '#06b6d4' }}>support@rowmatch.nl</a><br />
              Website: <a href="https://rowmatch.nl" target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>https://rowmatch.nl</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
