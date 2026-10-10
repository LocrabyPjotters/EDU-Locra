import { PlayCircle } from 'lucide-react'

export default function Demo() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">On-Demand Demo</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Zie Locra in actie.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Bekijk onze presentatie en plan direct een afspraak in met een van onze onderwijsexperts.
          </p>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 'var(--radius-lg)', padding: '6rem 2rem', textAlign: 'center', color: '#fff', marginBottom: '4rem' }}>
          <PlayCircle size={64} color="var(--brand-yellow)" style={{ margin: '0 auto 1.5rem', cursor: 'pointer' }} />
          <h2>Start Video Presentatie</h2>
        </div>
      </div>
    </div>
  )
}
