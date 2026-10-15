import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Prijzen() {
  const plans = [
    { name: 'PO-school', price: '€75', desc: 'Voor basisscholen tot 200 leerlingen.' },
    { name: 'VO-school', price: '€187,50', desc: 'Standaard licentie voor voortgezet onderwijs.' },
    { name: 'Grote VO-school', price: '€375', desc: 'Voor scholen met meer dan 1000 leerlingen.' }
  ]

  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem', background: 'var(--bg-secondary)' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Prijzen</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Eerlijke prijzen per schoolomgeving.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Geen per-user licenties, maar een vast bedrag per maand voor de hele school + API verbruik naar wens.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          {plans.map((p, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '2.5rem', position: 'relative', boxShadow: i === 1 ? '0 20px 40px rgba(37,99,235,0.1)' : 'none', borderColor: i === 1 ? 'var(--brand-blue)' : 'var(--border-light)' }}>
              {i === 1 && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--brand-blue)', color: '#fff', padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>Meest gekozen</span>}
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{p.name}</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{p.desc}</p>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '2rem' }}>
                {p.price} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>p/m</span>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {['Onbeperkt gebruikers', 'Alle basis AI-modellen', 'Teacherbot', 'Document templates'].map((feat, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CheckCircle2 size={16} color="var(--brand-blue)" /> {feat}</li>
                ))}
              </ul>
              <Link to="/aanmelden" className={`btn ${i === 1 ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%' }}>Kies {p.name}</Link>
            </div>
          ))}
        </div>
        
        <div style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '2rem', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Eenmalige Inrichting</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Implementatie, training, en inrichting van de omgeving wordt berekend op €1.250 eenmalig. Koppeling met Somtoday: €26 p/m extra.</p>
        </div>
      </div>
    </div>
  )
}
