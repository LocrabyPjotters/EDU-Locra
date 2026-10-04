import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  CloudDownload,
  Code2,
  Database,
  GitBranch,
  Gauge,
  KeyRound,
  Layers3,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Play,
  Rocket,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'

const apiBase = (import.meta.env.VITE_LOCRA_API_URL || 'https://api.rowmatch.nl').replace(/\/$/, '')

type Lead = {
  schoolName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  studentCount: string
  notes: string
  requestedTier: string
}



function Meta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} · Locra`
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
  return null
}

function Logo() {
  return (
    <Link to="/" className="logo">
      <span className="logo-mark">l</span>
      <span>ocra</span>
    </Link>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <div className="topbar">
        <div className="shell topbar-inner">
          <span><i className="live-dot" /> Locra 2.0 · Private AI + CodeMatch</span>
          <Link to="/codematch">Bekijk de developer workspace <ArrowRight size={13} /></Link>
        </div>
      </div>

      <header className="header">
        <div className="shell header-inner">
          <Logo />

          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Navigatie openen">
            {menuOpen ? <X /> : <Menu />}
          </button>

          <nav className={`nav ${menuOpen ? 'is-open' : ''}`}>
            <Link to="/platform">Platform</Link>
            <Link to="/codematch">CodeMatch</Link>
            <Link to="/admin">Admin</Link>
            <Link to="/security">Security</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/download">Download</Link>
          </nav>

          <div className="header-actions">
            <Link className="nav-quiet" to="/faq">FAQ</Link>
            <Link className="button button-sm" to="/enroll">Plan een gesprek <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>
    </>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div className="footer-main">
          <Logo />
          <p>Private AI voor organisaties en development teams die zelf de regie willen houden over data, kennis en code.</p>
          <div className="footer-pills">
            <span>Private by design</span>
            <span>On-premise</span>
            <span>Developer ready</span>
          </div>
        </div>

        <div className="footer-col">
          <strong>Product</strong>
          <Link to="/platform">ChatMatch</Link>
          <Link to="/codematch">CodeMatch</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/security">Security</Link>
        </div>
        <div className="footer-col">
          <strong>Starten</strong>
          <Link to="/docs">Documentatie</Link>
          <Link to="/download">Installeren</Link>
          <Link to="/videos">Setupvideo's</Link>
          <Link to="/faq">FAQ</Link>
        </div>
        <div className="footer-col">
          <strong>Contact</strong>
          <Link to="/enroll">Aanvraag</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/changelog">Changelog</Link>
          <a href="mailto:locra@pjotters.nl">locra@pjotters.nl</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Locra</span>
        <span>Private AI · Knowledge · Development</span>
      </div>
    </footer>
  )
}

function Button({
  to = '/enroll',
  secondary = false,
  children,
}: {
  to?: string
  secondary?: boolean
  children: ReactNode
}) {
  return (
    <Link className={`button ${secondary ? 'button-secondary' : ''}`} to={to}>
      {children}<ArrowRight size={17} />
    </Link>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="section-label">{children}</span>
}

function FeatureTile({
  icon: Icon,
  title,
  text,
  to,
}: {
  icon: typeof Sparkles
  title: string
  text: string
  to?: string
}) {
  const content = (
    <>
      <div className="feature-icon"><Icon size={19} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {to && <span className="feature-link">Ontdek <ArrowRight size={14} /></span>}
    </>
  )

  return to ? <Link className="feature-tile" to={to}>{content}</Link> : <article className="feature-tile">{content}</article>
}

function Home() {
  return (
    <>
      <Meta
        title="Private AI. Eigen regie."
        description="Locra brengt lokale AI, kennis, CodeMatch en beheer samen in één private omgeving."
      />

      <section className="hero">
        <div className="hero-grid shell">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> PRIVATE AI PLATFORM</div>
            <h1>AI die bij <em>jullie</em> blijft.</h1>
            <p>
              Locra combineert lokale AI, organisatiekennis, AI-assisted development en beheer
              in één moderne omgeving. Krachtig voor gebruikers. Controleerbaar voor IT.
            </p>
            <div className="hero-actions">
              <Button>Plan een gesprek</Button>
              <Button to="/platform" secondary>Verken het platform</Button>
            </div>
            <div className="hero-proof">
              <span><Check size={14} /> Ollama-ready</span>
              <span><Check size={14} /> Multi-model</span>
              <span><Check size={14} /> RBAC</span>
              <span><Check size={14} /> Single-service</span>
            </div>
          </div>

          <div className="hero-orbit">
            <div className="orbit orbit-1" />
            <div className="orbit orbit-2" />
            <div className="orb orb-center">
              <span className="orb-dot" />
              <strong>locra</strong>
              <small>private intelligence</small>
            </div>
            <div className="orb orb-chat"><MessageSquareText size={17} /><span>ChatMatch</span></div>
            <div className="orb orb-code"><Code2 size={17} /><span>CodeMatch</span></div>
            <div className="orb orb-admin"><Settings2 size={17} /><span>Admin</span></div>
            <div className="orb orb-model"><Server size={17} /><span>Ollama</span></div>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="shell metrics-grid">
          <div><strong>100%</strong><span>eigen infrastructuur</span></div>
          <div><strong>Multi</strong><span>model support</span></div>
          <div><strong>1×</strong><span>service deployment</span></div>
          <div><strong>RBAC</strong><span>rollen & groepen</span></div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionLabel>DE VOLLEDIGE STACK</SectionLabel>
          <div className="section-title-row">
            <div>
              <h2>Drie producten.<br /><em>Één omgeving.</em></h2>
            </div>
            <p>Voor kenniswerk, development en organisatiebeheer — met dezelfde private infrastructuur eronder.</p>
          </div>

          <div className="product-cards">
            <FeatureTile
              icon={MessageSquareText}
              title="ChatMatch"
              text="Lokale AI-chat, multi-model workflows, kennisbanken, smart tags en transparante reasoning."
              to="/platform"
            />
            <FeatureTile
              icon={Code2}
              title="CodeMatch"
              text="GitHub, Monaco, projectcontext, diff previews, Plan Mode en Teach Me Mode in één workspace."
              to="/codematch"
            />
            <FeatureTile
              icon={Settings2}
              title="Admin"
              text="Gebruikers, groepen, RBAC, hardware diagnostics, model tuning en licentiebeheer."
              to="/admin"
            />
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell">
          <SectionLabel>CHATMATCH</SectionLabel>
          <div className="product-showcase">
            <div className="showcase-copy">
              <h2>Praat met AI.<br /><em>Met jullie context.</em></h2>
              <p>
                ChatMatch is gebouwd rond lokale modelverwerking. Wissel van model per taak,
                koppel eigen kennis en maak reasoning zichtbaar wanneer dat relevant is.
              </p>
              <ul className="check-list">
                <li><Check /> Ollama + meerdere lokale modellen</li>
                <li><Check /> Eigen kennisbanken en documenten</li>
                <li><Check /> Auto-titling & smart tags</li>
                <li><Check /> Reasoning via uitklapbare think-blokken</li>
              </ul>
              <Button to="/platform" secondary>Ontdek ChatMatch</Button>
            </div>

            <ChatMock />
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="shell">
          <SectionLabel>CODEMATCH</SectionLabel>
          <div className="product-showcase reverse">
            <div className="code-mock large">
              <div className="mock-top"><span>CodeMatch / workspace</span><span className="mock-status"><i /> github connected</span></div>
              <div className="mock-code-layout">
                <div className="mock-filetree">
                  <small>PROJECT</small>
                  <span>▾ src</span>
                  <span className="indent">▾ auth</span>
                  <span className="indent-2 selected-file">login.ts</span>
                  <span className="indent-2">session.ts</span>
                  <span className="indent">▸ ui</span>
                  <span>▾ tests</span>
                  <span className="indent">auth.spec.ts</span>
                </div>
                <div className="mock-editor">
                  <div className="code-tabs"><span className="active-tab">login.ts</span><span>session.ts</span></div>
                  <pre>{`01  export async function login(req) {\n02    const credentials = parse(req)\n03    const user = await findUser(credentials)\n04\n05  + if (!user) return unauthorized()\n06  + await audit('login', user.id)\n07\n08    return createSession(user)\n09  }`}</pre>
                  <div className="diff-approval">
                    <div><span>AI PATCH</span><strong>2 added · 0 removed</strong></div>
                    <button>Accepteren <Check size={14} /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="showcase-copy">
              <h2>Je codebase.<br /><em>Je AI. Jij beslist.</em></h2>
              <p>
                CodeMatch draait om een veilige ontwikkelflow: begrijpen → plannen → diff bekijken → toepassen.
                De AI schrijft niet zomaar over je project heen.
              </p>
              <ul className="check-list">
                <li><Check /> GitHub private & public repositories</li>
                <li><Check /> Monaco IDE met projecttabs</li>
                <li><Check /> Fix → Preview → Apply</li>
                <li><Check /> Plan Mode + Teach Me Mode</li>
              </ul>
              <Button to="/codematch">Bekijk CodeMatch</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionLabel>ADMIN & GOVERNANCE</SectionLabel>
          <div className="section-title-row">
            <div><h2>Maak private AI <em>beheersbaar.</em></h2></div>
            <p>Van de eerste licentiesleutel tot dagelijkse monitoring: één plek voor alle operationele regie.</p>
          </div>
          <div className="admin-feature-grid">
            <FeatureTile icon={Activity} title="Live dashboard" text="Actieve gebruikers, chats en serverstatus in één overzicht." />
            <FeatureTile icon={Gauge} title="Hardware benchmark" text="Test CPU, geheugen en lokale AI-capaciteit." />
            <FeatureTile icon={UsersRound} title="Users & groups" text="RBAC en groepsrechten voor schaalbare toegang." />
            <FeatureTile icon={Zap} title="Model tuning" text="Stel chat- en achtergrondmodellen afzonderlijk in." />
            <FeatureTile icon={KeyRound} title="Licentiecontrole" text="Validatie en setup wizard voor on-premise installatie." />
            <FeatureTile icon={Rocket} title="Single service" text="Frontend, backend en AI-koppeling op één service." />
          </div>
          <div className="center-action"><Button to="/admin" secondary>Ontdek Admin</Button></div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="shell architecture-section">
          <div>
            <SectionLabel>ARCHITECTUUR</SectionLabel>
            <h2>Een private AI-stack die <em>simpel blijft.</em></h2>
            <p>De gebruikerservaring mag modern zijn. De deployment mag dat ook.</p>
          </div>
          <div className="stack-visual">
            <div className="stack-layer top"><span>01</span><strong>People</strong><small>Teams · Developers · Admins</small></div>
            <div className="stack-arrow">↓</div>
            <div className="stack-layer"><span>02</span><strong>Locra Core</strong><small>Auth · RBAC · Knowledge · Projects</small></div>
            <div className="stack-arrow">↓</div>
            <div className="stack-layer"><span>03</span><strong>Local AI</strong><small>Ollama · Llama · DeepSeek · more</small></div>
            <div className="stack-arrow">↓</div>
            <div className="stack-layer"><span>04</span><strong>Your infrastructure</strong><small>Server · Network · Data</small></div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="shell cta-inner">
          <div>
            <SectionLabel>KLAAR OM TE BEGINNEN?</SectionLabel>
            <h2>Maak private AI <em>werkbaar.</em></h2>
            <p>Bespreek jullie infrastructuur, use-cases en gewenste inrichting.</p>
          </div>
          <div className="hero-actions">
            <Button>Plan een gesprek</Button>
            <Button to="/download" secondary>Bekijk deployment</Button>
          </div>
        </div>
      </section>
    </>
  )
}

function ChatMock() {
  return (
    <div className="chat-mock">
      <div className="mock-top"><span>ChatMatch</span><span className="mock-status"><i /> llama 3 · local</span></div>
      <div className="chat-content">
        <div className="chat-prompt">Analyseer de interne productnotities.</div>
        <div className="chat-response">
          <div className="chat-response-head"><span className="avatar">l</span><span>Locra AI</span><small>14 bronnen</small></div>
          <p>Ik heb de geselecteerde kennisbank gebruikt en de relevante documenten lokaal als context verwerkt.</p>
        </div>
        <div className="reasoning">
          <div><span><BrainCircuit size={14} /> Reasoning</span><ChevronDown size={14} /></div>
          <p>Context geselecteerd · bronnen gekoppeld · antwoord gegenereerd</p>
        </div>
      </div>
      <div className="chat-input"><span>Stel een vraag...</span><ArrowRight size={15} /></div>
    </div>
  )
}

function Platform() {
  return (
    <PageHero
      eyebrow="CHATMATCH"
      title="AI met jullie eigen context."
      intro="Werk met lokale modellen, kennisbanken en transparante reasoning zonder de workflow te verlaten."
      visual={<ChatMock />}
    >
      <FeatureRow
        title="Volledig lokale AI"
        text="Ollama zorgt voor een lokale model-laag. Gebruik verschillende modellen voor verschillende taken."
        icon={Server}
      />
      <FeatureRow
        title="Kennisbanken"
        text="Breng interne documenten en expertise als context naar het gesprek."
        icon={Database}
      />
      <FeatureRow
        title="Smart conversations"
        text="Automatische titels en slimme tags houden chats overzichtelijk."
        icon={Sparkles}
      />
      <FeatureRow
        title="Reasoning zichtbaar"
        text="Maak <think>-blokken van reasoning-modellen inzichtelijk via een uitklapbare UI."
        icon={BrainCircuit}
      />
    </PageHero>
  )
}

function CodeMatch() {
  return (
    <PageHero
      eyebrow="CODEMATCH"
      title="AI die eerst meedenkt."
      intro="Een AI coding workspace met GitHub, Monaco, projectcontext, diff previews en leergerichte workflows."
      visual={<CodeMatchMock />}
      dark
    >
      <FeatureRow title="GitHub integratie" text="Private en public repositories direct openen en doorzoeken." icon={GitBranch} />
      <FeatureRow title="Monaco IDE" text="Werk in de browser met syntax highlighting, tabs en wijzigingen." icon={Code2} />
      <FeatureRow title="Fix → Preview → Apply" text="Bekijk patches als diff voordat je een wijziging toepast." icon={Workflow} />
      <FeatureRow title="Plan Mode" text="Laat de AI eerst een interactief stappenplan maken." icon={Layers3} />
      <FeatureRow title="Teach Me Mode" text="Leer via vragen en begeleiding in plaats van een direct antwoord." icon={BrainCircuit} />
    </PageHero>
  )
}

function CodeMatchMock() {
  return (
    <div className="code-mock">
      <div className="mock-top"><span>CodeMatch / project</span><span className="mock-status"><i /> connected</span></div>
      <div className="code-mock-body">
        <aside>
          <small>FILES</small>
          <span>▾ src</span><span className="indent">▾ auth</span><span className="indent-2 active-file">login.ts</span><span className="indent-2">session.ts</span><span className="indent">▸ ui</span>
        </aside>
        <div className="code-editor">
          <div className="editor-tab">login.ts</div>
          <pre>{`01  async function login(req) {\n02    const user = await findUser(req)\n03\n04  + if (!user) return unauthorized()\n05  + await auditLogin(user.id)\n06\n07    return createSession(user)\n08  }`}</pre>
          <div className="apply-bar"><span>AI PATCH · 2 changes</span><button>Accepteren <Check size={13} /></button></div>
        </div>
      </div>
    </div>
  )
}

function Admin() {
  return (
    <PageHero
      eyebrow="ADMIN CONSOLE"
      title="Eén regielaag voor jullie AI-stack."
      intro="Beheer users, groups, models, diagnostics, licenties en de totale status van jullie Locra-omgeving."
      visual={<AdminMock />}
    >
      <FeatureRow title="Dashboard" text="Actieve gebruikers, requests, modellen en serverstatus." icon={Activity} />
      <FeatureRow title="Hardware benchmarking" text="Meet de lokale capaciteit voordat je workloads schaalt." icon={Gauge} />
      <FeatureRow title="Users & groups" text="RBAC maakt rollen en groepsrechten concreet." icon={UsersRound} />
      <FeatureRow title="AI performance tuning" text="Kies chatmodellen en lichte achtergrondmodellen." icon={Zap} />
      <FeatureRow title="Licentie & setup" text="Eenvoudige activatie voor een on-premise deployment." icon={KeyRound} />
    </PageHero>
  )
}

function AdminMock() {
  return (
    <div className="admin-mock">
      <div className="mock-top"><span>Admin / overview</span><span className="mock-status"><i /> all systems healthy</span></div>
      <div className="admin-mock-inner">
        <div className="admin-stat"><span>Active users</span><strong>124</strong><small>+8 today</small></div>
        <div className="admin-stat"><span>AI requests</span><strong>8.4k</strong><small>24 hours</small></div>
        <div className="admin-stat"><span>Models</span><strong>04</strong><small>local</small></div>
        <div className="admin-stat"><span>CPU</span><strong>38%</strong><small>healthy</small></div>
        <div className="admin-chart"><div className="chart-head"><span>System activity</span><span>live</span></div><div className="chart-lines">{[38, 56, 44, 72, 65, 84, 68, 91, 76, 88].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
        <div className="admin-health"><div><span /><b>Ollama</b><small>online</small></div><div><span /><b>Database</b><small>online</small></div><div><span /><b>API</b><small>online</small></div></div>
      </div>
    </div>
  )
}

function Security() {
  const cards = [
    ['Privacyinstellingen', 'Opslag, retentie, anonimisering, netwerkisolatie en encryptie.', LockKeyhole],
    ['Rollen & rechten', 'Beheerders, medewerkers, gasten en groepen via RBAC.', UsersRound],
    ['Audit & inzicht', 'Gebruik en beheer zichtbaar maken in dashboards en auditinformatie.', Activity],
    ['Kennis & context', 'Kennisbanken per organisatie beheren en gecontroleerd beschikbaar maken.', Database],
  ] as const

  return (
    <Page title="Security is geen bijzaak." intro="Locra is ontworpen rond technische en organisatorische regie." eyebrow="SECURITY & PRIVACY">
      <div className="security-callout">
        <ShieldCheck />
        <div><strong>Privacy-first architectuur</strong><span>De precieze configuratie blijft afhankelijk van jullie infrastructuur en beleid.</span></div>
      </div>
      <div className="grid-four">
        {cards.map(([title, text, Icon]) => <FeatureTile key={title} icon={Icon} title={title} text={text} />)}
      </div>
      <div className="responsibility">
        <div><SectionLabel>VERANTWOORDELIJKHEDEN</SectionLabel><h2>Techniek faciliteert.<br /><em>De organisatie beslist.</em></h2></div>
        <div className="responsibility-grid">
          <article><span>01</span><h3>Locra faciliteert</h3><p>Rollen, limieten, opslag, audit, modellen, kennisbanken en deployment.</p></article>
          <article><span>02</span><h3>De organisatie beslist</h3><p>Doelen, toegestane data, gebruikersbeleid, risicoafweging en incidentprocedures.</p></article>
        </div>
      </div>
    </Page>
  )
}

function Docs() {
  const docs = [
    ['01', 'Installeren', 'Runtime, ZIP, auto-installer en setup wizard.', '/download'],
    ['02', 'ChatMatch', 'Modellen, kennisbanken, tags en reasoning.', '/platform'],
    ['03', 'CodeMatch', 'GitHub, editor, diffs, Plan en Teach Me.', '/codematch'],
    ['04', 'Beheer', 'RBAC, groepen, tuning, diagnostics en licentie.', '/admin'],
  ]

  return (
    <Page title="Documentatie, zonder ruis." intro="Alles wat je nodig hebt om Locra te installeren, configureren en uit te rollen." eyebrow="DOCUMENTATION">
      <div className="docs-grid">
        {docs.map(([n, title, text, to]) => (
          <Link className="doc-card" to={to} key={n}>
            <span>{n}</span>
            <div><h3>{title}</h3><p>{text}</p></div>
            <ArrowRight />
          </Link>
        ))}
      </div>
      <div className="terminal-card">
        <div className="terminal-head"><span><i /> Locra installer</span><small>fast path</small></div>
        <pre><code>curl -fsSL https://edu-locra.pieteroosterling.online/install.sh | bash</code></pre>
        <div className="terminal-lines"><span>✓ runtime check</span><span>✓ database setup</span><span>✓ service start</span></div>
      </div>
    </Page>
  )
}

function Download() {
  const [os, setOs] = useState<'linux' | 'windows'>('linux')
  const [copied, setCopied] = useState(false)
  const linux = 'curl -fsSL https://edu-locra.pieteroosterling.online/install.sh | bash'
  const windows = 'powershell -ExecutionPolicy Bypass -Command "irm https://edu-locra.pieteroosterling.online/install.ps1 | iex"'
  const command = os === 'linux' ? linux : windows

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {}
  }

  return (
    <Page title="Één pakket. Snelle deployment." intro="Kies ZIP voor volledige controle of de installer voor een automatische start." eyebrow="DEPLOYMENT">
      <div className="download-grid">
        <article className="download-option">
          <div className="download-icon"><CloudDownload /></div>
          <SectionLabel>MANUAL</SectionLabel>
          <h2>Complete ZIP</h2>
          <p>Het volledige releasepakket voor custom serveromgevingen.</p>
          <ul className="check-list">
            <li><Check /> Frontend + backend</li>
            <li><Check /> Zelf configureren</li>
            <li><Check /> Volledige controle</li>
          </ul>
          <a className="button button-full" href="/locra-release.zip" download>Download ZIP <CloudDownload size={17} /></a>
        </article>

        <article className="download-option featured-option">
          <div className="download-badge">AANBEVOLEN</div>
          <div className="download-icon"><Rocket /></div>
          <SectionLabel>AUTOMATIC</SectionLabel>
          <h2>Installer script</h2>
          <p>Een commando voor dependencies, database, secrets en service start.</p>
          <div className="os-tabs">
            <button className={os === 'linux' ? 'active' : ''} onClick={() => setOs('linux')}>Linux / macOS</button>
            <button className={os === 'windows' ? 'active' : ''} onClick={() => setOs('windows')}>Windows</button>
          </div>
          <div className="command-box"><code>{command}</code><button onClick={copy}>{copied ? 'Gekopieerd' : 'Kopieer'}</button></div>
          <small>{os === 'linux' ? 'Node.js ≥ 18 · npm · unzip' : 'PowerShell als Administrator · Node.js ≥ 18'}</small>
        </article>
      </div>
      <div className="requirements-box">
        <SectionLabel>SYSTEEMVEREISTEN</SectionLabel>
        <div className="requirements-grid">
          <span><b>OS</b> Linux 22.04+, macOS 13+, Windows WSL2</span>
          <span><b>Runtime</b> Node.js 18+ · npm 9+</span>
          <span><b>AI</b> Ollama · 8 GB RAM min.</span>
          <span><b>Storage</b> 20 GB+ afhankelijk van modellen</span>
        </div>
      </div>
    </Page>
  )
}

function Videos() {
  return (
    <Page title="Setupvideo's." intro="Korte video's voor installatie en eerste configuratie." eyebrow="GUIDES">
      <div className="video-grid">
        {['Locra installeren', 'Eerste organisatie configureren', 'Modellen en kennisbanken beheren'].map((title, index) => (
          <article className="video-card" key={title}>
            <div className="video-thumb"><Play size={28} fill="currentColor" /><span>VIDEO {index + 1}</span></div>
            <SectionLabel>SETUP GUIDE</SectionLabel>
            <h3>{title}</h3><p>Wordt toegevoegd bij de eerste release.</p>
          </article>
        ))}
      </div>
    </Page>
  )
}

function FAQ() {
  const [active, setActive] = useState(0)
  const questions = [
    ['Draait Locra met lokale modellen?', 'Locra is ingericht voor lokaal modelbeheer via Ollama. De implementatie bepaalt waar modellen binnen de eigen infrastructuur draaien.'],
    ['Kan ik eigen documenten gebruiken?', 'Ja. Kennisbanken en documenten kunnen beschikbaar worden gemaakt als AI-context.'],
    ['Kan CodeMatch met private GitHub repos werken?', 'Ja. CodeMatch is ontworpen voor GitHub repository-context, inclusief private repositories wanneer de benodigde autorisatie aanwezig is.'],
    ['Hoe werkt reasoning?', 'Reasoning-modellen kunnen hun think-gedeelte in een uitklapbare weergave tonen, afhankelijk van model en configuratie.'],
  ]

  return (
    <Page title="Veelgestelde vragen." intro="De belangrijkste antwoorden over Locra, deployment en productfuncties." eyebrow="FAQ">
      <div className="faq-list">
        {questions.map(([q, a], index) => (
          <article key={q}>
            <button onClick={() => setActive(active === index ? -1 : index)} aria-expanded={active === index}>
              <span>{q}</span><ChevronDown className={active === index ? 'rotated' : ''} />
            </button>
            {active === index && <p>{a}</p>}
          </article>
        ))}
      </div>
    </Page>
  )
}

function Pricing() {
  return (
    <Page title="Laten we jullie situatie bekijken." intro="Bespreek infrastructuur, use-cases, licentie en onboarding met het Locra-team." eyebrow="AANVRAGEN">
      <div className="contact-panel">
        <div><SectionLabel>PRIVATE AI · CODEMATCH · ADMIN</SectionLabel><h2>Niet weer een losse tool.<br /><em>Een complete omgeving.</em></h2><p>De aanvraag is het startpunt voor een gericht gesprek over jullie technische en organisatorische context.</p><div className="check-grid"><span><Check /> Implementatie</span><span><Check /> Licentie</span><span><Check /> Modelstrategie</span><span><Check /> CodeMatch onboarding</span></div></div>
        <Button>Start zakelijke aanvraag</Button>
      </div>
    </Page>
  )
}

function Contact() {
  return (
    <Page title="Contact." intro="Sparren over private AI, CodeMatch, deployment of licenties?" eyebrow="CONTACT">
      <div className="contact-grid">
        <div className="contact-main"><SectionLabel>LET'S TALK</SectionLabel><h2>Vertel wat jullie<br /><em>willen bouwen.</em></h2><p>Mail ons met jullie context, use-cases en randvoorwaarden.</p><a href="mailto:locra@pjotters.nl" className="button">Mail locra@pjotters.nl <ArrowRight size={17} /></a></div>
        <div className="contact-detail">
          <div><MessageSquareText /><strong>Voor organisaties</strong><span>Private AI & governance</span></div>
          <div><Code2 /><strong>Voor developers</strong><span>CodeMatch & AI-assisted development</span></div>
          <div><Server /><strong>Voor infra teams</strong><span>Deployment & local models</span></div>
        </div>
      </div>
    </Page>
  )
}

function Enroll() {
  const navigate = useNavigate()
  const [form, setForm] = useState<Lead>({
    schoolName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    studentCount: '',
    notes: '',
    requestedTier: 'enterprise',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key: keyof Lead, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/api/locra/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.error || 'De aanvraag kon niet worden verstuurd.')
      navigate('/enroll/success', { state: data })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page title="Start een zakelijke aanvraag." intro="Vertel kort waar jullie mee bezig zijn. We nemen contact op over de beste Locra-inrichting." eyebrow="AANVRAAG">
      <form className="lead-form" onSubmit={submit}>
        <div className="form-intro"><SectionLabel>PRIVATE AI · CODEMATCH</SectionLabel><h2>Jullie context eerst.</h2><p>Daarna bepalen we samen de technische route.</p></div>
        <label>Organisatie<input required value={form.schoolName} onChange={(e) => update('schoolName', e.target.value)} placeholder="Naam van je organisatie" /></label>
        <div className="form-two"><label>Contactpersoon<input required value={form.contactName} onChange={(e) => update('contactName', e.target.value)} /></label><label>Zakelijk e-mailadres<input required type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} /></label></div>
        <div className="form-two"><label>Telefoonnummer <small>optioneel</small><input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} /></label><label>Teamgrootte <small>optioneel</small><input min="1" type="number" value={form.studentCount} onChange={(e) => update('studentCount', e.target.value)} /></label></div>
        <label>Waarmee kunnen we helpen?<textarea rows={6} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Bijvoorbeeld: lokale AI voor een kennisintensief team inclusief CodeMatch." /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button" disabled={loading}>{loading ? 'Versturen…' : 'Aanvraag versturen'} <ArrowRight size={17} /></button>
      </form>
    </Page>
  )
}

function Success() {
  const location = useLocation()
  const data = location.state as { requestId?: string; licenseKey?: string } | null

  return (
    <Page title="Aanvraag ontvangen." intro="Dank je. We hebben jullie aanvraag goed ontvangen." eyebrow="GELUKT">
      <div className="success-panel">
        <div className="success-mark"><Check /></div>
        <SectionLabel>REQUEST RECEIVED</SectionLabel>
        <h2>We nemen contact met je op.</h2>
        {data?.requestId && <p>Referentie: <strong>LOC-{data.requestId.slice(-8).toUpperCase()}</strong></p>}
        {data?.licenseKey && <code className="license-key">{data.licenseKey}</code>}
        <Button to="/">Terug naar Locra</Button>
      </div>
    </Page>
  )
}

function Changelog() {
  const changes = [
    ['1.2', 'CodeMatch 2.0 & Teacher Academy', 'Vernieuwde CodeMatch workspace met GitHub, AI-context en persistente chatgeschiedenis. Tevens Teacher Academy voor docenten en beheerders.'],
    ['1.1', 'Modelbeheer & Ollama', 'Ondersteuning voor lokaal modelbeheer en modeltoewijzing per groep.'],
    ['1.0', 'Release: Private AI voor organisaties', 'Kennisbank, RBAC, Chat-opsplitsing en audit logging.'],
    ['0.9', 'Beta testfase', 'Pilotfase gericht op stabiliteit en deployment.'],
  ]

  return (
    <Page title="Changelog." intro="Productupdates voor de Locra zakelijke omgeving." eyebrow="UPDATES">
      <div className="changelog">
        {changes.map(([version, title, text]) => <article key={version}><span>v{version}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </Page>
  )
}

function FeatureRow({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return (
    <article className="feature-row">
      <div className="feature-icon"><Icon size={18} /></div>
      <div><h3>{title}</h3><p>{text}</p></div>
    </article>
  )
}

function PageHero({
  eyebrow,
  title,
  intro,
  visual,
  children,
  dark = false,
}: {
  eyebrow: string
  title: string
  intro: string
  visual: ReactNode
  children: ReactNode
  dark?: boolean
}) {
  return (
    <>
      <section className={`subhero ${dark ? 'subhero-dark' : ''}`}>
        <div className="shell subhero-grid">
          <div className="subhero-copy">
            <SectionLabel>{eyebrow}</SectionLabel>
            <h1>{title}</h1>
            <p>{intro}</p>
            <div className="hero-actions"><Button>Plan een gesprek</Button><Button to="/docs" secondary>Bekijk docs</Button></div>
          </div>
          <div className="subhero-visual">{visual}</div>
        </div>
      </section>
      <section className="section">
        <div className="shell feature-rows">{children}</div>
      </section>
    </>
  )
}

function Page({
  title,
  intro,
  eyebrow,
  children,
}: {
  title: string
  intro: string
  eyebrow: string
  children: ReactNode
}) {
  return (
    <>
      <Meta title={title} description={intro} />
      <section className="page-title">
        <div className="shell"><SectionLabel>{eyebrow}</SectionLabel><h1>{title}</h1><p>{intro}</p></div>
      </section>
      <section className="section page-body"><div className="shell">{children}</div></section>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/codematch" element={<CodeMatch />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/security" element={<Security />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/download" element={<Download />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/enroll" element={<Enroll />} />
            <Route path="/enroll/success" element={<Success />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
