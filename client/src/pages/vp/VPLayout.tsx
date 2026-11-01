import React from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Shield,
  AlertTriangle,
  MessageSquare,
  PhoneCall,
  LogOut,
  ArrowLeft,
  Lock,
  UserCheck
} from 'lucide-react';

export default function VPLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Role check: Only confidant, admin, superadmin
  const isAuthorized = user && ['confidant', 'admin', 'superadmin'].includes(user.role);

  if (!user || !isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#f8fafc', padding: '1.5rem' }}>
        <div style={{ maxWidth: '460px', width: '100%', background: '#1e293b', borderRadius: '18px', padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <Shield size={48} color="#f87171" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', margin: '0 0 0.5rem' }}>Toegang Beperkt</h2>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6 }}>
            De <strong>/vp</strong> interface is uitsluitend toegankelijk voor gecertificeerde Vertrouwenspersonen en zorgcoördinatoren.
          </p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '1.25rem', padding: '0.7rem 1.4rem', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
            Naar Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#090d16', color: '#f8fafc', fontFamily: 'inherit' }}>
      {/* Top Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Left: Branding & Role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/chat')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              fontSize: '0.78rem'
            }}
          >
            <ArrowLeft size={14} />
            <span>Naar Chat</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #eab308, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 900
            }}>
              <Shield size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>Locra</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.5px'
                }}>
                  VERTROUWENSPERSOON
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Nav links */}
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <NavLink
            to="/vp"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              background: isActive ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
              color: isActive ? '#fbbf24' : '#94a3b8',
              border: isActive ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent'
            })}
          >
            <AlertTriangle size={15} />
            <span>Zorgsignalen</span>
          </NavLink>

          <NavLink
            to="/vp/chats"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              background: isActive ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
              color: isActive ? '#fbbf24' : '#94a3b8',
              border: isActive ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent'
            })}
          >
            <MessageSquare size={15} />
            <span>Gesprekken</span>
          </NavLink>

          <NavLink
            to="/vp/protocol"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              background: isActive ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
              color: isActive ? '#fbbf24' : '#94a3b8',
              border: isActive ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent'
            })}
          >
            <PhoneCall size={15} />
            <span>Hulplijnen &amp; Protocol</span>
          </NavLink>
        </nav>

        {/* Right: User meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
              {user.displayName || user.username}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
              Vertrouwenspersoon
            </span>
          </div>

          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #eab308, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            fontWeight: 800,
            fontSize: '0.85rem'
          }}>
            {(user.displayName || user.username).charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1280px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
    </div>
  );
}
