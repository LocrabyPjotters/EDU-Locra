import { ArrowRight, Boxes, Lock, Zap, CheckCircle2 } from 'lucide-react'
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
