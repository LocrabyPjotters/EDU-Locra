import { CheckCircle2, Bot, BookOpen, Layers, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Features() {
  return (
    <div className="page-content" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="overline">Platform Features</span>
          <h1 style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>Eén platform voor de hele school.</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Ontdek hoe Locra EDU docenten, leerlingen en beheerders verbindt in één veilige AI-omgeving.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {[
            { icon: <Bot size={32}/>, color: 'var(--brand-blue)', title: 'AI-Modellen', desc: 'Ondersteuning voor meerdere aanbieders. De school bepaalt welke modellen beschikbaar zijn.' },
            { icon: <BookOpen size={32}/>, color: 'var(--brand-yellow)', title: 'Les maken en geven', desc: 'Genereer lesmateriaal, quizzen en gebruik de Teacherbot voor klassikale begeleiding.' },
            { icon: <Users size={32}/>, color: 'var(--brand-orange)', title: 'Leren & Feedback', desc: 'Socratische feedback voor leerlingen. We geven niet het antwoord, maar helpen met denken.' },
            { icon: <Layers size={32}/>, color: 'var(--brand-navy)', title: 'Documenten & RAG', desc: 'Koppel schoolkennis via bestanden en gebruik sjablonen voor schoolbreed beleid.' },
            { icon: <ShieldCheck size={32}/>, color: 'var(--brand-blue)', title: 'Beheer & Organisatie', desc: 'Centraal beheer van gebruikers, permissies en auditlogs voor de IT-afdeling.' }
          ].map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '2rem', transition: 'transform 0.2s' }}>
              <div style={{ color: f.color, marginBottom: '1.5rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '5rem', background: 'var(--bg-secondary)', padding: '4rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <h2>Zien hoe het werkt in de praktijk?</h2>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link to="/onlinedemo" className="btn btn-primary btn-lg">Demo Aanvragen</Link>
            <Link to="/aanmelden" className="btn btn-secondary btn-lg">Start een Pilot</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
