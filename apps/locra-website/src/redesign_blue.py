import os

base_path = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src'

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
"""

header_tsx = """import { useState, useEffect } from 'react'
import { Link, useLocation, NavLink } from 'react-router-dom'
import { Menu, X, ArrowRight, Layers } from 'lucide-react'
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
    ['/platform', 'Platform'],
    ['/codematch', 'CodeMatch'],
    ['/security', 'Security']
  ]

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link to="/" className="brand">
          <div className="brand-logo"><Layers size={24} /></div>
          <span>Locra</span>
        </Link>

        <nav className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} className={({isActive}) => isActive ? 'active' : ''}>
              {label}
            </NavLink>
          ))}
          
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

home_tsx = """import { ArrowRight, Boxes, Lock, Zap, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="page-home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="overline">De AI-Basislaag</span>
          <h1 className="hero-title">
            Bouw veilige AI-oplossingen op <span className="text-blue">eigen infrastructuur.</span>
          </h1>
          <p className="hero-subtitle">
            Locra biedt enterprise-grade AI functionaliteiten, van een RAG-kennisbank tot IDE tools, gehost op jouw voorwaarden. 
          </p>
          <div className="hero-actions">
            <Link to="/platform" className="btn btn-primary btn-lg">
              Ontdek het Platform
            </Link>
            <Link to="/codematch" className="btn btn-secondary btn-lg">
              CodeMatch IDE <ArrowRight size={16} />
            </Link>
          </div>
          <div className="trust-badges">
            <span><CheckCircle2 size={18} color="#2563eb" /> Lokaal inzetbaar</span>
            <span><CheckCircle2 size={18} color="#2563eb" /> API First</span>
            <span><CheckCircle2 size={18} color="#2563eb" /> Volledige Regie</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mockup-window">
            <div className="mockup-header">
              <span className="dot bg-red"></span><span className="dot bg-yellow"></span><span className="dot bg-green"></span>
            </div>
            <div className="mockup-body">
              <div className="code-block">
                <span className="code-comment">// Connect to Locra RAG Engine</span><br/>
                <span className="code-keyword">const</span> locra = <span className="code-keyword">new</span> <span className="code-function">LocraClient</span>(&#123;<br/>
                &nbsp;&nbsp;apiKey: process.env.LOCRA_KEY<br/>
                &#125;);<br/>
                <br/>
                <span className="code-keyword">await</span> locra.db.<span className="code-function">query</span>(<span className="code-string">"Project roadmap"</span>);
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-header">
          <span className="overline">Kernfuncties</span>
          <h2>Modulaire intelligentie voor jouw data.</h2>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Boxes size={28} /></div>
            <h3>Platform & API</h3>
            <p>Gebruik Locra als headless AI-engine voor je eigen interne tools of integreer het in bestaande software.</p>
            <Link to="/platform" className="card-link">Platform details <ArrowRight size={14}/></Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon yellow"><Zap size={28} /></div>
            <h3>CodeMatch IDE</h3>
            <p>Een complete in-browser workspace met AI-autocomplete en geïntegreerde RAG voor documentatie.</p>
            <Link to="/codematch" className="card-link">Bekijk CodeMatch <ArrowRight size={14}/></Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon orange"><Lock size={28} /></div>
            <h3>Data Security</h3>
            <p>Geen data lekt naar publieke modellen. Isolatie per tenant of draai het volledig lokaal (on-premise).</p>
            <Link to="/security" className="card-link">Lees over privacy <ArrowRight size={14}/></Link>
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
  background: #0f172a; /* Dark IDE look */
  border-radius: var(--radius);
  border: 1px solid var(--brand-navy);
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  overflow: hidden;
}
.mockup-header {
  background: #1e293b;
  padding: 12px 1rem;
  border-bottom: 1px solid #334155;
  display: flex;
  gap: 8px;
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.bg-red { background: #ef4444; }
.bg-yellow { background: #eab308; }
.bg-green { background: #22c55e; }
.mockup-body {
  padding: 2rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}
.code-comment { color: #64748b; }
.code-keyword { color: #c678dd; }
.code-function { color: #61afef; }
.code-string { color: #98c379; }
.code-block { color: #abb2bf; }

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

@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; text-align: center; }
  .hero-actions { justify-content: center; flex-wrap: wrap; }
  .trust-badges { justify-content: center; }
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

print("Rewrote locra-website to Blue Education SaaS design.")
