import os

base = '/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu-static'
os.makedirs(base, exist_ok=True)

css = r"""@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap');
:root{--bg:#fff;--bg2:#f8fafc;--txt:#0f172a;--txt2:#475569;--blue:#2563eb;--blue-h:#1d4ed8;--navy:#1e3a8a;--yellow:#facc15;--orange:#f97316;--border:#e2e8f0;--r:12px;--rl:24px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--txt);line-height:1.7;padding-top:80px}
h1,h2,h3,h4{font-family:'Poppins',sans-serif;color:var(--navy);line-height:1.2}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
.overline{display:inline-block;color:var(--blue);font-weight:700;font-size:.85rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem}

/* Layout */
.container{max-width:1200px;margin:0 auto;padding:4rem 2rem}
.container.narrow{max-width:800px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:3rem}
.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2rem}
.grid-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2rem}
.text-center{text-align:center}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;border:none;font-family:'Inter',sans-serif;transition:all .2s}
.btn-lg{padding:1rem 2rem;font-size:1.1rem}
.btn-primary{background:var(--blue);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.25)}
.btn-primary:hover{background:var(--blue-h);transform:translateY(-2px)}
.btn-secondary{background:#fff;color:var(--navy);border:2px solid var(--border)}
.btn-secondary:hover{border-color:var(--navy);background:var(--bg2)}
.btn-outline{background:transparent;color:var(--blue);border:2px solid var(--blue)}
.btn-outline:hover{background:var(--blue);color:#fff}

/* Header */
header{position:fixed;top:0;left:0;right:0;height:80px;background:#fff;border-bottom:1px solid var(--border);z-index:1000;display:flex;align-items:center}
.hdr{max-width:1200px;width:100%;margin:0 auto;padding:0 2rem;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:1.5rem;font-weight:700;color:var(--navy);font-family:'Poppins',sans-serif}
.brand b{color:var(--blue)}
nav{display:flex;gap:1.5rem;align-items:center}
nav a{font-weight:600;color:var(--txt2);transition:color .2s;font-size:.95rem}
nav a:hover{color:var(--blue)}
nav .cta{background:var(--blue);color:#fff !important;padding:.5rem 1.25rem;border-radius:8px;font-size:.9rem}
nav .cta:hover{background:var(--blue-h)}

/* Footer */
footer{background:var(--navy);color:#fff;padding:5rem 2rem 3rem}
.ft{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:3rem}
.ft h4{margin-bottom:1.5rem;font-size:1rem;color:var(--yellow)}
.ft a{display:block;color:rgba(255,255,255,.7);margin-bottom:.7rem;font-size:.95rem}
.ft a:hover{color:#fff}
.ft .brand{color:#fff;margin-bottom:1rem}
.ft p{color:rgba(255,255,255,.6);font-size:.9rem;line-height:1.6}
.ft-bottom{max-width:1200px;margin:0 auto;padding-top:2rem;margin-top:2rem;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;color:rgba(255,255,255,.4);font-size:.85rem}

/* Cards */
.card{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:2.5rem;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 15px 30px rgba(0,0,0,.06)}
.card h3{margin-bottom:1rem;font-size:1.2rem}
.card p{color:var(--txt2)}
.card-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;font-size:1.5rem}
.card-icon.blue{background:rgba(37,99,235,.1);color:var(--blue)}
.card-icon.orange{background:rgba(249,115,22,.1);color:var(--orange)}
.card-icon.yellow{background:rgba(250,204,21,.2);color:#b45309}
.card-icon.navy{background:rgba(30,58,138,.1);color:var(--navy)}
.card-link{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-weight:600;margin-top:1rem}
.card-link:hover{text-decoration:underline}

/* Sections */
.section{padding:5rem 2rem}
.section.alt{background:var(--bg2)}
.section.dark{background:var(--navy);color:#fff}
.section.dark h2,.section.dark h3{color:#fff}
.section.dark p{color:rgba(255,255,255,.75)}
.section-hdr{text-align:center;max-width:700px;margin:0 auto 4rem}
.section-hdr h2{font-size:2.5rem;margin-bottom:1rem}
.section-hdr p{color:var(--txt2);font-size:1.15rem}

/* Hero */
.hero{padding:6rem 2rem;text-align:center}
.hero h1{font-size:clamp(2.5rem,5vw,3.8rem);margin-bottom:1.5rem;letter-spacing:-.02em}
.hero p.lead{font-size:1.25rem;color:var(--txt2);max-width:700px;margin:0 auto 3rem}
.hero .actions{display:flex;justify-content:center;gap:1rem;margin-bottom:2.5rem;flex-wrap:wrap}
.hero .trust{display:flex;justify-content:center;gap:2rem;font-weight:600;color:var(--navy);flex-wrap:wrap}

/* Demo Chat */
.chat-box{max-width:500px;background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:2rem;box-shadow:0 20px 40px rgba(0,0,0,.06)}
.chat-chips{display:flex;gap:8px;margin-bottom:1.5rem;flex-wrap:wrap}
.chat-chip{padding:6px 14px;border-radius:50px;font-size:.85rem;font-weight:600;border:1px solid var(--border);background:var(--bg2);cursor:pointer;color:var(--txt2)}
.chat-chip.active{background:rgba(37,99,235,.1);border-color:var(--blue);color:var(--blue)}
.bubble{padding:1rem;border-radius:12px;margin-bottom:1rem;font-size:.95rem;line-height:1.5}
.bubble.user{background:var(--bg2);text-align:right;border-bottom-right-radius:4px}
.bubble.ai{background:rgba(37,99,235,.05);border:1px solid rgba(37,99,235,.1);color:var(--navy);font-weight:500;border-bottom-left-radius:4px}

/* Steps */
.step-num{display:inline-flex;width:40px;height:40px;border-radius:10px;background:rgba(37,99,235,.1);color:var(--blue);font-weight:800;font-size:1.1rem;align-items:center;justify-content:center;margin-bottom:1rem}

/* Terminal */
.terminal{background:#0f172a;border-radius:8px;padding:1rem 1.5rem;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:.85rem;overflow-x:auto;margin:.75rem 0;line-height:1.8}
.terminal code{color:#e2e8f0}
.terminal .comment{color:#64748b}

/* Pricing */
.plan{display:flex;flex-direction:column;background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:2.5rem;position:relative}
.plan.featured{border-color:var(--blue);box-shadow:0 20px 40px rgba(37,99,235,.12)}
.plan .badge{position:absolute;top:0;left:50%;transform:translate(-50%,-50%);background:var(--blue);color:#fff;padding:4px 16px;border-radius:50px;font-size:.8rem;font-weight:700;white-space:nowrap}
.plan h2{font-size:1.6rem;margin-bottom:.5rem}
.plan .price{font-size:2.8rem;font-weight:800;color:var(--navy);margin:1rem 0 1.5rem}
.plan .price small{font-size:1rem;color:var(--txt2);font-weight:400}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:.8rem;margin-bottom:2rem;flex-grow:1}
.plan li{display:flex;align-items:center;gap:8px;font-size:.95rem}
.plan li::before{content:'✓';color:var(--blue);font-weight:700}

/* FAQ */
.faq-item{border:1px solid var(--border);border-radius:var(--r);margin-bottom:1rem;overflow:hidden}
.faq-q{width:100%;background:#fff;border:none;padding:1.25rem 1.5rem;text-align:left;font-size:1.05rem;font-weight:600;color:var(--navy);cursor:pointer;font-family:'Inter',sans-serif;display:flex;justify-content:space-between;align-items:center}
.faq-q:hover{background:var(--bg2)}
.faq-a{padding:0 1.5rem 1.25rem;color:var(--txt2);line-height:1.7}

/* Responsive */
@media(max-width:768px){
  .grid-2{grid-template-columns:1fr}
  .ft{grid-template-columns:1fr 1fr}
  nav{display:none}
  .hero h1{font-size:2.2rem}
}
"""

def hdr():
    return """<header>
  <div class="hdr">
    <a href="index.html" class="brand">locra <b>EDU</b></a>
    <nav>
      <a href="features.html">Platform</a>
      <a href="academy.html">Academy</a>
      <a href="veiligheid.html">Veiligheid</a>
      <a href="prijzen.html">Prijzen</a>
      <a href="docs.html">Documentatie</a>
      <a href="download.html">Download</a>
      <a href="changelog.html">Changelog</a>
      <a href="faq.html">FAQ</a>
      <a href="aanmelden.html" class="cta">Licentie aanvragen →</a>
    </nav>
  </div>
</header>"""

def ftr():
    return """<footer>
  <div class="ft">
    <div>
      <div class="brand">locra <b>EDU</b></div>
      <p>Didactische AI die school, docent en leerling helpt verantwoord vooruit te komen. Een product van Pjotters.</p>
      <p style="margin-top:1rem;font-size:.85rem">locra@pjotters.nl</p>
    </div>
    <div>
      <h4>Platform</h4>
      <a href="features.html">Functionaliteiten</a>
      <a href="academy.html">Locra Academy</a>
      <a href="veiligheid.html">Privacy & veiligheid</a>
      <a href="changelog.html">Changelog</a>
    </div>
    <div>
      <h4>Starten</h4>
      <a href="docs.html">Installatie</a>
      <a href="download.html">Downloaden</a>
      <a href="prijzen.html">Prijzen</a>
      <a href="aanmelden.html">Licentie aanvragen</a>
    </div>
    <div>
      <h4>Hulp</h4>
      <a href="faq.html">Veelgestelde vragen</a>
      <a href="videos.html">Setupvideo's</a>
      <a href="contact.html">Contact</a>
    </div>
  </div>
  <div class="ft-bottom">
    <span>© 2026 Locra EDU · Pjotters</span>
    <span>Gemaakt in Nederland 🇳🇱</span>
  </div>
</footer>"""

def page(title, body):
    return f"""<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{title} · Locra EDU – Didactische AI voor het onderwijs">
  <title>{title} · Locra EDU</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
{hdr()}
<main>
{body}
</main>
{ftr()}
</body>
</html>"""

# ── INDEX ──
index = page("AI die leren sterker maakt", """
<section class="hero">
  <span class="overline">✦ Ontworpen voor onderwijs</span>
  <h1>AI die leerlingen laat <span style="color:var(--blue)">denken.</span></h1>
  <p class="lead">Locra EDU brengt veilige AI, didactiek en schoolkennis samen. Voor leerprocessen waarin de docent de regie houdt en de leerling blijft leren.</p>
  <div class="actions">
    <a href="aanmelden.html" class="btn btn-primary btn-lg">Vraag een licentie aan →</a>
    <a href="academy.html" class="btn btn-secondary btn-lg">Ontdek de Academy</a>
  </div>
  <div class="trust">
    <span>✓ Voor docent & leerling</span>
    <span>✓ Eigen schoolomgeving</span>
    <span>✓ AI-geletterdheid</span>
    <span>✓ Lokaal of in de cloud</span>
  </div>
</section>

<section class="section alt">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center">
    <div>
      <span class="overline">Probeer het gedachtegoed</span>
      <h2 style="font-size:2.5rem;margin-bottom:1.5rem">Niet het antwoord geven.<br>Wel het denken verder helpen.</h2>
      <p style="color:var(--txt2);font-size:1.1rem;margin-bottom:1.5rem">Met socratische begeleiding helpt Locra leerlingen stap voor stap zonder het leerproces over te nemen. Zo blijft AI een hulpmiddel voor begrip, niet een snelweg langs het leren.</p>
      <p style="color:var(--txt2);opacity:.75">De docent bepaalt de context en de opdracht; de leerling houdt verantwoordelijkheid voor het eigen werk.</p>
    </div>
    <div class="chat-box">
      <div class="chat-chips">
        <span class="chat-chip active">Socratisch leren</span>
        <span class="chat-chip">SOMtoday</span>
        <span class="chat-chip">Academy</span>
        <span class="chat-chip">Watermerk</span>
      </div>
      <div class="bubble user">Ik snap Pythagoras niet.</div>
      <div class="bubble ai">Laten we samen kijken: welke zijden vormen de rechte hoek? Als die 3 en 4 zijn, wat is dan 3² + 4²?</div>
      <div style="font-size:.8rem;color:var(--blue);font-weight:600;text-align:center;margin-top:.5rem">● Didactische begeleiding actief</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-hdr">
    <span class="overline">Waarom Locra EDU?</span>
    <h2>Geen algemene chatbot naast de les, maar een onderwijsomgeving eromheen.</h2>
    <p>Generieke AI-tools zijn niet ontworpen rond klas, leerdoel, schoolbeleid of docentbegeleiding. Locra EDU brengt deze lagen bewust samen.</p>
  </div>
  <div class="grid-4" style="max-width:1200px;margin:0 auto">
    <div class="card">
      <div class="card-icon blue">🎓</div>
      <h3>Didactiek voorop</h3>
      <p>Socratische begeleiding en duidelijke AI-regels geven ruimte aan oefenen, redeneren en reflecteren.</p>
    </div>
    <div class="card">
      <div class="card-icon navy">🏫</div>
      <h3>De school houdt regie</h3>
      <p>Rollen, instellingen, modellen, opslag en toegestane functies worden beheerd vanuit één organisatieomgeving.</p>
    </div>
    <div class="card">
      <div class="card-icon orange">📚</div>
      <h3>AI-geletterdheid</h3>
      <p>De Academy maakt betrouwbaarheid, prompting, bias en deepfakes onderdeel van het leerproces.</p>
    </div>
    <div class="card">
      <div class="card-icon yellow">📋</div>
      <h3>Beleid → praktijk</h3>
      <p>Klassen, opdrachten en beheerfuncties geven schoolafspraken een praktische plek in de tool.</p>
    </div>
  </div>
</section>

<section class="section dark">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center">
    <div>
      <span class="overline" style="color:var(--yellow)">Locra Academy</span>
      <h2 style="font-size:2.5rem;margin-bottom:1.5rem">Van AI gebruiken naar AI begrijpen.</h2>
      <p>De Academy helpt leerlingen kritisch, creatief en verantwoordelijk met AI te werken. Niet als losse workshop, maar als oefenroute in het leerlingportaal.</p>
      <a href="academy.html" class="btn btn-outline" style="margin-top:2rem;border-color:#fff;color:#fff">Bekijk de leerlijn →</a>
    </div>
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div style="background:rgba(255,255,255,.08);padding:1.25rem;border-radius:8px;display:flex;gap:1rem;align-items:center"><b style="color:var(--yellow);font-size:1.3rem;min-width:32px">01</b><div><strong>AI basis</strong><br><span style="opacity:.7;font-size:.9rem">Wat kan AI wel en niet?</span></div></div>
      <div style="background:rgba(255,255,255,.08);padding:1.25rem;border-radius:8px;display:flex;gap:1rem;align-items:center"><b style="color:var(--yellow);font-size:1.3rem;min-width:32px">02</b><div><strong>Slim prompten</strong><br><span style="opacity:.7;font-size:.9rem">Werken met het CLEAR-framework</span></div></div>
      <div style="background:rgba(255,255,255,.08);padding:1.25rem;border-radius:8px;display:flex;gap:1rem;align-items:center"><b style="color:var(--yellow);font-size:1.3rem;min-width:32px">03</b><div><strong>Kritisch controleren</strong><br><span style="opacity:.7;font-size:.9rem">Bronnen, bias en betrouwbaarheid</span></div></div>
      <div style="background:rgba(255,255,255,.08);padding:1.25rem;border-radius:8px;display:flex;gap:1rem;align-items:center"><b style="color:var(--yellow);font-size:1.3rem;min-width:32px">04</b><div><strong>Verantwoord handelen</strong><br><span style="opacity:.7;font-size:.9rem">Ethiek, deepfakes en digitale weerbaarheid</span></div></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-hdr">
    <span class="overline">Zo landt Locra op school</span>
    <h2>Een start die past bij beleid én klaslokaal.</h2>
  </div>
  <div class="grid-3" style="max-width:1000px;margin:0 auto">
    <div class="card" style="text-align:center">
      <div class="step-num" style="margin:0 auto 1rem">01</div>
      <h3>Maak keuzes</h3>
      <p>Leg doelen, afspraken en verantwoordelijkheden vast met schoolleiding, ICT en onderwijsprofessionals.</p>
    </div>
    <div class="card" style="text-align:center">
      <div class="step-num" style="margin:0 auto 1rem">02</div>
      <h3>Richt veilig in</h3>
      <p>Configureer de organisatie, toegang, modellen, opslag en gewenste onderwijsfuncties.</p>
    </div>
    <div class="card" style="text-align:center">
      <div class="step-num" style="margin:0 auto 1rem">03</div>
      <h3>Start begeleid</h3>
      <p>Activeer docenten, klassen, opdrachten en de Academy in een tempo dat bij de school past.</p>
    </div>
  </div>
</section>

<section class="section alt" style="text-align:center">
  <span class="overline">Klaar voor de volgende stap?</span>
  <h2 style="font-size:2.5rem;margin-bottom:2rem">Maak AI een verantwoord onderdeel van jullie onderwijs.</h2>
  <a href="aanmelden.html" class="btn btn-primary btn-lg">Start met Locra EDU →</a>
</section>
""")

# ── FEATURES ──
features = page("Eén AI-omgeving voor de hele school", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">Platform Features</span>
    <h2>Eén AI-omgeving voor de hele school.</h2>
    <p>Locra EDU geeft scholen een omgeving waarin didactiek, privacy en beheer samenkomen. Alles is ontworpen rond de onderwijspraktijk.</p>
  </div>
  <div class="grid-3" style="max-width:1200px;margin:0 auto 4rem">
    <div class="card"><div class="card-icon blue">👥</div><h3>Voor elke rol</h3><p>Eigen routes en mogelijkheden voor leerling, docent en beheerder. Iedereen ziet wat nodig is om goed te kunnen werken.</p></div>
    <div class="card"><div class="card-icon navy">📚</div><h3>Kennis in context</h3><p>Gebruik schooldocumenten en lesmateriaal in beheerde kennisbanken. De AI antwoordt op basis van jullie eigen bronnen.</p></div>
    <div class="card"><div class="card-icon orange">📋</div><h3>Opdrachten & klassen</h3><p>Docenten organiseren klassen, opdrachten en terugkoppeling. Leerlingen leveren in en krijgen socratische feedback.</p></div>
    <div class="card"><div class="card-icon yellow">🔍</div><h3>Inzicht & controle</h3><p>Beheer gebruikers, instellingen, modellen en auditinformatie vanuit het centrale admin-paneel.</p></div>
    <div class="card"><div class="card-icon blue">🤖</div><h3>Meerdere AI-modellen</h3><p>Ondersteuning voor Ollama (lokaal), OpenAI, Anthropic en Google. De school bepaalt welke modellen beschikbaar zijn per rol.</p></div>
    <div class="card"><div class="card-icon navy">📎</div><h3>SOMtoday-koppeling</h3><p>Koppel roosters, klassen en cijfers via de SOMtoday-integratie. Beschikbaar als optie bij EDU Campus en Enterprise.</p></div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:1200px;margin:0 auto">
    <div class="section-hdr">
      <span class="overline">Drie perspectieven, één omgeving</span>
      <h2>Iedereen ziet wat nodig is.</h2>
    </div>
    <div class="grid-3">
      <div class="card" style="border-left:4px solid var(--blue)">
        <h3 style="color:var(--blue)">👤 Leerling</h3>
        <p>Werkt met een persoonlijke AI-omgeving, opdrachten en Academy-modules. Leert vragen stellen, controleren en reflecteren. Geen directe antwoorden, maar begeleiding.</p>
        <ul style="margin-top:1rem;padding-left:1.5rem;color:var(--txt2)"><li>Persoonlijke chatomgeving</li><li>Opdrachten ontvangen en inleveren</li><li>Academy-modules doorlopen</li><li>Eigen kennisbank raadplegen</li></ul>
      </div>
      <div class="card" style="border-left:4px solid var(--orange)">
        <h3 style="color:var(--orange)">👨‍🏫 Docent</h3>
        <p>Maakt klassen en opdrachten aan, formuleert AI-regels, volgt inzendingen en geeft feedback vanuit de onderwijspraktijk.</p>
        <ul style="margin-top:1rem;padding-left:1.5rem;color:var(--txt2)"><li>Klassen en groepen beheren</li><li>Opdrachten met lesmateriaal (PDF)</li><li>Inzendingen beoordelen (Rubric UI)</li><li>Teacherbot voor klassikale begeleiding</li></ul>
      </div>
      <div class="card" style="border-left:4px solid var(--navy)">
        <h3 style="color:var(--navy)">⚙️ Beheerder</h3>
        <p>Beheert accounts, groepen, modellen, kennisbanken, instellingen, licenties en auditinformatie op organisatieniveau.</p>
        <ul style="margin-top:1rem;padding-left:1.5rem;color:var(--txt2)"><li>Gebruikers en rollen configureren</li><li>AI-modellen aan- en uitzetten</li><li>Quota en limieten instellen</li><li>Audit- en gebruiksrapportages</li></ul>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center">
    <div>
      <h2 style="font-size:2.2rem;margin-bottom:1.5rem">Gebouwd rond de onderwijspraktijk</h2>
      <p style="color:var(--txt2);font-size:1.1rem;margin-bottom:2rem">Van een veilige leerlingvraag tot een docentopdracht en beheer op bestuursniveau: Locra maakt de route helder. Functies als Somtoday, watermerkdetectie en kennisbanken worden per organisatie en licentie bewust geconfigureerd.</p>
      <ol style="padding-left:1.5rem;color:var(--txt2);display:flex;flex-direction:column;gap:1rem;font-size:1.05rem">
        <li><strong>Beheerder</strong> richt organisatie, gebruikers en modellen in.</li>
        <li><strong>Docent</strong> werkt met klassen, opdrachten en begeleiding.</li>
        <li><strong>Leerling</strong> oefent, reflecteert en leert AI kritisch gebruiken.</li>
      </ol>
    </div>
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div style="background:var(--bg2);padding:1.5rem;border-radius:8px;border-left:4px solid var(--blue)"><strong>Watermerkdetectie</strong><br><span style="color:var(--txt2)">Helpt docenten signaleren of tekst mogelijk met AI gegenereerd is — altijd als onderdeel van een zorgvuldig gesprek.</span></div>
      <div style="background:var(--bg2);padding:1.5rem;border-radius:8px;border-left:4px solid var(--orange)"><strong>Kennisbanken</strong><br><span style="color:var(--txt2)">Upload documenten die de AI als context gebruikt. Per organisatie beheerd met RAG-technologie.</span></div>
      <div style="background:var(--bg2);padding:1.5rem;border-radius:8px;border-left:4px solid var(--yellow)"><strong>Docentendashboard</strong><br><span style="color:var(--txt2)">Overzicht van klassen, opdrachten, inzendingen en beoordelingen in één scherm.</span></div>
    </div>
  </div>
</section>

<section class="section alt" style="text-align:center">
  <h2 style="font-size:2.2rem;margin-bottom:2rem">Klaar om het in de praktijk te zien?</h2>
  <a href="aanmelden.html" class="btn btn-primary btn-lg">Plan een demo →</a>
</section>
""")

# ── ACADEMY ──
academy = page("Locra Academy", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">Locra Academy</span>
    <h2>Van AI gebruiken naar AI begrijpen.</h2>
    <p>Een interactieve leerlijn voor AI-geletterdheid, van basiskennis tot kritisch en verantwoordelijk gebruik. Geïntegreerd in het leerlingportaal.</p>
  </div>
  <div class="grid-2" style="max-width:1100px;margin:0 auto 4rem">
    <div class="card"><div class="step-num">01</div><h3>Wat is AI?</h3><p>Begrijp hoe taalmodellen werken, waarom ze kunnen hallucineren en wat het verschil is tussen generatieve AI en traditionele software. Leerlingen ontdekken de mogelijkheden én beperkingen aan de hand van interactieve oefeningen.</p></div>
    <div class="card"><div class="step-num">02</div><h3>Slim prompten</h3><p>Formuleer heldere opdrachten met het CLEAR-framework: Context, Lengte, Examples, Actief werkwoord en Rol. Leerlingen oefenen met het schrijven van effectieve prompts voor verschillende vakken en situaties.</p></div>
    <div class="card"><div class="step-num">03</div><h3>Kritisch controleren</h3><p>Controleer bronnen, argumenten en AI-antwoorden. Leerlingen leren fact-checking technieken, herkennen logische drogredenen en leren onderscheid maken tussen betrouwbare en onbetrouwbare informatie.</p></div>
    <div class="card"><div class="step-num">04</div><h3>Ethiek & media</h3><p>Herken bias, deepfakes en de maatschappelijke impact van AI. Leerlingen onderzoeken ethische dilemma's, digitale weerbaarheid en de rol van AI in nieuws en sociale media.</p></div>
  </div>
</section>

<section class="section dark" style="text-align:center">
  <h2 style="font-size:2.5rem;margin-bottom:1.5rem">Leren omgaan met AI is een vaardigheid.</h2>
  <p style="max-width:650px;margin:0 auto 2rem;font-size:1.15rem">De Academy sluit aan op het bestaande leerlingportaal, waar modules, quizzen en opdrachten beschikbaar zijn. Docenten kunnen de voortgang per leerling volgen.</p>
  <a href="aanmelden.html" class="btn btn-primary btn-lg" style="background:#fff;color:var(--navy)">Probeer het op je school →</a>
</section>

<section class="section">
  <div style="max-width:1100px;margin:0 auto">
    <h2 style="font-size:2rem;margin-bottom:2rem;text-align:center">Hoe werkt de Academy in de praktijk?</h2>
    <div class="grid-3">
      <div class="card" style="text-align:center"><div class="card-icon blue" style="margin:0 auto 1rem">📖</div><h3>Interactieve modules</h3><p>Leerlingen doorlopen modules met uitleg, voorbeelden en oefenvragen. Geen droge theorie maar hands-on leren.</p></div>
      <div class="card" style="text-align:center"><div class="card-icon orange" style="margin:0 auto 1rem">📝</div><h3>Quizzen & reflectie</h3><p>Na elke module een korte quiz om begrip te toetsen. Reflectievragen stimuleren kritisch nadenken over AI-gebruik.</p></div>
      <div class="card" style="text-align:center"><div class="card-icon navy" style="margin:0 auto 1rem">📊</div><h3>Voortgang volgen</h3><p>Docenten zien welke modules een leerling heeft afgerond en waar extra aandacht nodig is.</p></div>
    </div>
  </div>
</section>
""")

# ── VEILIGHEID ──
veiligheid = page("Veilig en verantwoord", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">Privacy is een ontwerpkeuze</span>
    <h2>Een veilige AI-inzet begint niet bij een vinkje, maar bij regie.</h2>
    <p>Scholen verwerken gevoelige informatie en dragen verantwoordelijkheid voor leerlingen. Daarom is het belangrijk om vooraf doel, toegang, opslag, begeleiding en evaluatie te organiseren.</p>
  </div>
  <div class="grid-2" style="max-width:1200px;margin:0 auto 4rem">
    <div class="card"><div class="card-icon blue">🔒</div><h3>Data & opslag</h3><p>Organisaties kunnen keuzes beheren rond chatopslag, retentie, anonimisering, versleuteling en netwerkisolatie. Chatgeschiedenis wordt bewaard zolang de school dat wil — verwijderd is ook echt verwijderd.</p></div>
    <div class="card"><div class="card-icon orange">🛡️</div><h3>School in regie</h3><p>Beheerders bepalen rollen, rechten, toegestane functies, limieten en de manier waarop gebruikers worden aangemaakt. Geen onverwachte functies zonder toestemming.</p></div>
    <div class="card"><div class="card-icon navy">📚</div><h3>Kennis onder beheer</h3><p>Kennisbanken en documenten worden per organisatie beheerd, zodat context niet in losse publieke chats verdwijnt. Data verlaat de schoolomgeving niet.</p></div>
    <div class="card"><div class="card-icon yellow">📋</div><h3>Didactische grenzen</h3><p>De Academy, opdrachten en docentbegeleiding ondersteunen kritisch denken en expliciete schoolafspraken. AI geeft geen directe antwoorden maar stimuleert nadenken.</p></div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:start">
    <div>
      <h2 style="font-size:2.2rem;margin-bottom:1.5rem">Wat Locra faciliteert — en wat de school zelf beslist</h2>
      <p style="color:var(--txt2);font-size:1.05rem">Locra biedt de technische gereedschappen waarmee scholen AI verantwoord kunnen inzetten. Maar de school bepaalt het beleid.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:1.5rem">
      <div style="background:#fff;padding:2rem;border-radius:var(--r);border-left:4px solid var(--blue)">
        <strong style="font-size:1.1rem;display:block;margin-bottom:.5rem">Locra faciliteert</strong>
        <p style="color:var(--txt2)">Instellingen voor opslag en retentie, rollen en rechten, auditlogging, modelbeheer, kennisbanken, quota, watermerkdetectie en onderwijsfuncties zoals opdrachten en klassen.</p>
      </div>
      <div style="background:#fff;padding:2rem;border-radius:var(--r);border-left:4px solid var(--orange)">
        <strong style="font-size:1.1rem;display:block;margin-bottom:.5rem">De school beslist</strong>
        <p style="color:var(--txt2)">Welke gegevens mogen worden gebruikt, welke grondslag en afspraken gelden, wie toegang krijgt, welke modellen passend zijn, hoe incidenten worden afgehandeld en welke verwerkersovereenkomsten van toepassing zijn.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div style="max-width:900px;margin:0 auto">
    <h2 style="text-align:center;margin-bottom:2rem">Technische privacy-maatregelen</h2>
    <div class="grid-2">
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r)"><strong>🏠 Lokale hosting</strong><p style="color:var(--txt2);margin-top:.5rem">Draai Locra op eigen hardware. Data verlaat het schoolnetwerk niet.</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r)"><strong>🔐 JWT-authenticatie</strong><p style="color:var(--txt2);margin-top:.5rem">Unieke, per-installatie gegenereerde JWT-secrets voor sessiebeveiliging.</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r)"><strong>👤 Anonieme AI-sessies</strong><p style="color:var(--txt2);margin-top:.5rem">Leerlinggegevens worden niet doorgestuurd naar AI-modellen of externe diensten.</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r)"><strong>📊 Auditlogging</strong><p style="color:var(--txt2);margin-top:.5rem">Beheerders zien wie wat doet. Alle acties worden vastgelegd voor verantwoording.</p></div>
    </div>
  </div>
</section>

<section class="section alt" style="text-align:center">
  <div style="max-width:800px;margin:0 auto;padding:2.5rem;border:1px solid var(--border);border-radius:var(--rl);background:#fff">
    <h3 style="margin-bottom:1rem">Onderwijs en wetgeving</h3>
    <p style="color:var(--txt2);margin-bottom:1.5rem">Kennisnet adviseert scholen eerst AI-gebruik in kaart te brengen en schoolafspraken te maken. Bij inzet van AI gelden de AVG en de Europese AI-verordening. Locra helpt met technische regie, maar vervangt geen privacybeleid, DPIA of juridisch advies.</p>
    <a href="https://www.kennisnet.nl/artificial-intelligence/handreiking-ai-in-het-onderwijs/" target="_blank" class="btn btn-secondary">Lees de Kennisnet-handreiking →</a>
  </div>
</section>
""")

# ── PRIJZEN ──
prijzen = page("EDU-licenties", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">EDU-licenties</span>
    <h2>Begin klein of richt Locra EDU direct schoolbreed in.</h2>
    <p>Kies wat past bij jullie ambities. Wij werken niet per gebruiker, maar met heldere schoollicenties per jaar.</p>
  </div>
  <div class="grid-4" style="max-width:1200px;margin:0 auto 4rem">
    <div class="plan">
      <span class="overline">EDU licentie</span>
      <h2>EDU Basic</h2>
      <div class="price">€0 <small>/ jaar</small></div>
      <p style="color:var(--txt2);margin-bottom:1.5rem">Start veilig met lokale AI en de basis voor verantwoord gebruik.</p>
      <ul>
        <li>Onbeperkt gebruikers</li>
        <li>Lokale AI-modellen (Ollama)</li>
        <li>Socratische chatbegeleiding</li>
        <li>1 kennisbank</li>
        <li>Basis admin-paneel</li>
      </ul>
      <a href="aanmelden.html?tier=edu-basic" class="btn btn-secondary" style="width:100%">Kies EDU Basic</a>
    </div>
    <div class="plan">
      <span class="overline">EDU licentie</span>
      <h2>EDU Plus</h2>
      <div class="price">€100 <small>/ jaar</small></div>
      <p style="color:var(--txt2);margin-bottom:1.5rem">Voor scholen die meer kennisbanken en watermerkdetectie willen.</p>
      <ul>
        <li>Alles van EDU Basic</li>
        <li>Watermerkdetectie</li>
        <li>5 kennisbanken</li>
        <li>Cloud AI-modellen (optioneel)</li>
        <li>Uitgebreidere rapportages</li>
      </ul>
      <a href="aanmelden.html?tier=edu-plus" class="btn btn-secondary" style="width:100%">Kies EDU Plus</a>
    </div>
    <div class="plan featured">
      <span class="badge">MEEST GEKOZEN</span>
      <span class="overline">EDU licentie</span>
      <h2>EDU Campus</h2>
      <div class="price">€250 <small>/ jaar</small></div>
      <p style="color:var(--txt2);margin-bottom:1.5rem">De complete onderwijsomgeving met Academy en geavanceerde mogelijkheden.</p>
      <ul>
        <li>Alles van EDU Plus</li>
        <li>Locra Academy (volledige leerlijn)</li>
        <li>Onbeperkte kennisbanken</li>
        <li>Opdrachten, klassen & Rubric UI</li>
        <li>SOMtoday-koppeling (optioneel)</li>
        <li>Priority support</li>
      </ul>
      <a href="aanmelden.html?tier=edu-campus" class="btn btn-primary" style="width:100%">Kies EDU Campus</a>
    </div>
    <div class="plan">
      <span class="overline">EDU licentie</span>
      <h2>Enterprise</h2>
      <div class="price">Op maat</div>
      <p style="color:var(--txt2);margin-bottom:1.5rem">Voor besturen en onderwijsorganisaties met eigen wensen.</p>
      <ul>
        <li>Alles van EDU Campus</li>
        <li>Multi-school beheer</li>
        <li>Eigen SAML/OIDC integratie</li>
        <li>Dedicated support & SLA</li>
        <li>Custom deployment</li>
      </ul>
      <a href="aanmelden.html?tier=enterprise" class="btn btn-secondary" style="width:100%">Bespreek wensen</a>
    </div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:900px;margin:0 auto">
    <h2 style="text-align:center;margin-bottom:2rem">Veelgestelde vragen over prijzen</h2>
    <div class="faq-item"><div class="faq-q">Zijn er kosten per gebruiker?</div><div class="faq-a">Nee. Alle EDU-licenties zijn per school, niet per gebruiker. Of je nu 50 of 1500 leerlingen hebt, de prijs blijft gelijk.</div></div>
    <div class="faq-item"><div class="faq-q">Zijn er extra kosten voor AI-modellen?</div><div class="faq-a">Lokale modellen via Ollama zijn gratis. Cloud-modellen (OpenAI, Anthropic) vereisen een eigen API-key van de school. Locra brengt geen opslag in rekening.</div></div>
    <div class="faq-item"><div class="faq-q">Wat kost de SOMtoday-koppeling?</div><div class="faq-a">De SOMtoday-integratie is beschikbaar bij EDU Campus en Enterprise. Configuratie is inbegrepen in de licentie.</div></div>
    <div class="faq-item"><div class="faq-q">Is er een proefperiode?</div><div class="faq-a">EDU Basic is permanent gratis. Voor EDU Plus en Campus kun je een pilot aanvragen via het aanmeldformulier.</div></div>
  </div>
</section>
""")

# ── DOWNLOAD ──
download = page("Downloaden & installeren", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">Installatie</span>
    <h2>Downloaden & installeren</h2>
    <p>Kies de installatiemethode voor Locra EDU. Beide opties bevatten de volledige server, client en CLI — klaar voor gebruik op school.</p>
  </div>

  <div class="grid-2" style="max-width:1200px;margin:0 auto 4rem">
    <div class="card" style="display:flex;flex-direction:column">
      <div class="card-icon blue">📦</div>
      <h3 style="font-size:1.5rem;margin-bottom:.5rem">Handmatig (.zip)</h3>
      <span style="color:var(--txt2);margin-bottom:1.5rem">Download en richt zelf in</span>
      <p style="color:var(--txt2);margin-bottom:1.5rem">Download het complete EDU-releasepakket. Pak het zelf uit en volg de stap-voor-stap gids hieronder. Geschikt voor scholen met een eigen ICT-beheerder.</p>
      <ul style="color:var(--navy);font-weight:500;margin-bottom:2rem;padding-left:1.5rem;display:flex;flex-direction:column;gap:.5rem">
        <li>Volledige controle over configuratie</li>
        <li>Geschikt voor afgeschermde schoolnetwerken</li>
        <li>Inclusief alle bronbestanden</li>
      </ul>
      <a href="/locra-release.zip" class="btn btn-secondary" style="margin-top:auto;width:100%">⬇ Download locra-edu-release.zip</a>
    </div>

    <div class="card" style="display:flex;flex-direction:column;border-color:var(--blue);box-shadow:0 10px 30px rgba(37,99,235,.1);position:relative">
      <span style="position:absolute;top:0;right:1.5rem;transform:translateY(-50%);background:var(--blue);color:#fff;padding:4px 12px;border-radius:50px;font-size:.8rem;font-weight:700">AANBEVOLEN</span>
      <div class="card-icon orange">⚡</div>
      <h3 style="font-size:1.5rem;margin-bottom:.5rem">Auto-Installer (script)</h3>
      <span style="color:var(--txt2);margin-bottom:1.5rem">Volledig automatisch installeren</span>
      <p style="color:var(--txt2);margin-bottom:1.5rem">Eén commando doet alles: pakketten installeren, database aanmaken, JWT-secrets genereren en Locra EDU live zetten via PM2 met autostart.</p>
      <ul style="color:var(--navy);font-weight:500;margin-bottom:2rem;padding-left:1.5rem;display:flex;flex-direction:column;gap:.5rem">
        <li>Controleert Node.js versie automatisch</li>
        <li>Genereert veilige, unieke JWT-secrets</li>
        <li>Migreert de schooldatabase direct</li>
        <li>Start via PM2 — ook na herstart van de server</li>
      </ul>
      <h4 style="margin-bottom:.5rem">🐧 Linux / macOS</h4>
      <div class="terminal">curl -fsSL https://edu-locra.pieteroosterling.online/install-edu.sh | bash</div>
      <h4 style="margin-bottom:.5rem;margin-top:1rem">🪟 Windows (PowerShell als Admin)</h4>
      <div class="terminal">powershell -ExecutionPolicy Bypass -Command "irm https://edu-locra.pieteroosterling.online/install-edu.ps1 | iex"</div>
      <p style="font-size:.8rem;color:var(--txt2);margin-top:.5rem">Vereisten: Node.js ≥ 18, npm. Op Windows: voer uit in cmd.exe of PowerShell als Administrator.</p>
    </div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:1200px;margin:0 auto">
    <h2 style="font-size:2rem;margin-bottom:2.5rem;text-align:center">Handleiding: Handmatige installatie (.zip)</h2>
    <div class="grid-3">
      <div class="card"><div class="step-num">01</div><h3>Vereisten controleren</h3><p>Zorg voor Node.js v18+, npm en unzip. Controleer:<br><code>node --version && npm --version</code><br>Installeer PM2 globaal:<br><code>npm install -g pm2</code></p></div>
      <div class="card"><div class="step-num">02</div><h3>Uitpakken</h3><p>Pak het zip-bestand uit:<br><code>unzip locra-release.zip -d locra-edu</code><br>Navigeer naar de map:<br><code>cd locra-edu</code></p></div>
      <div class="card"><div class="step-num">03</div><h3>Backend instellen</h3><p>Ga naar de servermap:<br><code>cd server && npm install</code><br>Maak .env aan met PORT=4000, JWT_SECRET en DATABASE_URL.<br><code>npx prisma db push</code></p></div>
      <div class="card"><div class="step-num">04</div><h3>Services starten</h3><p>Start de server via PM2:<br><code>pm2 start server/dist/index.js --name locra-edu-api</code><br>Sla op voor autostart:<br><code>pm2 save && pm2 startup</code></p></div>
      <div class="card"><div class="step-num">05</div><h3>Setup Wizard</h3><p>Open <strong>http://localhost:4000</strong>. Voer je EDU-licentiesleutel in, stel de schoolnaam in en maak de eerste beheerdersaccount aan.</p></div>
      <div class="card"><div class="step-num">06</div><h3>Docenten toevoegen</h3><p>Ga na activatie naar het beheerportaal → Gebruikers. Voeg docenten en leerlingen toe of koppel SOMtoday voor automatisch importeren.</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div style="max-width:900px;margin:0 auto">
    <h2 style="text-align:center;margin-bottom:2rem">Problemen oplossen & Beheer</h2>
    <div style="background:var(--bg2);padding:2rem;border-radius:var(--r);margin-bottom:2rem">
      <h3 style="margin-bottom:1rem">Server herstarten (Windows)</h3>
      <p style="color:var(--txt2);margin-bottom:1rem">Als je je terminal per ongeluk hebt gesloten of de server wilt herstarten, open dan een nieuwe Command Prompt (of PowerShell), navigeer naar de geïnstalleerde map en typ:</p>
      <div class="terminal">cd C:\\Pad\\Naar\\Je\\Installatie\\locra-edu-release<br>pm2 delete all<br>pm2 start server/dist/index.js --name "locra-edu-api" --interpreter node</div>
    </div>
    <div style="background:var(--bg2);padding:2rem;border-radius:var(--r)">
      <h3 style="margin-bottom:1rem">Server herstarten (Linux / macOS)</h3>
      <p style="color:var(--txt2);margin-bottom:1rem">Na een herstart van de machine:</p>
      <div class="terminal">pm2 resurrect<br><span class="comment"># Of handmatig:</span><br>cd /opt/locra-edu<br>pm2 start server/dist/index.js --name locra-edu-api</div>
    </div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:900px;margin:0 auto">
    <h2 style="text-align:center;margin-bottom:2rem">Systeemvereisten voor scholen</h2>
    <div class="grid-2">
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>🖥️ Besturingssysteem</strong><p style="color:var(--txt2);margin-top:.5rem">Linux (Ubuntu 22.04+ aanbevolen), macOS 13+ of Windows via WSL2.</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>⚙️ Runtime</strong><p style="color:var(--txt2);margin-top:.5rem">Node.js v18 of hoger, npm v9+</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>🤖 AI-modellen</strong><p style="color:var(--txt2);margin-top:.5rem">Ollama geïnstalleerd, minimaal 8 GB RAM (16 GB aanbevolen)</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>💾 Opslag</strong><p style="color:var(--txt2);margin-top:.5rem">Minimaal 20 GB vrij voor software + modellen</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>🌐 Netwerk</strong><p style="color:var(--txt2);margin-top:.5rem">Internettoegang voor modellen downloaden; daarna werkt Locra lokaal</p></div>
      <div style="padding:1.5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff"><strong>🔑 Licentie</strong><p style="color:var(--txt2);margin-top:.5rem">Een Locra EDU-licentiesleutel — <a href="aanmelden.html" style="color:var(--blue)">aan te vragen via de aanvraagpagina</a></p></div>
    </div>
  </div>
</section>
""")

# ── DOCS ──
docs = page("Documentatie & implementatie", """
<section class="section">
  <div class="section-hdr">
    <span class="overline">Setup & Implementatie</span>
    <h2>Documentatie & implementatie</h2>
    <p>Een praktisch startpunt voor ICT-beheer, docenten en schoolleiding. Volg de vier stappen om Locra EDU te laten landen op school.</p>
  </div>

  <div class="grid-2" style="max-width:1100px;margin:0 auto 4rem">
    <div class="card"><div class="step-num">01</div><h3>Voorbereiden</h3><p>Kies beheerder, omgeving, toegangsbeleid en licentietier. Bespreek met schoolleiding welke doelen jullie nastreven met AI. Bepaal vooraf rollen, gewenste functies en dataopslag-beleid.</p></div>
    <div class="card"><div class="step-num">02</div><h3>Installeren</h3><p>Installeer server en client; start daarna de Locra setupwizard. Kies voor de auto-installer (aanbevolen) of handmatige zip-installatie. Zie de <a href="download.html" style="color:var(--blue)">downloadpagina</a> voor alle details.</p></div>
    <div class="card"><div class="step-num">03</div><h3>Inrichten</h3><p>Activeer licentie, gebruikers, rollen, modellen en schoolinstellingen. Configureer kennisbanken met schooldocumenten, stel quota in en test de omgeving met een klein docententeam.</p></div>
    <div class="card"><div class="step-num">04</div><h3>Starten</h3><p>Introduceer de Academy bij leerlingen en spreek verantwoord gebruik af. Begin met een beperkte pilot en breid geleidelijk uit naar meer klassen en vakken.</p></div>
  </div>
</section>

<section class="section alt">
  <div style="max-width:1000px;margin:0 auto">
    <h2 style="text-align:center;margin-bottom:2rem">Handleidingen per rol</h2>
    <div class="grid-3">
      <div class="card" style="border-top:4px solid var(--navy)">
        <h3>ICT-beheerder</h3>
        <ul style="padding-left:1.5rem;color:var(--txt2);display:flex;flex-direction:column;gap:.5rem;margin-top:1rem">
          <li>Installatie (zip of auto-installer)</li>
          <li>Licentie activeren via setup wizard</li>
          <li>Gebruikers, rollen en groepen beheren</li>
          <li>AI-modellen configureren</li>
          <li>Kennisbanken en quota instellen</li>
          <li>Auditlogs bekijken</li>
        </ul>
      </div>
      <div class="card" style="border-top:4px solid var(--orange)">
        <h3>Docent</h3>
        <ul style="padding-left:1.5rem;color:var(--txt2);display:flex;flex-direction:column;gap:.5rem;margin-top:1rem">
          <li>Klassen aanmaken en beheren</li>
          <li>Opdrachten met lesmateriaal klaarzetten</li>
          <li>Inzendingen beoordelen (Rubric UI)</li>
          <li>Teacherbot gebruiken</li>
          <li>Academy-voortgang bekijken</li>
        </ul>
      </div>
      <div class="card" style="border-top:4px solid var(--blue)">
        <h3>Leerling</h3>
        <ul style="padding-left:1.5rem;color:var(--txt2);display:flex;flex-direction:column;gap:.5rem;margin-top:1rem">
          <li>Inloggen en chat starten</li>
          <li>Opdrachten bekijken en inleveren</li>
          <li>Academy-modules doorlopen</li>
          <li>Kennisbank raadplegen</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="section" style="text-align:center">
  <a href="download.html" class="btn btn-primary btn-lg">Naar downloaden & installeren →</a>
</section>
""")

# ── AANMELDEN ──
aanmelden = page("Licentie aanvragen", """
<section class="section">
  <div style="max-width:800px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <span class="overline">Aanvragen</span>
      <h1 style="font-size:2.5rem;margin-bottom:1rem">Vraag jullie EDU-licentie aan</h1>
      <p style="color:var(--txt2);font-size:1.1rem">Vul het formulier in. Na een succesvolle aanvraag ontvang je direct een bevestiging en, wanneer beschikbaar, een licentiesleutel.</p>
    </div>
    <form style="background:#fff;padding:3rem;border:1px solid var(--border);border-radius:var(--r);box-shadow:0 10px 30px rgba(0,0,0,.05);display:flex;flex-direction:column;gap:1.5rem">
      <div>
        <label style="display:block;font-weight:600;margin-bottom:.5rem">Gewenste licentie</label>
        <select style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem;background:#fff">
          <option value="edu-basic">EDU Basic (gratis)</option>
          <option value="edu-plus">EDU Plus (€100/jaar)</option>
          <option value="edu-campus" selected>EDU Campus (€250/jaar)</option>
          <option value="enterprise">Enterprise (op maat)</option>
        </select>
      </div>
      <div>
        <label style="display:block;font-weight:600;margin-bottom:.5rem">School of onderwijsinstelling</label>
        <input type="text" placeholder="Bijv. Stedelijk Gymnasium" style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:.5rem">Contactpersoon</label>
          <input type="text" placeholder="Voor- en achternaam" style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem" required>
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:.5rem">School e-mailadres</label>
          <input type="email" placeholder="naam@school.nl" style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem" required>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:.5rem">Telefoonnummer <small style="font-weight:400;color:var(--txt2)">(optioneel)</small></label>
          <input type="tel" style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:.5rem">Aantal leerlingen <small style="font-weight:400;color:var(--txt2)">(optioneel)</small></label>
          <input type="number" placeholder="Bijv. 850" style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem">
        </div>
      </div>
      <div>
        <label style="display:block;font-weight:600;margin-bottom:.5rem">Opmerking of wens <small style="font-weight:400;color:var(--txt2)">(optioneel)</small></label>
        <textarea rows="4" placeholder="Bijvoorbeeld: interesse in Somtoday of een docentenworkshop." style="width:100%;padding:.8rem;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:1rem;resize:vertical"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-lg" style="margin-top:1rem;width:100%">Licentie aanvragen →</button>
    </form>
  </div>
</section>
""")

# ── FAQ ──
faq = page("Veelgestelde vragen", """
<section class="section">
  <div style="max-width:800px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <span class="overline">FAQ</span>
      <h1 style="font-size:2.5rem;margin-bottom:1rem">Veelgestelde vragen</h1>
      <p style="color:var(--txt2)">Antwoorden op veelgestelde vragen over Locra EDU.</p>
    </div>

    <div class="faq-item"><div class="faq-q">Is Locra EDU alleen voor leerlingen?</div><div class="faq-a">Nee. Locra EDU bevat aparte ervaringen voor leerlingen, docenten en beheerders. Elke rol heeft eigen functionaliteiten en een eigen dashboard.</div></div>
    <div class="faq-item"><div class="faq-q">Welke AI-modellen worden ondersteund?</div><div class="faq-a">Locra ondersteunt lokale modellen via Ollama (gratis, draait op eigen hardware) en optioneel cloud-modellen zoals OpenAI GPT-4, Anthropic Claude en Google Gemini. De beheerder bepaalt welke modellen beschikbaar zijn.</div></div>
    <div class="faq-item"><div class="faq-q">Is SOMtoday beschikbaar?</div><div class="faq-a">Ja, de applicatie bevat een SOMtoday-koppeling die per school en licentie wordt geconfigureerd. Beschikbaar bij EDU Campus en Enterprise.</div></div>
    <div class="faq-item"><div class="faq-q">Hoe werkt de Academy?</div><div class="faq-a">Leerlingen volgen interactieve modules over AI, prompting, betrouwbaarheid en ethiek. Elke module bevat uitleg, oefeningen en een quiz. Docenten kunnen de voortgang per leerling volgen.</div></div>
    <div class="faq-item"><div class="faq-q">Kan een school eigen documenten inzetten?</div><div class="faq-a">Ja, beheerders kunnen documenten beheren in kennisbanken. Deze worden via RAG-technologie door de AI als context gebruikt. Zo antwoordt de AI op basis van jullie eigen schooldocumenten.</div></div>
    <div class="faq-item"><div class="faq-q">Moet de school een eigen server hebben?</div><div class="faq-a">Ja, Locra EDU draait op een eigen server (Linux, macOS of Windows). Een oude PC met 16 GB RAM en een SSD is al voldoende. Zo blijft alle data binnen het schoolnetwerk.</div></div>
    <div class="faq-item"><div class="faq-q">Wat als we hulp nodig hebben bij de installatie?</div><div class="faq-a">De auto-installer doet het meeste werk automatisch. Daarnaast bieden we bij EDU Campus en Enterprise begeleide implementatie aan. Neem contact op via het aanmeldformulier.</div></div>
    <div class="faq-item"><div class="faq-q">Is er een AVG-verwerkersovereenkomst?</div><div class="faq-a">Locra helpt met technische regie en privacy-maatregelen. Voor verwerkersovereenkomsten en juridisch advies verwijzen we naar de privacy-officer van de school. Locra verwerkt zelf geen persoonsgegevens wanneer lokaal gehost.</div></div>
    <div class="faq-item"><div class="faq-q">Werkt watermerkdetectie betrouwbaar?</div><div class="faq-a">Watermerkdetectie geeft signalen, geen absolute zekerheid. Het is bedoeld als hulpmiddel voor docenten — altijd als onderdeel van een zorgvuldig gesprek met de leerling.</div></div>
  </div>
</section>
""")

# ── CHANGELOG ──
changelog = page("Changelog", """
<section class="section">
  <div style="max-width:800px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <span class="overline">Updates</span>
      <h1 style="font-size:2.5rem;margin-bottom:1rem">Changelog</h1>
      <p style="color:var(--txt2)">Nieuwe functionaliteiten en updates voor de Locra EDU omgeving.</p>
    </div>

    <div style="border-left:3px solid var(--blue);padding-left:2rem;display:flex;flex-direction:column;gap:3rem">
      <div>
        <span style="background:rgba(37,99,235,.1);color:var(--blue);padding:4px 12px;border-radius:50px;font-size:.85rem;font-weight:700">Versie 1.1</span>
        <h3 style="margin-top:1rem;margin-bottom:.5rem">Docentendashboard & Opdrachten</h3>
        <p style="color:var(--txt2)">Nieuwe docentenomgeving. Docenten kunnen nu alleen hun eigen klassen inzien (strikte scheiding), opdrachten (incl. PDF lesmateriaal) klaarzetten en inzendingen beoordelen met de nieuwe Rubric UI.</p>
        <ul style="margin-top:1rem;padding-left:1.5rem;color:var(--txt2)">
          <li>Docentendashboard met klasoverzicht</li>
          <li>Opdrachten aanmaken en beheren</li>
          <li>PDF-lesmateriaal uploaden</li>
          <li>Rubric UI voor inzendingen beoordelen</li>
          <li>Strikte rolscheiding per docent</li>
        </ul>
      </div>

      <div>
        <span style="background:rgba(37,99,235,.1);color:var(--blue);padding:4px 12px;border-radius:50px;font-size:.85rem;font-weight:700">Versie 1.0</span>
        <h3 style="margin-top:1rem;margin-bottom:.5rem">Release: AI in het Onderwijs</h3>
        <p style="color:var(--txt2)">Initiële release van Locra EDU. Brengt Socratische begeleiding, de interactieve Locra Academy, schoolbrede privacy-instellingen en SOMtoday integratie naar het klaslokaal.</p>
        <ul style="margin-top:1rem;padding-left:1.5rem;color:var(--txt2)">
          <li>Socratische chatbegeleiding</li>
          <li>Locra Academy (4 modules)</li>
          <li>Admin-paneel met rollen en rechten</li>
          <li>Kennisbanken met RAG</li>
          <li>SOMtoday-koppeling</li>
          <li>Watermerkdetectie</li>
          <li>EDU-licentiesysteem</li>
          <li>Auto-installer voor Linux en Windows</li>
        </ul>
      </div>
    </div>
  </div>
</section>
""")

# ── CONTACT ──
contact = page("Contact", """
<section class="section">
  <div style="max-width:700px;margin:0 auto;text-align:center">
    <span class="overline">Neem contact op</span>
    <h1 style="font-size:2.5rem;margin-bottom:1.5rem">Samen verantwoord met AI starten.</h1>
    <p style="color:var(--txt2);font-size:1.15rem;margin-bottom:3rem">Wil je overleggen over Locra EDU, implementatie of een licentie voor jullie school? We denken graag mee.</p>

    <div style="background:var(--bg2);padding:3rem;border-radius:var(--rl);margin-bottom:2rem">
      <h2 style="margin-bottom:1rem">📧 E-mail</h2>
      <a href="mailto:locra@pjotters.nl" style="color:var(--blue);font-size:1.3rem;font-weight:700">locra@pjotters.nl</a>
    </div>

    <div class="grid-2" style="gap:1.5rem">
      <div style="background:var(--bg2);padding:2rem;border-radius:var(--r)">
        <h3>🏫 Voor scholen</h3>
        <p style="color:var(--txt2);margin-top:.5rem">Interesse in een pilot, demo of licentie? Gebruik het <a href="aanmelden.html" style="color:var(--blue)">aanvraagformulier</a> of mail ons.</p>
      </div>
      <div style="background:var(--bg2);padding:2rem;border-radius:var(--r)">
        <h3>🔧 Technische ondersteuning</h3>
        <p style="color:var(--txt2);margin-top:.5rem">Problemen met de installatie? Stuur een beschrijving naar locra@pjotters.nl met OS, foutmelding en versienummer.</p>
      </div>
    </div>
  </div>
</section>
""")

# ── VIDEOS ──
videos = page("Setupvideo's", """
<section class="section">
  <div style="max-width:900px;margin:0 auto;text-align:center">
    <span class="overline">Video Handleidingen</span>
    <h1 style="font-size:2.5rem;margin-bottom:1.5rem">Setupvideo's</h1>
    <p style="color:var(--txt2);font-size:1.1rem;margin-bottom:3rem">Korte video's voor ICT-beheer, eerste configuratie en docentstart volgen bij de release.</p>

    <div class="grid-3">
      <div class="card" style="text-align:center">
        <div style="background:var(--bg2);border-radius:var(--r);padding:3rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center">
          <span style="font-size:3rem">▶️</span>
        </div>
        <h3>Locra EDU installeren</h3>
        <p>Stap-voor-stap de auto-installer en handmatige installatie doorlopen.</p>
        <span style="color:var(--txt2);font-size:.9rem;font-style:italic">Binnenkort beschikbaar</span>
      </div>
      <div class="card" style="text-align:center">
        <div style="background:var(--bg2);border-radius:var(--r);padding:3rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center">
          <span style="font-size:3rem">▶️</span>
        </div>
        <h3>Je school configureren</h3>
        <p>Gebruikers, rollen, modellen en kennisbanken instellen via het admin-paneel.</p>
        <span style="color:var(--txt2);font-size:.9rem;font-style:italic">Binnenkort beschikbaar</span>
      </div>
      <div class="card" style="text-align:center">
        <div style="background:var(--bg2);border-radius:var(--r);padding:3rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center">
          <span style="font-size:3rem">▶️</span>
        </div>
        <h3>Docenten laten starten</h3>
        <p>Klassen, opdrachten en de Academy activeren voor docenten.</p>
        <span style="color:var(--txt2);font-size:.9rem;font-style:italic">Binnenkort beschikbaar</span>
      </div>
    </div>
  </div>
</section>
""")

# Write all files
files = {
    'index.html': index,
    'features.html': features,
    'academy.html': academy,
    'veiligheid.html': veiligheid,
    'prijzen.html': prijzen,
    'download.html': download,
    'docs.html': docs,
    'aanmelden.html': aanmelden,
    'faq.html': faq,
    'changelog.html': changelog,
    'contact.html': contact,
    'videos.html': videos,
    'style.css': css,
}

for name, content in files.items():
    with open(os.path.join(base, name), 'w') as f:
        f.write(content)

print(f"✅ Generated {len(files)} files in {base}")
