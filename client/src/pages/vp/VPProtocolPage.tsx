import React from 'react';
import {
  PhoneCall,
  Shield,
  HeartHandshake,
  ExternalLink,
  AlertTriangle,
  FileText,
  Lock
} from 'lucide-react';

export default function VPProtocolPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
          Hulplijnen &amp; Zorgprotocol
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
          Officiële landelijke hulplijnen en richtlijnen voor vertrouwenspersonen binnen het voortgezet en middelbaar onderwijs.
        </p>
      </div>

      {/* Helplines Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: '14px', background: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 700, fontSize: '0.95rem' }}>
            <PhoneCall size={18} />
            <span>113 Zelfmoordpreventie</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0.6rem 0 0.3rem', fontFamily: 'monospace' }}>
            0800-0113
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Gratis en 24/7 bereikbaar voor acute suïcidepreventie en crisisinterventie. Chatten kan anoniem via 113.nl.
          </p>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: '#1e293b', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
            <PhoneCall size={18} />
            <span>De Kindertelefoon</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0.6rem 0 0.3rem', fontFamily: 'monospace' }}>
            0800-0432
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Voor alle jongeren tot 18 jaar. Dagelijks bereikbaar van 11:00 tot 21:00 uur via bellen of chatten op kindertelefoon.nl.
          </p>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: '#1e293b', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem' }}>
            <PhoneCall size={18} />
            <span>Veilig Thuis</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0.6rem 0 0.3rem', fontFamily: 'monospace' }}>
            0800-2000
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Het advies- en meldpunt voor huiselijk geweld en kindermishandeling. 24/7 gratis en vertrouwelijk bereikbaar.
          </p>
        </div>
      </div>

      {/* Protocol steps */}
      <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
          Stappenplan bij Automatische Zorgsignalen in Locra
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fbbf24', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>1</span>
            <div>
              <strong>Signaal Beoordelen:</strong> Bekijk de categorie (suïciderisico, zelfbeschadiging of acute onveiligheid) en het tekstfragment in het Vertrouwenspersoon-dashboard.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fbbf24', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>2</span>
            <div>
              <strong>Inzage Indien Noodzakelijk:</strong> Indien de context onduidelijk is, kun je als vertrouwenspersoon het gesprek ontgrendelen. Geef altijd een heldere zorgreden op. De leerling ontvangt conform de AVG direct een formele e-mailnotificatie.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fbbf24', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>3</span>
            <div>
              <strong>Persoonlijk Contact:</strong> Neem op een veilige en rustige manier contact op met de leerling (bijvoorbeeld via de mentor of een uitnodiging in de spreekkamer van de zorgcoördinator).
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fbbf24', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>4</span>
            <div>
              <strong>Dossierstatus Bijwerken:</strong> Zet het signaal op "In Behandeling" en noteer vertrouwelijke aantekeningen. Sluit het signaal pas af als "Afgerond" nadat de noodzakelijke hulpverlening is ingezet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

