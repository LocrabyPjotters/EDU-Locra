import { Code2, Terminal, Zap } from 'lucide-react'

export default function CodeMatch() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Locra CodeMatch</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>De in-browser AI IDE.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Sneller programmeren zonder context te verliezen. CodeMatch is de webgebaseerde IDE aangedreven door de Locra AI Engine.
          </p>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 'var(--radius-lg)', padding: '4rem 2rem', color: '#fff', textAlign: 'center', marginBottom: '4rem' }}>
          <Code2 size={64} color="var(--brand-blue)" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Code met de snelheid van gedachten.</h2>
          <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>Auto-complete, inline RAG voor documentatie en unit test generatie.</p>
        </div>
      </div>
    </div>
  )
}
