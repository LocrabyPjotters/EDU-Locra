import { useState, useEffect } from 'react'
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
