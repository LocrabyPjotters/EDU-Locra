import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src'

dirs = [
    'components',
    'pages'
]

for d in dirs:
    os.makedirs(os.path.join(base_path, d), exist_ok=True)

# 1. Header.tsx
header_code = """import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ArrowRight, Github } from 'lucide-react'
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

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link to="/" className="brand">
          <div className="brand-logo">L</div>
          <span>Locra</span>
        </Link>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          <Link to="/platform" className={location.pathname === '/platform' ? 'active' : ''}>Platform</Link>
          <Link to="/codematch" className={location.pathname === '/codematch' ? 'active' : ''}>CodeMatch</Link>
          <Link to="/security" className={location.pathname === '/security' ? 'active' : ''}>Security</Link>
          
          <div className="nav-actions-mobile">
            <Link to="/enroll" className="btn btn-primary">Plan Demo</Link>
          </div>
        </nav>

        <div className="nav-actions-desktop">
          <Link to="/enroll" className="btn btn-primary">
            Plan Demo <ArrowRight size={16} />
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
  background: rgba(3, 0, 20, 0.7);
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
.brand-logo {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, #7c3aed, #3b82f6);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
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
    background: rgba(10, 5, 30, 0.95);
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
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <div className="brand-logo">L</div>
              <span>Locra</span>
            </Link>
            <p>De private AI-infrastructuur voor onderwijs en development teams. Volledig lokaal, veilig en krachtig.</p>
          </div>
          <div className="footer-links">
            <div className="link-group">
              <h4>Product</h4>
              <Link to="/platform">Platform</Link>
              <Link to="/codematch">CodeMatch</Link>
              <Link to="/security">Security</Link>
            </div>
            <div className="link-group">
              <h4>Resources</h4>
              <a href="#">Documentatie</a>
              <a href="#">API Referentie</a>
              <a href="#">Blog</a>
            </div>
            <div className="link-group">
              <h4>Bedrijf</h4>
              <Link to="/enroll">Contact</Link>
              <a href="#">Over ons</a>
              <a href="#">Privacy</a>
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
  background: #05030f;
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
  color: #7c3aed;
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
home_code = """import { ArrowRight, ShieldCheck, Database, Zap, Code2, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="page-home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="badge">🚀 Locra 2.0 is nu beschikbaar</div>
          <h1 className="hero-title">
            De ultieme <span className="text-gradient">Private AI</span> <br/>
            voor jouw organisatie.
          </h1>
          <p className="hero-subtitle">
            Houd volledige controle over data, code en kennis. Ontworpen voor scholen, development teams en instanties met strikte privacy-eisen.
          </p>
          <div className="hero-actions">
            <Link to="/enroll" className="btn btn-primary btn-lg">
              Vraag Demo Aan <ArrowRight size={18} />
            </Link>
            <Link to="/codematch" className="btn btn-secondary btn-lg">
              Ontdek CodeMatch
            </Link>
          </div>
        </div>
        
        {/* Abstract UI Mockup */}
        <div className="hero-mockup-wrapper">
          <div className="hero-mockup">
            <div className="mockup-header">
              <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar"></div>
              <div className="mockup-chat">
                <div className="chat-bubble ai">Hallo! Hoe kan ik je team vandaag helpen met de codebase?</div>
                <div className="chat-bubble user">Kun je deze legacy SQL query optimaliseren en refactoren?</div>
                <div className="chat-bubble ai">Natuurlijk! Ik heb een performantere versie geschreven.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-header">
          <h2>Waarom kiezen voor Locra?</h2>
          <p>Een state-of-the-art AI ervaring zonder in te leveren op veiligheid.</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><LockKeyhole size={24} /></div>
            <h3>100% Lokaal & Private</h3>
            <p>Geen data naar OpenAI of Google. Jouw prompts en documenten blijven gegarandeerd binnen het eigen netwerk.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Code2 size={24} /></div>
            <h3>CodeMatch Integratie</h3>
            <p>Naadloze IDE ervaring direct in de browser. Genereer, bewerk en review code zonder de flow te verlaten.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Database size={24} /></div>
            <h3>Onbeperkte Kennis (RAG)</h3>
            <p>Koppel je eigen databases, PDF's en website links. Locra leert de context van de organisatie in real-time.</p>
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
  background: radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%);
  z-index: -1;
  pointer-events: none;
}
.badge {
  display: inline-block;
  padding: 0.4rem 1rem;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.3);
  color: #a78bfa;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 2rem;
  box-shadow: 0 0 20px rgba(124,58,237,0.2);
}
.hero-title {
  font-size: clamp(3rem, 5vw, 4.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
}
.text-gradient {
  background: linear-gradient(135deg, #a855f7, #3b82f6);
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
  margin-bottom: 5rem;
}

/* Mockup UI */
.hero-mockup-wrapper {
  perspective: 1000px;
  margin-top: 2rem;
}
.hero-mockup {
  max-width: 900px;
  margin: 0 auto;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 60px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05);
  transform: rotateX(5deg) translateY(0);
  animation: float 6s ease-in-out infinite;
}
.mockup-header {
  background: rgba(0,0,0,0.3);
  padding: 1rem;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.dot {
  width: 12px; height: 12px; border-radius: 50%;
}
.dot.red { background: #ef4444; }
.dot.yellow { background: #eab308; }
.dot.green { background: #22c55e; }

.mockup-body {
  display: flex;
  height: 400px;
}
.mockup-sidebar {
  width: 250px;
  background: rgba(0,0,0,0.2);
  border-right: 1px solid rgba(255,255,255,0.05);
}
.mockup-chat {
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.chat-bubble {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  max-width: 80%;
  font-size: 0.95rem;
}
.chat-bubble.ai {
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.3);
  align-self: flex-start;
  color: #e2e8f0;
}
.chat-bubble.user {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  align-self: flex-end;
  color: #e2e8f0;
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
  margin-bottom: 1rem;
}
.section-header p {
  color: #94a3b8;
  font-size: 1.1rem;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
.feature-card {
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 2.5rem;
  border-radius: 20px;
  transition: all 0.3s;
}
.feature-card:hover {
  background: rgba(30, 41, 59, 0.6);
  transform: translateY(-5px);
  border-color: rgba(124, 58, 237, 0.3);
}
.feature-icon {
  width: 50px; height: 50px;
  background: rgba(124, 58, 237, 0.15);
  color: #a855f7;
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
  .hero-actions {
    flex-direction: column;
  }
  .mockup-sidebar {
    display: none;
  }
}
"""

# 7. Global App.css
app_css = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #030014;
  --fg: #f8fafc;
  --primary: #7c3aed;
  --secondary: #3b82f6;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  overflow-x: hidden;
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(124, 58, 237, 0.08), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(59, 130, 246, 0.08), transparent 25%);
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
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(124, 58, 237, 0.5);
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

@keyframes float {
  0% { transform: rotateX(5deg) translateY(0px); }
  50% { transform: rotateX(5deg) translateY(-15px); }
  100% { transform: rotateX(5deg) translateY(0px); }
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

print("Scaffolded locra-website successfully.")
