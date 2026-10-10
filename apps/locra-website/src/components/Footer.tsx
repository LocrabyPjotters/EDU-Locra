import { Link } from 'react-router-dom'
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
