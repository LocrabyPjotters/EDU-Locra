import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src'

dirs = [
    'components',
    'pages'
]

for d in dirs:
    os.makedirs(os.path.join(base_path, d), exist_ok=True)

# 1. Header.tsx
header_code = """import { useState, useEffect } from 'react'
import { Link, useLocation, NavLink } from 'react-router-dom'
import { Menu, X, ArrowRight, GraduationCap } from 'lucide-react'
import './Header.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  const nav = [
    ['/platform', 'Platform'],
    ['/academy', 'Academy'],
    ['/security', 'Privacy'],
    ['/docs', 'Documentatie'],
    ['/pricing', 'Prijzen']
  ]

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link to="/" className="brand">
          <div className="brand-logo"><GraduationCap size={20} /></div>
          <span>Locra <b>EDU</b></span>
        </Link>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} className={({isActive}) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
          
          <div className="nav-actions-mobile">
            <Link to="/enroll" className="btn btn-primary">Licentie Aanvragen</Link>
          </div>
        </nav>

        <div className="nav-actions-desktop">
          <Link to="/enroll" className="btn btn-primary">
            Licentie Aanvragen <ArrowRight size={16} />
          </Link>
        </div>

        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  )
}
"""

# 2. Header.css
header_css = """.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  z-index: 1000;
  transition: all 0.3s ease;
  border-bottom: 1px solid transparent;
}
.header.scrolled {
  background: rgba(10, 20, 20, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
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
  font-weight: 800;
  color: #fff;
  text-decoration: none;
  font-family: 'Outfit', sans-serif;
  letter-spacing: -0.5px;
}
.brand b { color: #10b981; }
.brand-logo {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
}
.nav-links {
  display: flex;
  gap: 2.5rem;
  align-items: center;
}
.nav-links a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s;
}
.nav-links a:hover, .nav-links a.active {
  color: #fff;
}
.nav-actions-desktop {
  display: flex;
}
.nav-actions-mobile {
  display: none;
}
.mobile-toggle {
  display: none;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
}
@media (max-width: 768px) {
  .nav-actions-desktop { display: none; }
  .mobile-toggle { display: block; }
  .nav-links {
    position: absolute;
    top: 80px; left: 0; right: 0;
    background: rgba(10, 20, 20, 0.95);
    backdrop-filter: blur(20px);
    flex-direction: column;
    padding: 2rem;
    gap: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .nav-links.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }
  .nav-actions-mobile {
    display: block;
    margin-top: 1rem;
    width: 100%;
  }
  .nav-actions-mobile .btn {
    width: 100%;
    justify-content: center;
  }
}
"""

# 3. Footer.tsx
footer_code = """import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <div className="brand-logo"><GraduationCap size={18}/></div>
              <span>Locra <b>EDU</b></span>
            </Link>
            <p>Didactische AI die school, docent en leerling helpt verantwoord vooruit te komen. Veilig, lokaal en transparant.</p>
          </div>
          <div className="footer-links">
            <div className="link-group">
              <h4>Platform</h4>
              <Link to="/academy">Locra Academy</Link>
              <Link to="/platform">Functionaliteiten</Link>
              <Link to="/security">Privacy & Veiligheid</Link>
            </div>
            <div className="link-group">
              <h4>Starten</h4>
              <Link to="/docs">Installatie</Link>
              <Link to="/videos">Setupvideo's</Link>
              <Link to="/faq">FAQ</Link>
            </div>
            <div className="link-group">
              <h4>Contact</h4>
              <Link to="/enroll">Licentie Aanvragen</Link>
              <a href="mailto:locra@pjotters.nl">locra@pjotters.nl</a>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Pjotters. Alle rechten voorbehouden.</p>
      </div>
    </footer>
  )
}
"""

# 4. Footer.css
footer_css = """.footer {
  background: #020605;
  border-top: 1px solid rgba(255,255,255,0.05);
  margin-top: 5rem;
}
.footer-top {
  max-width: 1200px;
  margin: 0 auto;
  padding: 5rem 2rem;
}
.footer-content {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 4rem;
}
.footer-brand p {
  color: #94a3b8;
  margin-top: 1.5rem;
  line-height: 1.6;
  max-width: 300px;
}
.footer-links {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.link-group h4 {
  color: #fff;
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}
.link-group a {
  display: block;
  color: #94a3b8;
  text-decoration: none;
  margin-bottom: 0.8rem;
  transition: color 0.2s;
}
.link-group a:hover {
  color: #10b981;
}
.footer-bottom {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 2rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}
@media (max-width: 768px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  .footer-links {
    grid-template-columns: 1fr 1fr;
  }
}
"""

# 5. Home.tsx
home_code = """import { ArrowRight, BookOpen, UsersRound, Sparkles, Check, LibraryBig } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './Home.css'

const scenarios = [
  ['Socratisch leren', 'Ik snap Pythagoras niet.', 'Laten we samen kijken: welke zijden vormen de rechte hoek? Als die 3 en 4 zijn, wat is dan 3² + 4²?'],
  ['SOMtoday', 'Wat staat er deze week op mijn planning?', 'Met een gekoppelde agenda kan Locra helpen je taken en planning overzichtelijk te maken.'],
  ['Academy', 'Hoe maak ik een goede prompt?', 'Gebruik CLEAR: Context, Lengte, Examples, Actief werkwoord en Rol. Zullen we je opdracht samen scherp maken?']
]

export default function Home() {
  const [activeScenario, setActiveScenario] = useState(0)
  const d = scenarios[activeScenario]

  return (
    <div className="page-home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="badge"><Sparkles size={14}/> Ontworpen voor onderwijs</div>
          <h1 className="hero-title">
            AI die leerlingen laat <br/> <span className="text-gradient">denken.</span>
          </h1>
          <p className="hero-subtitle">
            Locra EDU brengt veilige AI, didactiek en schoolkennis samen. Voor leerprocessen waarin de docent de regie houdt en de leerling blijft leren.
          </p>
          <div className="hero-actions">
            <Link to="/enroll" className="btn btn-primary btn-lg">
              Vraag licentie aan <ArrowRight size={18} />
            </Link>
            <Link to="/academy" className="btn btn-secondary btn-lg">
              Ontdek de Academy
            </Link>
          </div>
          <div className="trust-badges">
            <span><Check size={16}/> Voor docent & leerling</span>
            <span><Check size={16}/> Eigen schoolomgeving</span>
            <span><Check size={16}/> AI-geletterdheid</span>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section">
        <div className="demo-container">
          <div className="demo-text">
            <span className="overline">Probeer het gedachtegoed</span>
            <h2>Niet het antwoord geven.<br/>Wel het denken verder helpen.</h2>
            <p>Met socratische begeleiding helpt Locra leerlingen stap voor stap zonder het leerproces over te nemen. Zo blijft AI een hulpmiddel voor begrip, niet een snelweg langs het leren.</p>
            <p className="quiet">De docent bepaalt de context en de opdracht; de leerling houdt verantwoordelijkheid voor het eigen werk.</p>
          </div>
          <div className="demo-ui">
            <div className="demo-chips">
              {scenarios.map((s, i) => (
                <button 
                  key={i} 
                  className={activeScenario === i ? 'active' : ''} 
                  onClick={() => setActiveScenario(i)}
                >
                  {s[0]}
                </button>
              ))}
            </div>
            <div className="chat-window">
              <div className="bubble user">{d[1]}</div>
              <div className="bubble ai">
                <Sparkles size={16} className="ai-icon"/>
                {d[2]}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-header">
          <span className="overline">Waarom Locra EDU?</span>
          <h2>Geen algemene chatbot naast de les,<br/>maar een onderwijsomgeving eromheen.</h2>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><UsersRound size={24} /></div>
            <h3>Didactiek voorop</h3>
            <p>Socratische begeleiding en duidelijke AI-regels geven ruimte aan oefenen, redeneren en reflecteren.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><LibraryBig size={24} /></div>
            <h3>De school houdt regie</h3>
            <p>Rollen, instellingen, modellen, opslag en toegestane functies worden beheerd vanuit één organisatieomgeving.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BookOpen size={24} /></div>
            <h3>AI-geletterdheid in de praktijk</h3>
            <p>De Academy maakt betrouwbaarheid, prompting, bias en deepfakes onderdeel van het leerproces.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
"""

# 6. Home.css
home_css = """.page-home {
  padding-top: 120px;
}
.hero {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 2rem 5rem;
  text-align: center;
}
.hero-glow {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
  z-index: -1;
  pointer-events: none;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.4rem 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 2rem;
  box-shadow: 0 0 20px rgba(16,185,129,0.15);
}
.hero-title {
  font-size: clamp(3rem, 5vw, 4.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
}
.text-gradient {
  background: linear-gradient(135deg, #34d399, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle {
  font-size: 1.2rem;
  color: #94a3b8;
  max-width: 700px;
  margin: 0 auto 3rem;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 3rem;
}
.trust-badges {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}
.trust-badges span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 0.95rem;
}

/* Demo UI */
.demo-section {
  max-width: 1200px;
  margin: 5rem auto;
  padding: 0 2rem;
}
.demo-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}
.overline {
  display: block;
  color: #10b981;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
.demo-text h2 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}
.demo-text p {
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}
.demo-text p.quiet {
  font-size: 0.95rem;
  opacity: 0.7;
}

.demo-ui {
  background: rgba(15, 20, 25, 0.7);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
}
.demo-chips {
  display: flex;
  gap: 10px;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.demo-chips button {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.2s;
}
.demo-chips button.active, .demo-chips button:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}
.chat-window {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.bubble {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  max-width: 90%;
  font-size: 0.95rem;
  line-height: 1.5;
}
.bubble.user {
  background: rgba(255,255,255,0.05);
  align-self: flex-end;
  color: #f8fafc;
  border: 1px solid rgba(255,255,255,0.05);
}
.bubble.ai {
  background: rgba(16, 185, 129, 0.1);
  align-self: flex-start;
  color: #f8fafc;
  border: 1px solid rgba(16, 185, 129, 0.2);
  display: flex;
  gap: 12px;
}
.ai-icon {
  color: #34d399;
  flex-shrink: 0;
  margin-top: 2px;
}

/* Features */
.features-section {
  max-width: 1200px;
  margin: 5rem auto;
  padding: 4rem 2rem;
}
.section-header {
  text-align: center;
  margin-bottom: 4rem;
}
.section-header h2 {
  font-size: 2.5rem;
  margin-top: 1rem;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
.feature-card {
  background: rgba(15, 20, 25, 0.4);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 2.5rem;
  border-radius: 20px;
  transition: all 0.3s;
}
.feature-card:hover {
  background: rgba(20, 25, 30, 0.7);
  transform: translateY(-5px);
  border-color: rgba(16, 185, 129, 0.3);
}
.feature-icon {
  width: 50px; height: 50px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.feature-card h3 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
}
.feature-card p {
  color: #94a3b8;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .demo-container {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
"""

# 7. Global App.css
app_css = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #010403;
  --fg: #f8fafc;
  --primary: #10b981;
  --secondary: #059669;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  overflow-x: hidden;
  background-image: 
    radial-gradient(circle at 20% 40%, rgba(16, 185, 129, 0.05), transparent 30%),
    radial-gradient(circle at 80% 60%, rgba(5, 150, 105, 0.05), transparent 30%);
  background-attachment: fixed;
}

h1, h2, h3, h4 {
  font-family: 'Outfit', sans-serif;
}

/* Base Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}
.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}
.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: #fff;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}
"""

# 8. App.tsx wrapper
app_tsx = """import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
"""


def write(path, content):
    with open(os.path.join(base_path, path), 'w') as f:
        f.write(content)

write('components/Header.tsx', header_code)
write('components/Header.css', header_css)
write('components/Footer.tsx', footer_code)
write('components/Footer.css', footer_css)
write('pages/Home.tsx', home_code)
write('pages/Home.css', home_css)
write('App.css', app_css)
write('App.tsx', app_tsx)

print("Scaffolded locra-edu successfully.")
