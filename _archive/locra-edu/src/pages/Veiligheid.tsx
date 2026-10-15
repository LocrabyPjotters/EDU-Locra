import { Shield, Lock, EyeOff, Server } from 'lucide-react'

export default function Veiligheid() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Privacy First</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>AI zonder concessies op privacy.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Locra EDU is gebouwd rondom AVG/GDPR compliance. We scheiden PII van AI-modellen en houden de school in regie.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Volledige Controle over Data</h2>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <li style={{ display: 'flex', gap: '1rem' }}>
                <Shield color="var(--brand-blue)" size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.5rem' }}>AVG & Verwerkersovereenkomst</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>Standaard verwerkersovereenkomsten voor PO, VO en MBO. Volledig dekkend voor audits.</span>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem' }}>
                <EyeOff color="var(--brand-orange)" size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Anonieme Leerlingaccounts</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>Leerlingen werken anoniem in relatie tot de AI-aanbieders. Geen profielopbouw.</span>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '1rem' }}>
                <Server color="var(--brand-yellow)" size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Dataretentie in Eigen Beheer</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>Beheerders bepalen hoe lang chatgeschiedenis bewaard wordt. Verwijderd is ook echt verwijderd.</span>
                </div>
              </li>
            </ul>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '3rem', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '1rem' }}>DPIA & Security Scans</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Wij faciliteren scholen met een uitgebreide pre-ingevulde DPIA en periodieke vulnerability scans.</p>
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '4px solid var(--brand-blue)' }}>
              "Privacy is bij Locra geen vinkje achteraf, maar het vertrekpunt van onze architectuur."
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
