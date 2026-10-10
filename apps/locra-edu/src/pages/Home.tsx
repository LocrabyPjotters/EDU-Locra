import { ArrowRight, BookOpen, UsersRound, ShieldCheck, CheckCircle2, MonitorPlay } from 'lucide-react'
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
