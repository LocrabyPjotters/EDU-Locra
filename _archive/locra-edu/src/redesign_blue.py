import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src'

# 1. App.css (Global Theme)
app_css = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap');

:root {
  /* Blue Education SaaS Theme */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  
  --brand-blue: #2563eb;       /* Helder blauw */
  --brand-blue-hover: #1d4ed8;
  --brand-navy: #1e3a8a;       /* Donkerblauw / contrast */
  --brand-yellow: #facc15;     /* Accent 1 */
  --brand-orange: #f97316;     /* Accent 2 */
  
  --border-light: #e2e8f0;
  --radius: 12px;
  --radius-lg: 24px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

h1, h2, h3, h4 {
  font-family: 'Poppins', sans-serif;
  color: var(--brand-navy);
  line-height: 1.2;
}

.overline {
  display: inline-block;
  color: var(--brand-blue);
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 1rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  font-family: 'Inter', sans-serif;
}
.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}
.btn-primary {
  background: var(--brand-blue);
  color: #fff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
}
.btn-primary:hover {
  background: var(--brand-blue-hover);
  transform: translateY(-2px);
}
.btn-secondary {
  background: #fff;
  color: var(--brand-navy);
  border: 2px solid var(--border-light);
}
.btn-secondary:hover {
  border-color: var(--brand-navy);
  background: var(--bg-secondary);
}
.btn-accent {
  background: var(--brand-yellow);
  color: var(--brand-navy);
}
.btn-accent:hover {
  background: #eab308;
}
"""

# 2. Header.tsx & Header.css
header_tsx = """import { useState, useEffect } from 'react'
import { Link, useLocation, NavLink } from 'react-router-dom'
import { Menu, X, ArrowRight, GraduationCap } from 'lucide-react'
import './Header.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location])

  const nav = [
    ['/features', 'Features'],
    ['/veiligheid', 'Veiligheid'],
    ['/prijzen', 'Prijzen'],
    ['/onlinedemo', 'Demo'],
    ['/docs', 'Documentatie']
  ]

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link to="/" className="brand">
          <div className="brand-logo"><GraduationCap size={24} /></div>
          <span>Locra <b>EDU</b></span>
        </Link>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} className={({isActive}) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
          
          <div className="nav-actions-mobile">
            <Link to="/aanmelden" className="btn btn-primary">Aanmelden</Link>
          </div>
        </nav>

        <div className="nav-actions-desktop">
          <Link to="/aanmelden" className="btn btn-primary">
            Aanmelden <ArrowRight size={16} />
          </Link>
        </div>

        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X color="#1e3a8a" /> : <Menu color="#1e3a8a" />}
        </button>
      </div>
    </header>
  )
}
"""

header_css = """.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  z-index: 1000;
  transition: all 0.2s ease;
  background: #ffffff;
  border-bottom: 1px solid transparent;
}
.header.scrolled {
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border-bottom: 1px solid var(--border-light);
}
.header-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--brand-navy);
  text-decoration: none;
  font-family: 'Poppins', sans-serif;
}
.brand b { color: var(--brand-blue); }
.brand-logo {
  color: var(--brand-blue);
  display: flex;
  align-items: center;
}
.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}
.nav-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 0.2s;
}
.nav-links a:hover, .nav-links a.active {
  color: var(--brand-blue);
}
.nav-actions-desktop {
  display: flex;
}
.nav-actions-mobile { display: none; }
.mobile-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
}
@media (max-width: 768px) {
  .nav-actions-desktop { display: none; }
  .mobile-toggle { display: block; }
  .nav-links {
    position: absolute;
    top: 80px; left: 0; right: 0;
    background: #ffffff;
    flex-direction: column;
    padding: 2rem;
    gap: 1.5rem;
    border-bottom: 1px solid var(--border-light);
    box-shadow: 0 10px 20px rgba(0,0,0,0.05);
    display: none;
  }
  .nav-links.open { display: flex; }
  .nav-actions-mobile {
    display: block; width: 100%; margin-top: 1rem;
  }
  .nav-actions-mobile .btn { width: 100%; justify-content: center; }
}
"""

# 3. Home.tsx & Home.css
home_tsx = """import { ArrowRight, BookOpen, UsersRound, ShieldCheck, CheckCircle2, MonitorPlay } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="page-home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="overline">AI Goed Geregeld</span>
          <h1 className="hero-title">
            Het complete AI-platform voor <span className="text-blue">het onderwijs.</span>
          </h1>
          <p className="hero-subtitle">
            Niet zomaar een chatbot, maar een veilige, beheerbare leer- en werkomgeving voor leerlingen, docenten en schoolbesturen. 
          </p>
          <div className="hero-actions">
            <Link to="/onlinedemo" className="btn btn-primary btn-lg">
              Plan een demo
            </Link>
            <Link to="/features" className="btn btn-secondary btn-lg">
              Bekijk features
            </Link>
          </div>
          <div className="trust-badges">
            <span><CheckCircle2 size={18} color="#2563eb" /> AVG & PII-Proof</span>
            <span><CheckCircle2 size={18} color="#2563eb" /> Meerdere Modellen</span>
            <span><CheckCircle2 size={18} color="#2563eb" /> 100% Onderwijsfocus</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mockup-window">
            <div className="mockup-header">
              <span className="dot bg-red"></span><span className="dot bg-yellow"></span><span className="dot bg-green"></span>
            </div>
            <div className="mockup-body">
              <div className="chat-bubble user">Hoe leg ik breuken uit aan groep 6?</div>
              <div className="chat-bubble ai">
                <strong>Hier is een lesopzet:</strong>
                <ul>
                  <li>Start met een fysiek voorbeeld (bijv. een taart).</li>
                  <li>Laat de leerlingen zelf stukken verdelen.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-header">
          <span className="overline">Alles voor de school</span>
          <h2>Regie, veiligheid en onderwijspraktijk in één systeem.</h2>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><UsersRound size={28} /></div>
            <h3>Les maken en geven</h3>
            <p>Ontwikkel lesmateriaal, zet opdrachten klaar en gebruik de Teacherbot als persoonlijke onderwijsassistent.</p>
            <Link to="/features" className="card-link">Lees meer <ArrowRight size={14}/></Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon orange"><ShieldCheck size={28} /></div>
            <h3>Beheer en veiligheid</h3>
            <p>Beheer rollen, AI-modellen, en beleid centraal. Gegarandeerd AVG-proof met anonieme leerlingaccounts.</p>
            <Link to="/veiligheid" className="card-link">Ontdek privacy <ArrowRight size={14}/></Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon yellow"><MonitorPlay size={28} /></div>
            <h3>Training & Workshops</h3>
            <p>Van pilot tot schoolbrede uitrol: we bieden workshops en e-learning modules om AI goed te laten landen.</p>
            <Link to="/workshop" className="card-link">Bekijk workshops <ArrowRight size={14}/></Link>
          </div>
        </div>
      </section>

      {/* Info Section / Content Chunking */}
      <section className="info-section">
        <div className="info-container">
          <div className="info-text">
            <span className="overline">Uitgebreide mogelijkheden</span>
            <h2>Niet één model, maar het beste gereedschap voor de taak.</h2>
            <p>Locra EDU werkt achter de schermen met meerdere taal- en beeldmodellen. Zo zijn gebruikers niet afhankelijk van één leverancier en kunnen ze tools inzetten voor internet zoeken, afbeeldingen maken, documenten verwerken en bestandsanalyse.</p>
            <ul className="check-list">
              <li><CheckCircle2 size={16} color="#2563eb" /> Veilige integratie met documenten</li>
              <li><CheckCircle2 size={16} color="#2563eb" /> Rolgebaseerde toegang (Docent, Leerling, Beheerder)</li>
              <li><CheckCircle2 size={16} color="#2563eb" /> Gebruiksvriendelijk Dashboard</li>
            </ul>
          </div>
          <div className="info-visual">
            <div className="abstract-illustration">
              <div className="shape blue-shape"></div>
              <div className="shape yellow-shape"></div>
              <div className="shape orange-shape"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
"""

home_css = """.page-home {
  padding-top: 100px;
}
.text-blue { color: var(--brand-blue); }

/* Hero */
.hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 4rem;
  align-items: center;
}
.hero-title {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  margin-bottom: 1.5rem;
  letter-spacing: -0.02em;
}
.hero-subtitle {
  font-size: 1.15rem;
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
  max-width: 550px;
}
.hero-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}
.trust-badges {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.trust-badges span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--brand-navy);
}

/* Mockup */
.hero-visual {
  position: relative;
}
.mockup-window {
  background: #fff;
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  overflow: hidden;
}
.mockup-header {
  background: var(--bg-secondary);
  padding: 12px 1rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  gap: 8px;
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.bg-red { background: #ef4444; }
.bg-yellow { background: #eab308; }
.bg-green { background: #22c55e; }
.mockup-body {
  padding: 2rem;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.chat-bubble {
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.95rem;
  max-width: 90%;
}
.chat-bubble.user {
  background: var(--brand-blue);
  color: #fff;
  align-self: flex-end;
}
.chat-bubble.ai {
  background: #fff;
  border: 1px solid var(--border-light);
  align-self: flex-start;
  color: var(--text-primary);
}
.chat-bubble.ai ul {
  padding-left: 1.2rem;
  margin-top: 0.5rem;
}

/* Features */
.features-section {
  background: var(--bg-secondary);
  padding: 5rem 2rem;
}
.section-header {
  text-align: center;
  max-width: 600px;
  margin: 0 auto 4rem;
}
.section-header h2 { font-size: 2.2rem; }
.features-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
.feature-card {
  background: #fff;
  padding: 2.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0,0,0,0.05);
}
.feature-icon {
  width: 56px; height: 56px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--brand-blue);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.feature-icon.orange { background: rgba(249, 115, 22, 0.1); color: var(--brand-orange); }
.feature-icon.yellow { background: rgba(250, 204, 21, 0.2); color: #ca8a04; }
.feature-card h3 { margin-bottom: 1rem; font-size: 1.25rem; }
.feature-card p { color: var(--text-secondary); margin-bottom: 1.5rem; }
.card-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--brand-blue);
  font-weight: 600;
  text-decoration: none;
}
.card-link:hover { text-decoration: underline; }

/* Info Section */
.info-section {
  padding: 6rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
.info-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}
.info-text h2 { font-size: 2.2rem; margin-bottom: 1.5rem; }
.info-text p { color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 2rem; }
.check-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.check-list li { display: flex; align-items: center; gap: 10px; font-weight: 500; }

.abstract-illustration {
  position: relative;
  height: 400px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.shape { position: absolute; border-radius: 50%; }
.blue-shape { width: 300px; height: 300px; background: rgba(37, 99, 235, 0.1); top: -50px; right: -50px; }
.yellow-shape { width: 150px; height: 150px; background: rgba(250, 204, 21, 0.2); bottom: 50px; left: 40px; }
.orange-shape { width: 100px; height: 100px; background: rgba(249, 115, 22, 0.15); top: 150px; right: 100px; }

@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; text-align: center; }
  .hero-actions { justify-content: center; flex-wrap: wrap; }
  .trust-badges { justify-content: center; }
  .info-container { grid-template-columns: 1fr; }
}
"""

def write(path, content):
    with open(os.path.join(base_path, path), 'w') as f:
        f.write(content)

write('App.css', app_css)
write('components/Header.tsx', header_tsx)
write('components/Header.css', header_css)
write('pages/Home.tsx', home_tsx)
write('pages/Home.css', home_css)
write('pages/Docs.tsx', "import React from 'react'; export default function Docs() { return <div style={{padding: '120px 2rem'}}><h1>Docs</h1></div>; }")

print("Rewrote locra-edu to Blue Education SaaS design.")
