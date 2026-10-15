import { Link } from 'react-router-dom'
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
