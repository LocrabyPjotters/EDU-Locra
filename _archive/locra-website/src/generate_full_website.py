import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src'
pages_path = os.path.join(base_path, 'pages')

# 1. Platform.tsx
platform_tsx = """import { Boxes, Key, Cloud, Database } from 'lucide-react'

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
"""

# 2. CodeMatch.tsx
codematch_tsx = """import { Code2, Terminal, Zap } from 'lucide-react'

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
"""

# 3. Security.tsx
security_tsx = """import { Shield, Lock } from 'lucide-react'

export default function Security() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Security & Compliance</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Enterprise-grade beveiliging.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Jouw data, jouw modellen. Volledig geïsoleerd van publieke AI-diensten.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
             <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Geen data naar buiten.</h2>
             <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
               Onze architectuur zorgt ervoor dat jouw bedrijfsdata nooit gebruikt wordt om publieke modellen te trainen. Zelfs in de cloud draaien we single-tenant.
             </p>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '3rem' }}>
             <Shield color="var(--brand-blue)" size={48} style={{ marginBottom: '1rem' }} />
             <h3>ISO 27001 gereed</h3>
             <p style={{ color: 'var(--text-secondary)' }}>Alle processen en infrastructuur zijn ingericht om naadloos in jullie security compliance te passen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
"""

# 4. Enroll.tsx
enroll_tsx = """import { ArrowRight } from 'lucide-react'

export default function Enroll() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Plan een Demo</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Ontdek hoe Locra jullie organisatie kan helpen.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '3rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Naam</label>
                <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Organisatie</label>
                <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Zakelijk E-mailadres</label>
              <input type="email" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Interesse in</label>
              <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#fff' }}>
                <option>Locra Platform</option>
                <option>CodeMatch IDE</option>
                <option>Enterprise Hosting</option>
              </select>
            </div>
            <button type="button" className="btn btn-primary btn-lg" style={{ marginTop: '1rem' }}>Aanvraag Versturen <ArrowRight size={18} /></button>
          </form>
        </div>
      </div>
    </div>
  )
}
"""

def write(path, content):
    with open(os.path.join(pages_path, path), 'w') as f:
        f.write(content)

write('Platform.tsx', platform_tsx)
write('CodeMatch.tsx', codematch_tsx)
write('Security.tsx', security_tsx)
write('Enroll.tsx', enroll_tsx)

print("Generated full pages for locra-website with Blue SaaS theme.")
