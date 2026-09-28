import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Building2, Check, ChevronDown, CloudDownload, Database, LockKeyhole, Menu, Play, Server, Sparkles, Users, X } from 'lucide-react'
import './App.css'

const apiBase = (import.meta.env.VITE_LOCRA_API_URL || 'https://api.rowmatch.nl').replace(/\/$/, '')
type Lead = { schoolName: string; contactName: string; contactEmail: string; contactPhone: string; studentCount: string; notes: string; requestedTier: string }
const nav = [['/', 'Home'], ['/platform', 'Platform'], ['/security', 'Veiligheid'], ['/docs', 'Documentatie'], ['/download', 'Downloaden'], ['/changelog', 'Changelog'], ['/pricing', 'Aanvragen']]

function Meta({ title, description }: { title: string; description: string }) {
  useEffect(() => { document.title = `${title} · Locra`; const tag = document.querySelector('meta[name="description"]'); if (tag) tag.setAttribute('content', description) }, [title, description])
  return null
}
function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <><header><Link className="brand" to="/"><span>l</span>ocra</Link><button className="menu" aria-label="Menu openen" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button><nav className={open ? 'open' : ''}>{nav.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}<Link className="button small" to="/enroll" onClick={() => setOpen(false)}>Plan een gesprek <ArrowRight size={15}/></Link></nav></header><main>{children}</main><footer><div><Link className="brand" to="/"><span>l</span>ocra</Link><p>Private AI-infrastructuur voor organisaties die grip willen houden op kennis en data.</p></div><div><strong>Ontdek</strong><Link to="/platform">Platform</Link><Link to="/security">Veiligheid</Link><Link to="/docs">Documentatie</Link></div><div><strong>Starten</strong><Link to="/download">Installeren</Link><Link to="/videos">Setupvideo’s</Link><Link to="/faq">Veelgestelde vragen</Link><Link to="/contact">Contact</Link><Link to="/enroll">Aanvraag starten</Link></div></footer></>
}
const Button = ({ children, to = '/enroll', secondary = false }: { children: React.ReactNode; to?: string; secondary?: boolean }) => <Link className={`button ${secondary ? 'secondary' : ''}`} to={to}>{children}<ArrowRight size={18}/></Link>
function Home() { return <><Meta title="Private AI, in eigen regie" description="Locra brengt lokale AI, kennis en beheer samen in één private omgeving."/><section className="hero"><div className="eyebrow"><Sparkles size={15}/> Private AI-infrastructuur</div><h1>AI die bij <em>jouw organisatie</em> blijft.</h1><p>Locra maakt krachtige AI bruikbaar zonder de controle over data, kennis of werkwijze uit handen te geven.</p><div className="actions"><Button>Plan een gesprek</Button><Button to="/platform" secondary>Verken het platform</Button></div><div className="trust"><span><Check/> Lokaal modelbeheer</span><span><Check/> Eigen kennisbanken</span><span><Check/> Rollen & audit</span></div></section><section className="signal"><div><span className="overline">Één omgeving</span><h2>Van vraag naar betrouwbaar werk, zonder losse AI-tools.</h2><p className="quiet">Locra is geen losse chatbot. Het is een beheerde laag tussen je mensen, modellen en organisatiekennis.</p></div><div className="signal-grid">{[[Server,'Lokale modellen','Kies en beheer modellen via een eigen Ollama-omgeving.'],[Database,'Kennis als context','Maak documenten en interne expertise vindbaar met RAG.'],[LockKeyhole,'Beheerbare toegang','Werk met rollen, instellingen en auditlogs.']].map(([Icon,title,text]) => { const I = Icon as typeof Server; return <article key={title as string}><I/><h3>{title as string}</h3><p>{text as string}</p></article>})}</div></section><section className="why"><div><span className="overline">Waarom Locra?</span><h2>AI wordt pas waardevol wanneer kennis, toegang en verantwoordelijkheid samenkomen.</h2><p>Standaard AI-tools geven snel antwoord, maar sluiten zelden aan op je eigen bronnen, rollen of afspraken. Locra biedt een controleerbare omgeving om daar bewust mee te werken.</p></div><div className="why-grid"><article><span>01</span><h3>Infrastructuur in eigen regie</h3><p>Werk met lokaal beheerde modellen en bepaal zelf welke omgeving en capaciteit bij de organisatie passen.</p></article><article><span>02</span><h3>Context die je vertrouwt</h3><p>Kennisbanken brengen relevante documenten dichter bij het gesprek, zodat teams met eigen context kunnen werken.</p></article><article><span>03</span><h3>Governance die meegroeit</h3><p>Organisaties, groepen, rollen, quota, instellingen en auditinformatie geven beheer een praktische plek.</p></article><article><span>04</span><h3>Van experiment naar werkwijze</h3><p>Maak AI inzetbaar voor teams met duidelijke kaders, niet alleen voor losse individuele experimenten.</p></article></div></section><section className="split"><div><span className="overline">Voor organisaties</span><h2>Een fundament dat past bij jouw manier van werken.</h2><p>Voor teams die AI veilig willen inzetten voor kenniswerk, ondersteuning en samenwerking — met de organisatie aan het stuur. Maak de inrichting passend bij je mensen, data en beleid.</p><Button to="/platform">Bekijk mogelijkheden</Button></div><div className="terminal"><div><i/> Locra omgeving <b>● actief</b></div><p><span>01</span> Modelleer toegangsregels</p><p><span>02</span> Verbind kennisbronnen</p><p><span>03</span> Start veilig samenwerken</p></div></section><section className="journey"><div><span className="overline">Van oriëntatie naar gebruik</span><h2>Maak van AI een bewuste organisatiekeuze.</h2></div><ol><li><b>01</b><div><h3>Verken de context</h3><p>Breng teambehoeften, kennisbronnen, risico’s en doelstellingen samen.</p></div></li><li><b>02</b><div><h3>Richt zorgvuldig in</h3><p>Configureer modellen, toegang, opslag en de functies die bij de organisatie passen.</p></div></li><li><b>03</b><div><h3>Werk en verbeter</h3><p>Laat teams verantwoord starten en ontwikkel afspraken verder op basis van de praktijk.</p></div></li></ol></section><section className="cta"><span className="overline">Klaar om te verkennen?</span><h2>Ontdek wat private AI voor jouw organisatie kan betekenen.</h2><Button>Start een aanvraag</Button></section></> }
function Platform() { const cards = [[Users,'Werk voor mensen','Een heldere chatomgeving met delen, feedback en samenwerkfuncties.'],[Database,'Werk met kennis','Beheer kennisbanken en documenten als betrouwbare context voor AI.'],[Building2,'Werk op schaal','Organisaties, groepen, rollen en eigen branding onder één beheerlaag.'],[Server,'Werk met modellen','Installeer, activeer en beoordeel lokale modellen vanuit beheer.']]; return <Page title="Een platform voor AI onder eigen regie" intro="Locra verbindt lokale modellen, kennis en governance in één omgeving."><div className="card-grid">{cards.map(([Icon,title,text]) => { const I=Icon as typeof Users; return <article className="feature" key={title as string}><I/><h3>{title as string}</h3><p>{text as string}</p></article>})}</div><section className="split compact"><div><h2>Van beheer naar gebruik</h2><p>Beheerders stellen grenzen en mogelijkheden in. Teams gebruiken een omgeving die aansluit op hun eigen kennis en werkpraktijk.</p></div><ol><li>Installeer Locra in de gewenste omgeving.</li><li>Configureer organisatie, toegang en modellen.</li><li>Activeer kennisbanken en start met je team.</li></ol></section></Page> }
function Security() { return <Page title="Veiligheid is geen laag achteraf" intro="Locra is ontworpen voor organisaties die controle willen houden over hun AI-omgeving."><div className="security-intro"><span className="overline">Regie als uitgangspunt</span><h2>Veilige AI vraagt om technische én organisatorische keuzes.</h2><p>Locra brengt instellingen samen waarmee een organisatie zelf grenzen kan aanbrengen in toegang, opslag, modellen en gebruik. Zo wordt governance onderdeel van de omgeving, niet een document ernaast.</p></div><div className="card-grid"><article className="feature"><LockKeyhole/><h3>Privacyinstellingen</h3><p>Configureer opslag, retentie, anonimisering, netwerkisolatie en versleutelingsinstellingen per organisatie.</p></article><article className="feature"><Users/><h3>Rollen & rechten</h3><p>Beheer toegang voor beheerders, medewerkers, gasten en groepen; bepaal wie welke mogelijkheden heeft.</p></article><article className="feature"><BookOpen/><h3>Audit & inzicht</h3><p>Gebruik auditlogging en beheerdashboards om het gebruik te volgen en afspraken bespreekbaar te houden.</p></article><article className="feature"><Database/><h3>Kennis met context</h3><p>Beheer kennisbanken per organisatie en houd zicht op de documenten die als AI-context beschikbaar zijn.</p></article></div><section className="privacy-layers"><h2>Een gedeelde verantwoordelijkheid</h2><div><article><strong>Locra faciliteert</strong><p>Instellingen voor beveiliging, rollen, limieten, opslag, audit, modellen en kennisbanken.</p></article><article><strong>De organisatie beslist</strong><p>Het doel van de verwerking, toegestane gegevens, gebruikersbeleid, modelkeuze, risicoanalyse en incidentprocedure.</p></article></div></section><section className="notice"><strong>Belangrijk</strong><p>De precieze privacy- en beveiligingsconfiguratie blijft een verantwoordelijkheid van de organisatie. Locra biedt de instellingen om die keuzes concreet te maken.</p></section></Page> }
function Docs() { return <Page title="Documentatie voor een goede start" intro="Alles wat je nodig hebt om Locra verantwoord in te richten en te gebruiken."><div className="docs">{[['01','Voorbereiden','Kies de omgeving, netwerktoegang en verantwoordelijke beheerder.'],['02','Installeren','Installeer de Locra-server en client; activeer daarna de webgebaseerde setupwizard.'],['03','Configureren','Voeg licentie, organisatie, gebruikers, modellen en basisinstellingen toe.'],['04','In gebruik nemen','Maak kennisbanken aan en introduceer Locra gecontroleerd bij je team.']].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div><Button to="/download">Naar installatie-overzicht</Button></Page> }
function Download() {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [os, setOs] = useState<'linux'|'windows'>('linux');
  const linuxCmd = 'curl -fsSL https://edu-locra.pieteroosterling.online/install.sh | bash';
  const winCmd = 'powershell -ExecutionPolicy Bypass -Command "irm https://edu-locra.pieteroosterling.online/install.ps1 | iex"';
  const autoInstallCmd = os === 'linux' ? linuxCmd : winCmd;
  const copyCmd = () => { navigator.clipboard.writeText(autoInstallCmd); setCopiedCmd(true); setTimeout(() => setCopiedCmd(false), 2500); };
  return <Page title="Downloaden & installeren" intro="Kies de installatiemethode die bij jullie infrastructuur past. Beide opties bevatten de volledige Locra server, client en CLI.">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
      <article style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CloudDownload size={28} style={{ flexShrink: 0 }} />
          <div><h2 style={{ margin: 0 }}>Handmatig (.zip)</h2><p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.9rem' }}>Download en richt zelf in</p></div>
        </div>
        <p>Download het complete releasepakket. Je pakt het zelf uit en volgt de stap-voor-stap installatiegids hieronder.</p>
        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
          <li>Volledige controle over elke stap</li>
          <li>Geschikt voor custom serveromgevingen</li>
          <li>Inclusief alle bronbestanden</li>
        </ul>
        <a href="/locra-release.zip" download style={{ marginTop: 'auto', background: '#57706a', border: 0, color: '#d9e6e0', borderRadius: '6px', padding: '0.8rem 1.25rem', whiteSpace: 'nowrap', textDecoration: 'none', fontWeight: 600, display: 'inline-block', textAlign: 'center' }}>
          ⬇ Download locra-release.zip
        </a>
      </article>

      <article style={{ border: '2px solid #5b7a6a', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
        <span style={{ position: 'absolute', top: '-1px', right: '1.5rem', background: '#5b7a6a', color: '#d9e6e0', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.75rem', borderRadius: '0 0 6px 6px', letterSpacing: '0.05em' }}>AANBEVOLEN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Server size={28} style={{ flexShrink: 0 }} />
          <div><h2 style={{ margin: 0 }}>Auto-Installer (script)</h2><p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.9rem' }}>Volledig automatisch installeren</p></div>
        </div>
        <p>Eén commando installeert alles: Node-pakketten, database, JWT-secrets en start de services op via PM2 met autostart.</p>
        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
          <li>Controleert Node.js versie automatisch</li>
          <li>Genereert veilige JWT-secrets</li>
          <li>Migreert de database direct</li>
          <li>Start alles via PM2 (met autostart bij herstart)</li>
        </ul>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setOs('linux')} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: 0, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: os === 'linux' ? '#5b7a6a' : 'rgba(255,255,255,0.1)', color: '#d9e6e0' }}>🐧 Linux / macOS</button>
          <button onClick={() => setOs('windows')} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: 0, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: os === 'windows' ? '#5b7a6a' : 'rgba(255,255,255,0.1)', color: '#d9e6e0' }}>🪟 Windows (PowerShell)</button>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <code style={{ wordBreak: 'break-all' }}>{autoInstallCmd}</code>
          <button onClick={copyCmd} style={{ background: '#5b7a6a', border: 0, color: '#d9e6e0', borderRadius: '6px', padding: '0.4rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
            {copiedCmd ? '✓ Gekopieerd' : 'Kopieer'}
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>{os === 'linux' ? 'Vereisten: Linux/macOS, Node.js ≥ 18, npm, unzip' : '⚠️ Voer dit commando uit in cmd.exe of PowerShell als Administrator. Node.js ≥ 18 vereist.'}</p>
      </article>
    </div>

    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Handleiding: Handmatige installatie (.zip)</h2>
      <div className="docs">
        {[
          ['01','Vereisten controleren','Zorg voor Node.js v18 of nieuwer, npm en unzip. Controleer met: node --version && npm --version. Installeer ook PM2 globaal: npm install -g pm2'],
          ['02','Uitpakken','Pak locra-release.zip uit: unzip locra-release.zip -d locra. Navigeer naar de map: cd locra'],
          ['03','Backend instellen','Ga naar de servermap: cd server && npm install. Maak een .env bestand aan met: PORT=4000, JWT_SECRET=<willekeurige-string>, DATABASE_URL=file:./data/locra.db. Voer daarna uit: npx prisma db push'],
          ['04','Frontend bouwen','Ga naar de clientmap: cd ../client && npm install && npm run build. De gebouwde bestanden staan in client/dist.'],
          ['05','Services starten','Start de API: pm2 start server/src/index.js --name locra-api. Start de client: pm2 serve client/dist 8080 --name locra-client --spa. Sla op: pm2 save && pm2 startup'],
          ['06','Setup Wizard voltooien','Open http://localhost:8080 in je browser. Voltooi de Setup Wizard met je Locra-licentiesleutel om de omgeving te activeren.'],
        ].map(([n,t,d]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}
      </div>
    </section>

    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Problemen oplossen & Beheer</h2>
      <div className="docs" style={{ display: 'block' }}>
        <article style={{ marginBottom: '1rem' }}>
          <h3>Server Herstarten (Windows)</h3>
          <p>Als je je terminal per ongeluk hebt gesloten of de server wilt herstarten, open dan een nieuwe Command Prompt (of PowerShell), navigeer naar de geïnstalleerde map en typ:</p>
          <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', overflowX: 'auto', marginTop: '0.5rem' }}>
            cd C:\Pad\Naar\Je\Installatie\locra-release<br/>
            pm2 delete all<br/>
            pm2 start server/dist/index.js --name "locra-api" --interpreter node
          </pre>
        </article>
      </div>
    </section>

    <div className="requirements">
      <h2>Systeemvereisten</h2>
      <ul>
        <li><strong>OS:</strong> Linux (Ubuntu 22.04+ aanbevolen), macOS 13+ of Windows met WSL2</li>
        <li><strong>Runtime:</strong> Node.js v18 of hoger, npm v9+</li>
        <li><strong>AI-modellen:</strong> Ollama geïnstalleerd, met minimaal 8 GB RAM (16 GB aanbevolen voor grotere modellen)</li>
        <li><strong>Opslag:</strong> Minimaal 20 GB vrij (afhankelijk van modelgrootte)</li>
        <li><strong>Licentie:</strong> Een Locra-licentiesleutel voor activatie in de Setup Wizard</li>
      </ul>
    </div>
  </Page>
}
function Videos() { return <Page title="Setupvideo’s" intro="Binnenkort begeleiden korte video’s je door installatie, eerste configuratie en beheer."><div className="video-grid">{['Locra installeren','Eerste organisatie configureren','Modellen en kennisbanken beheren'].map((t,i)=><article key={t}><div className="video"><Play fill="currentColor"/><span>Video {i+1}</span></div><h3>{t}</h3><p>Deze setupvideo wordt toegevoegd bij de eerste release.</p></article>)}</div></Page> }
function Pricing() { return <Page title="Een traject dat past bij je organisatie" intro="Locra wordt ingericht op jouw situatie, infrastructuur en ambities."><div className="quote"><h2>Zakelijk, overzichtelijk en op maat.</h2><p>Vertel ons over je organisatie. We bespreken samen de geschikte inrichting, licentie en implementatiestappen.</p><Button>Vraag een gesprek aan</Button></div></Page> }
function FAQ() { const [active,setActive]=useState<number|null>(0); const qs=[['Draait Locra met lokale modellen?','Locra is ingericht voor lokaal modelbeheer via Ollama. De gekozen inrichting bepaalt hoe en waar de modellen draaien.'],['Kan ik eigen documenten gebruiken?','Ja. Beheerders kunnen kennisbanken en documenten beheren voor gebruik als AI-context.'],['Hoe begin ik?','Vraag een gesprek aan, bereid de omgeving voor en volg na licentieactivatie de setupwizard.']]; return <Page title="Veelgestelde vragen" intro="Antwoorden over Locra, implementatie en beheer."><div className="faq">{qs.map(([q,a],i)=><article key={q}><button onClick={()=>setActive(active===i?null:i)} aria-expanded={active===i}>{q}<ChevronDown/></button>{active===i&&<p>{a}</p>}</article>)}</div></Page> }
function Contact(){return <Page title="Neem contact op" intro="Wil je sparren over een private AI-omgeving, implementatie of licenties? We horen graag van je."><div className="quote"><h2>Een goed gesprek begint met jouw context.</h2><p>Vertel ons wat je wilt bereiken en welke randvoorwaarden voor jullie belangrijk zijn.</p><a className="button" href="mailto:locra@pjotters.nl">Mail locra@pjotters.nl <ArrowRight size={18}/></a></div></Page>}
function Enroll() { const nav=useNavigate(); const [form,setForm]=useState<Lead>({schoolName:'',contactName:'',contactEmail:'',contactPhone:'',studentCount:'',notes:'',requestedTier:'enterprise'}); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const r=await fetch(`${apiBase}/api/locra/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await r.json().catch(()=>({}));if(!r.ok||!data.success)throw new Error(data.error||'De aanvraag kon niet worden verstuurd.');nav('/enroll/success',{state:data})}catch(e){setError(e instanceof Error?e.message:'Er ging iets mis.')}finally{setLoading(false)}} const change=(key:keyof Lead)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm({...form,[key]:e.target.value});return <Page title="Start een zakelijke aanvraag" intro="Vertel kort waar je organisatie mee bezig is. We nemen contact op over de beste Locra-inrichting."><form className="form" onSubmit={submit}><label>Organisatie<input required value={form.schoolName} onChange={change('schoolName')} placeholder="Naam van je organisatie"/></label><div className="two"><label>Contactpersoon<input required value={form.contactName} onChange={change('contactName')} placeholder="Voor- en achternaam"/></label><label>Zakelijk e-mailadres<input required type="email" value={form.contactEmail} onChange={change('contactEmail')} placeholder="naam@organisatie.nl"/></label></div><div className="two"><label>Telefoonnummer <small>optioneel</small><input value={form.contactPhone} onChange={change('contactPhone')}/></label><label>Teamgrootte <small>optioneel</small><input min="1" type="number" value={form.studentCount} onChange={change('studentCount')} placeholder="Bijv. 120"/></label></div><label>Waarmee kunnen we helpen?<textarea value={form.notes} onChange={change('notes')} placeholder="Bijvoorbeeld: lokale AI voor een kennisintensief team." rows={5}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="button" disabled={loading}>{loading?'Aanvraag versturen…':'Aanvraag versturen'}<ArrowRight size={18}/></button></form></Page> }
function Success(){const l=useLocation();const d=l.state as {requestId?:string;licenseKey?:string}|null;return <Page title="Aanvraag ontvangen" intro="Dank je. We hebben je aanvraag goed ontvangen."><div className="success"><Check/><h2>We nemen contact met je op.</h2>{d?.requestId&&<p>Referentie: <strong>LOC-{d.requestId.slice(-8).toUpperCase()}</strong></p>}{d?.licenseKey&&<p className="key">{d.licenseKey}</p>}<Button to="/">Terug naar Locra</Button></div></Page>}
function Changelog(){return <Page title="Changelog" intro="Nieuwe functionaliteiten en updates voor de Locra zakelijke omgeving."><div className="docs">{[['1.2','CodeMatch 2.0 & Teacher Academy','Introductie van de vernieuwde CodeMatch omgeving met volledige GitHub mappenstructuur, AI context selectie en persistente chatgeschiedenis. Tevens is de nieuwe Teacher Academy gelanceerd met exclusieve toegang voor docenten en beheerders.'],['1.1','Modellenbeheer & Ollama integratie','Volledige ondersteuning voor lokaal modelbeheer. Beheerders kunnen nu direct vanuit de interface nieuwe modellen downloaden en toewijzen aan specifieke gebruikersgroepen.'],['1.0','Release: Private AI voor Organisaties','Eerste versie van Locra gelanceerd. Inclusief Documentatie kennisbank (RAG), Role-based access control, Chat-opsplitsing en Audit Logging.'],['0.9','Beta Testfase','Succesvolle pilot met 5 geselecteerde organisaties. Focus op stabiliteit en het stroomlijnen van het uitrollen van de infrastructuur.']].map(([v,t,d])=><article key={v}><span>Versie {v}</span><h3>{t}</h3><p>{d}</p></article>)}</div></Page>}
function Page({title,intro,children}:{title:string;intro:string;children:React.ReactNode}){return <><Meta title={title} description={intro}/><section className="page-head"><span className="overline">Locra</span><h1>{title}</h1><p>{intro}</p></section><section className="page-content">{children}</section></>}
function App(){return <BrowserRouter><Layout><Routes><Route path="/" element={<Home/>}/><Route path="/platform" element={<Platform/>}/><Route path="/security" element={<Security/>}/><Route path="/docs" element={<Docs/>}/><Route path="/download" element={<Download/>}/><Route path="/videos" element={<Videos/>}/><Route path="/pricing" element={<Pricing/>}/><Route path="/changelog" element={<Changelog/>}/><Route path="/faq" element={<FAQ/>}/><Route path="/contact" element={<Contact/>}/><Route path="/enroll" element={<Enroll/>}/><Route path="/enroll/success" element={<Success/>}/><Route path="*" element={<Home/>}/></Routes></Layout></BrowserRouter>}
export default App
