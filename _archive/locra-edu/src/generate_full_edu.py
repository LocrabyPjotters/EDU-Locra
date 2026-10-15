import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src'
pages_path = os.path.join(base_path, 'pages')
os.makedirs(pages_path, exist_ok=True)

# 1. App.tsx (Updated Routing)
app_tsx = """import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Features from './pages/Features'
import Veiligheid from './pages/Veiligheid'
import Prijzen from './pages/Prijzen'
import Docs from './pages/Docs'
import Aanmelden from './pages/Aanmelden'
import Academy from './pages/Academy'
import Demo from './pages/Demo'
import Workshop from './pages/Workshop'
import Download from './pages/Download'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/veiligheid" element={<Veiligheid />} />
          <Route path="/prijzen" element={<Prijzen />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/aanmelden" element={<Aanmelden />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/onlinedemo" element={<Demo />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/download" element={<Download />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
"""

# 2. Features.tsx
features_tsx = """import { CheckCircle2, Bot, BookOpen, Layers, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Features() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Platform Features</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Eén platform voor de hele school.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Ontdek hoe Locra EDU docenten, leerlingen en beheerders verbindt in één veilige AI-omgeving.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {[
            { icon: <Bot size={32}/>, color: 'var(--brand-blue)', title: 'AI-Modellen', desc: 'Ondersteuning voor meerdere aanbieders. De school bepaalt welke modellen beschikbaar zijn.' },
            { icon: <BookOpen size={32}/>, color: 'var(--brand-yellow)', title: 'Les maken en geven', desc: 'Genereer lesmateriaal, quizzen en gebruik de Teacherbot voor klassikale begeleiding.' },
            { icon: <Users size={32}/>, color: 'var(--brand-orange)', title: 'Leren & Feedback', desc: 'Socratische feedback voor leerlingen. We geven niet het antwoord, maar helpen met denken.' },
            { icon: <Layers size={32}/>, color: 'var(--brand-navy)', title: 'Documenten & RAG', desc: 'Koppel schoolkennis via bestanden en gebruik sjablonen voor schoolbreed beleid.' },
            { icon: <ShieldCheck size={32}/>, color: 'var(--brand-blue)', title: 'Beheer & Organisatie', desc: 'Centraal beheer van gebruikers, permissies en auditlogs voor de IT-afdeling.' }
          ].map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '2rem', transition: 'transform 0.2s' }}>
              <div style={{ color: f.color, marginBottom: '1.5rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '5rem', background: 'var(--bg-secondary)', padding: '4rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <h2>Zien hoe het werkt in de praktijk?</h2>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link to="/onlinedemo" className="btn btn-primary btn-lg">Demo Aanvragen</Link>
            <Link to="/aanmelden" className="btn btn-secondary btn-lg">Start een Pilot</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
"""

# 3. Veiligheid.tsx
veiligheid_tsx = """import { Shield, Lock, EyeOff, Server } from 'lucide-react'

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
"""

# 4. Prijzen.tsx
prijzen_tsx = """import { CheckCircle2 } from 'lucide-react'
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
"""

# 5. Aanmelden.tsx
aanmelden_tsx = """import { ArrowRight } from 'lucide-react'

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
"""

# 6. Demo.tsx
demo_tsx = """import { PlayCircle } from 'lucide-react'

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
"""

# Placeholder templates for others to save space
simple_template = """export default function {name}() {{
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}>
        <span className="overline">{name}</span>
        <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>{desc}</p>
      </div>
    </div>
  )
}}
"""

docs_tsx = simple_template.format(name="Docs", title="Documentatie & Kennisbank", desc="Ontdek handleidingen voor docenten, leerlingen en ICT-beheerders.")
academy_tsx = simple_template.format(name="Academy", title="AI Geletterdheid", desc="Interactieve E-learning modules over prompting, deepfakes en ethiek.")
workshop_tsx = simple_template.format(name="Workshop", title="Trainingen op maat", desc="Plan een in-house workshop voor uw docententeam (€1.250 per sessie).")
download_tsx = simple_template.format(name="Download", title="Desktop & Mobiel", desc="Download de standalone apps voor Windows, macOS en iOS/Android.")

def write(path, content):
    with open(os.path.join(base_path, path), 'w') as f:
        f.write(content)

write('App.tsx', app_tsx)
write('pages/Features.tsx', features_tsx)
write('pages/Veiligheid.tsx', veiligheid_tsx)
write('pages/Prijzen.tsx', prijzen_tsx)
write('pages/Aanmelden.tsx', aanmelden_tsx)
write('pages/Demo.tsx', demo_tsx)
write('pages/Docs.tsx', docs_tsx)
write('pages/Academy.tsx', academy_tsx)
write('pages/Workshop.tsx', workshop_tsx)
write('pages/Download.tsx', download_tsx)

print("Generated all pages for locra-edu with Blue SaaS theme.")
