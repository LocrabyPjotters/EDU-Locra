import { Shield, Lock } from 'lucide-react'

export default function Security() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Security & Compliance</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Enterprise-grade beveiliging.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Jouw data, jouw modellen. Volledig geïsoleerd van publieke AI-diensten.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
             <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Geen data naar buiten.</h2>
             <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
               Onze architectuur zorgt ervoor dat jouw bedrijfsdata nooit gebruikt wordt om publieke modellen te trainen. Zelfs in de cloud draaien we single-tenant.
             </p>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '3rem' }}>
             <Shield color="var(--brand-blue)" size={48} style={{ marginBottom: '1rem' }} />
             <h3>ISO 27001 gereed</h3>
             <p style={{ color: 'var(--text-secondary)' }}>Alle processen en infrastructuur zijn ingericht om naadloos in jullie security compliance te passen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
