import { ArrowRight } from 'lucide-react'

export default function Aanmelden() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Vraag een omgeving aan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Kies tussen een gratis demo-account, een pilot, of een volledige schoolomgeving.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '3rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Voornaam</label>
                <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Achternaam</label>
                <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>School E-mailadres</label>
              <input type="email" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Type Aanvraag</label>
              <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#fff' }}>
                <option>Demo-account (gratis)</option>
                <option>Pilot starten</option>
                <option>Volledige schoolomgeving</option>
              </select>
            </div>
            <button type="button" className="btn btn-primary btn-lg" style={{ marginTop: '1rem' }}>Verstuur Aanvraag <ArrowRight size={18} /></button>
          </form>
        </div>
      </div>
    </div>
  )
}
