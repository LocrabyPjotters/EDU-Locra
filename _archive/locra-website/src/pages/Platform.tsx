import { Boxes, Key, Cloud, Database } from 'lucide-react'

export default function Platform() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Locra Platform</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Het AI-brein voor jouw applicaties.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Locra biedt een robuuste API en enterprise-infrastructuur voor je eigen AI-oplossingen, van chatbots tot complexe RAG-systemen.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {[
            { icon: <Boxes size={32}/>, color: 'var(--brand-blue)', title: 'Headless API', desc: 'Integreer direct in je eigen frontend via een flexibele GraphQL en REST API.' },
            { icon: <Key size={32}/>, color: 'var(--brand-orange)', title: 'Identity & Access', desc: 'Volledig rolgebaseerd beheer en integratie met externe IdP (SAML/OIDC).' },
            { icon: <Database size={32}/>, color: 'var(--brand-navy)', title: 'Vector Database', desc: 'Ingebouwde high-performance RAG-infrastructuur voor je documenten.' },
            { icon: <Cloud size={32}/>, color: 'var(--brand-yellow)', title: 'Self-hosted & Cloud', desc: 'Draai Locra lokaal op je eigen hardware of gebruik de beheerde cloud.' }
          ].map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '2rem', transition: 'transform 0.2s' }}>
              <div style={{ color: f.color, marginBottom: '1.5rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
