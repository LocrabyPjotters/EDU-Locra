import os

header = """<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} · Locra EDU</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div class="hdr">
    <a href="index.html" class="brand">locra<b>EDU</b></a>
    <div class="nav-pill">
      <a href="index.html" {home_act}>Home</a>
      <a href="features.html" {features_act}>Features</a>
      <a href="prijzen.html" {prijzen_act}>Prijzen</a>
      <a href="veiligheid.html" {veiligheid_act}>Veiligheid</a>
      <a href="docs.html" {docs_act}>Handleiding</a>
      <a href="workshop.html" {contact_act}>Contact</a>
    </div>
    <div class="nav-actions">
      <div class="circle-btn">NL</div>
      <a href="aanmelden.html" class="btn btn-primary">Inloggen</a>
    </div>
  </div>
</header>
<main>
"""

footer = """</main>
<footer>
  <div class="ft">
    <div>
      <div class="brand" style="margin-bottom:1.5rem">locra<b>EDU</b></div>
      <div class="ft-info">
        Bezoekadres: Locra Campus 1<br>
        2908 LH, Capelle aan den IJssel<br><br>
        010 123 45 67<br>
        <a href="mailto:office@locra-edu.nl">office@locra-edu.nl</a>
      </div>
    </div>
    <div>
      <h4>Voorwaarden en privacy</h4>
      <ul>
        <li><a href="veiligheid.html">Veiligheid</a></li>
        <li><a href="#">Functionaris gegevensbescherming</a></li>
        <li><a href="#">Algemene voorwaarden</a></li>
        <li><a href="#">Servicevoorwaarden</a></li>
        <li><a href="#">Privacyverklaring</a></li>
      </ul>
    </div>
    <div>
      <h4>Aan de slag</h4>
      <ul>
        <li><a href="aanmelden.html">Online demonstratie</a></li>
        <li><a href="aanmelden.html">Aanmelden</a></li>
        <li><a href="prijzen.html">Prijzen</a></li>
        <li><a href="workshop.html">Workshop boeken</a></li>
      </ul>
    </div>
    <div>
      <h4>Hulp en informatie</h4>
      <ul>
        <li><a href="docs.html">Handleiding Locra</a></li>
        <li><a href="faq.html">Veelgestelde vragen</a></li>
        <li><a href="aanmelden.html">Contactformulier</a></li>
        <li><a href="over-ons.html">Over ons</a></li>
      </ul>
    </div>
  </div>
  <div class="ft-bottom">
    <div>Disclaimer</div>
    <a href="#" class="btn btn-primary" style="padding:0.4rem 1rem; border-radius:100px; font-size:0.8rem">Vragen over Locra?</a>
  </div>
</footer>
<script src="script.js"></script>
</body>
</html>
"""

pages = {
    'index.html': {
        'title': 'AI goed geregeld',
        'active': 'home',
        'content': """
<section class="hero">
  <div class="hero-content">
    <div>
      <div class="badge"><div class="dot"></div> Voor scholen, docenten en leerlingen</div>
      <h1>AI goed gere-<br><span style="color:var(--primary)">geld</span></h1>
      <h2>Locra EDU: veilig en veelzijdig</h2>
      <p class="lead">Een praktisch AI-platform waarmee onderwijsprofessionals de regie houden, leerlingen verantwoord kunnen werken en scholen veilig gebruikmaken van de beste AI-modellen.</p>
      <div style="display:flex;gap:1rem;margin-bottom:2rem">
        <a href="aanmelden.html" class="btn btn-primary">Plan een gesprek</a>
        <a href="features.html" class="btn btn-secondary" style="border-radius:100px">Bekijk de features</a>
      </div>
      <div class="hero-stats">
        <div>Vertrouwd door het onderwijs</div>
        <div class="stat"><h4>34</h4><p>schoolbesturen</p></div>
        <div class="stat"><h4>285</h4><p>scholen</p></div>
      </div>
    </div>
    <div class="hero-visual">
      <div class="icon-stack">
        <div class="icon-circle-main">locra</div>
        <div class="icon-circle-white"></div>
        <div class="icon-circle-navy"></div>
        <div class="icon-shape-orange"></div>
        <div class="icon-dot"></div>
      </div>
    </div>
  </div>
</section>

<section class="section white">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">WAAROM LOCRA EDU?</div>
      <h2>Veilige AI die werkt voor het onderwijs</h2>
      <p>Van eerste beleid tot dagelijks gebruik: Locra brengt modellen, beheer en ondersteuning samen.</p>
    </div>
    
    <div class="grid-3">
      <div class="feature-card" style="align-items:center;text-align:center">
        <div class="fc-icon"><span style="margin:0"></span></div>
        <h3>Regie en veiligheid</h3>
        <p>Jij bepaalt wie wat mag. AVG-proof, actieve PII-filtering en heldere bewaartermijnen.</p>
      </div>
      <div class="feature-card" style="align-items:center;text-align:center">
        <div class="fc-icon"><span style="background:var(--navy);margin:0"></span></div>
        <h3>Verantwoord met leerlingen</h3>
        <p>Inclusief AI-geletterdheid modules (Academy) en socratische begeleiding voor in de les.</p>
      </div>
      <div class="feature-card" style="align-items:center;text-align:center">
        <div class="fc-icon"><span style="background:var(--orange);margin:0"></span></div>
        <h3>Eén compleet platform</h3>
        <p>Geen losse tools. Modellen, documenten, koppelingen en beheer in één omgeving.</p>
      </div>
    </div>
  </div>
</section>
"""
    },
    'features.html': {
        'title': 'Features',
        'active': 'features',
        'content': """
<section class="section" style="padding-top:12rem">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">GERICHT VERDER</div>
      <h2>Waar veilige AI voor gebruiken?</h2>
      <p>Kies een gebied om direct naar de juiste onderdelen te gaan.</p>
    </div>
    
    <div class="grid-3">
      <div class="feature-card" style="grid-column: 1 / -1; display:grid; grid-template-columns: auto 1fr auto; gap:2rem; align-items:center">
        <div class="fc-icon" style="margin:0"><span></span><span></span><span></span></div>
        <div>
          <h3 style="margin-bottom:0.5rem">AI modellen</h3>
          <p style="margin:0;font-size:1rem">De basis onder alle toepassingen: kies passende AI-modellen voor taal, beeld, audio en spraak.</p>
        </div>
        <div style="text-align:right">
          <div class="fc-tags" style="justify-content:flex-end">
            <span class="tag">Taal</span><span class="tag">Beeld</span><span class="tag">Audio</span><span class="tag">Spraak</span>
          </div>
          <div class="fc-footer">Voor wie: <span>Docent · Leerling · Medewerker · Beheerder</span></div>
          <a href="aanmelden.html" class="btn btn-primary" style="padding:0.6rem 1.2rem;font-size:0.85rem">Bekijk voorbeelden</a>
        </div>
      </div>
      
      <div class="feature-card">
        <div class="fc-icon"><span></span><span style="background:var(--navy)"></span></div>
        <h3>Les maken en geven</h3>
        <p>Voor alles rond de lespraktijk: lesmateriaal maken, lessen klaarzetten en leerlingen begeleiden.</p>
        <div class="fc-tags">
          <span class="tag">Lesmateriaal</span><span class="tag">Lessen</span>
          <span class="tag">Leerlingen</span><span class="tag">Teacherbot</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Docent · Medewerker</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>
      
      <div class="feature-card">
        <div class="fc-icon"><span style="background:var(--orange)"></span><span style="background:var(--primary)"></span></div>
        <h3>Leren, oefenen en feedback</h3>
        <p>Voor oefening en formatieve momenten: vragen maken en leerlingen zelfstandig laten trainen.</p>
        <div class="fc-tags">
          <span class="tag">Oefenvragen</span><span class="tag">Quizzen</span><span class="tag">Feedback</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Leerling · Docent</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>

      <div class="feature-card">
        <div class="fc-icon"><span style="background:var(--primary)"></span><span style="background:var(--orange)"></span></div>
        <h3>Onderzoeken en bronnen</h3>
        <p>Voor actuele informatie en betrouwbare context: zoeken op internet en werken met bronnen.</p>
        <div class="fc-tags">
          <span class="tag">Internet</span><span class="tag">SLO</span><span class="tag">Wikiwijs</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Leerling · Docent</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>
      
      <div class="feature-card">
        <div class="fc-icon"><span style="background:var(--orange)"></span><span style="background:var(--navy)"></span></div>
        <h3>Documenten en bestanden</h3>
        <p>Voor tekst en bestanden als werkmateriaal: documenten maken en informatie uit systemen halen.</p>
        <div class="fc-tags">
          <span class="tag">Documenten</span><span class="tag">PDF</span><span class="tag">Word</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Docent · Beheerder</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>
      
      <div class="feature-card">
        <div class="fc-icon"><span style="background:var(--navy)"></span><span style="background:var(--primary)"></span></div>
        <h3>Spreken en luisteren</h3>
        <p>Voor mondeling werken en media: gesprekken oefenen en tekst omzetten naar luistermateriaal.</p>
        <div class="fc-tags">
          <span class="tag">Spraakchat</span><span class="tag">Transcriptie</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Leerling · Docent</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>
      
      <div class="feature-card">
        <div class="fc-icon"><span style="background:var(--primary)"></span><span style="background:var(--orange)"></span></div>
        <h3>Beheer en organisatie</h3>
        <p>Voor grip op de omgeving: gebruikers, modellen, koppelingen, templates en toegang centraal beheren.</p>
        <div class="fc-tags">
          <span class="tag">Gebruikers</span><span class="tag">Modellen</span><span class="tag">Dashboards</span>
        </div>
        <div class="fc-footer">Voor wie: <span>Beheerder</span></div>
        <a href="aanmelden.html" class="btn btn-primary">Bekijk voorbeelden</a>
      </div>
    </div>
  </div>
</section>

<section class="section white">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">AI-MODELLEN</div>
      <h2>Alle AI-modellen in Locra EDU</h2>
      <p>Nieuwe of betere modellen verschijnen hier zodra ze beschikbaar zijn.</p>
    </div>
    
    <div class="models-container">
      <div class="models-header">
        <div>
          <h3 style="font-size:1.5rem;margin-bottom:0.5rem">Taalmodellen</h3>
          <p style="color:var(--text-light);margin:0">Voor schrijven, samenvatten, analyseren en complexe vragen.</p>
        </div>
        <div class="badge" style="margin:0">12 modellen</div>
      </div>
      
      <div class="model-tier">
        <h4>Topmodellen</h4>
        <div class="model-grid">
          <div class="model-item">
            <span class="provider">OpenAI</span>
            <h5>GPT-4o</h5>
            <p>Topkwaliteit voor complexe uitleg en onderzoeksvragen.</p>
            <div class="model-stats">
              <div class="stat-row">Snelheid <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span></span></div></div>
              <div class="stat-row">Kwaliteit <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span class="filled"></span></div></div>
            </div>
          </div>
          <div class="model-item">
            <span class="provider">Anthropic</span>
            <h5>Claude 3.5 Sonnet</h5>
            <p>De beste in coderen, nuances en het vasthouden van context.</p>
            <div class="model-stats">
              <div class="stat-row">Snelheid <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span class="filled"></span></div></div>
              <div class="stat-row">Kwaliteit <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span class="filled"></span></div></div>
            </div>
          </div>
          <div class="model-item">
            <span class="provider">Google</span>
            <h5>Gemini 1.5 Pro</h5>
            <p>Gigantische context voor het analyseren van hele boeken.</p>
            <div class="model-stats">
              <div class="stat-row">Snelheid <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span></span></div></div>
              <div class="stat-row">Kwaliteit <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span class="filled"></span></div></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="model-tier">
        <h4>Snel en voordelig</h4>
        <div class="model-grid">
          <div class="model-item">
            <span class="provider">OpenAI</span>
            <h5>GPT-4o mini</h5>
            <p>Extreem snel voor dagelijkse, eenvoudige taken.</p>
            <div class="model-stats">
              <div class="stat-row">Snelheid <div class="dots"><span class="filled"></span><span class="filled"></span><span class="filled"></span><span class="filled"></span></div></div>
              <div class="stat-row">Kwaliteit <div class="dots"><span class="filled"></span><span class="filled"></span><span></span><span></span></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
"""
    },
    'prijzen.html': {
        'title': 'Aanbod en Prijzen',
        'active': 'prijzen',
        'content': """
<section class="section" style="padding-top:12rem">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">AANBOD EN PRIJZEN</div>
      <h2>Abonnementen per schoolomgeving.</h2>
      <p>Wij werken niet met kosten per gebruiker, maar met heldere abonnementen per school plus variabele kosten voor de AI-modellen.</p>
    </div>
    
    <div class="grid-3">
      <div class="plan">
        <div class="badge-top" style="position:static;display:inline-block;margin-bottom:1rem;background:var(--bg-light);color:var(--navy)">Primair Onderwijs</div>
        <h2>PO-School</h2>
        <div class="price">€75 <small>/ maand</small></div>
        <ul>
          <li>Onbeperkt gebruikers</li>
          <li>Volledige beheeromgeving</li>
          <li>Locra Academy</li>
          <li>Teacherbot & Documentserver</li>
        </ul>
        <a href="aanmelden.html" class="btn btn-secondary">Vraag aan</a>
      </div>
      
      <div class="plan featured">
        <div class="badge-top">MEEST GEKOZEN - VO</div>
        <h2>VO-School</h2>
        <div class="price">€187,50 <small>/ maand</small></div>
        <ul>
          <li>Alles van PO-School</li>
          <li>Uitgebreide PII-filtering & AVG-logs</li>
          <li>Optionele SOMtoday integratie (+€26/mnd)</li>
          <li>Voorrang bij support</li>
        </ul>
        <a href="aanmelden.html" class="btn btn-primary">Vraag aan</a>
      </div>

      <div class="plan">
        <div class="badge-top" style="position:static;display:inline-block;margin-bottom:1rem;background:var(--bg-light);color:var(--navy)">Hoger Onderwijs</div>
        <h2>MBO / HBO / WO</h2>
        <div class="price">€187,50 <small>/ maand</small></div>
        <ul>
          <li>Alles van VO-School</li>
          <li>Grote gebruikersaantallen</li>
          <li>Geavanceerde Integraties (MCP)</li>
          <li>Dedicated accountmanager</li>
        </ul>
        <a href="aanmelden.html" class="btn btn-secondary">Vraag aan</a>
      </div>
    </div>
  </div>
</section>
"""
    },
    'veiligheid.html': {
        'title': 'Veiligheid',
        'active': 'veiligheid',
        'content': """
<section class="section" style="padding-top:12rem">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">VEILIGHEID EN PRIVACY</div>
      <h2>Privacy is een ontwerpkeuze</h2>
      <p>Geen consumenten-app, maar zakelijke beveiliging, ontworpen rond de strenge eisen van het onderwijs.</p>
    </div>
    
    <div class="grid-2">
      <div class="feature-card">
        <h3>AVG & PII-Bescherming</h3>
        <p>Data van leerlingen wordt automatisch geanonimiseerd. Het platform bevat actieve filters voor het anonimiseren van PII (Personally Identifiable Information) voordat data naar een AI-model wordt verstuurd. Scholen sluiten uiteraard een verwerkersovereenkomst af.</p>
      </div>
      <div class="feature-card">
        <h3>School in regie (Bewaartermijnen)</h3>
        <p>Beheerders bepalen exact hoe lang chatgeschiedenis bewaard blijft. Wanneer een leerling of docent iets verwijdert, of de bewaartermijn verstrijkt, wordt de data ook echt permanent uit de database gewist.</p>
      </div>
      <div class="feature-card">
        <h3>Monitoring & Waarschuwingen</h3>
        <p>Locra bevat themawaarschuwingen en wekelijkse rapportages voor docenten. Er is volledige database-isolatie per school, en alle handelingen in de admin-omgeving worden vastgelegd in een audit-log.</p>
      </div>
      <div class="feature-card">
        <h3>DPIA & Vulnerability Scans</h3>
        <p>Het platform is geoptimaliseerd voor scholen die een Data Protection Impact Assessment (DPIA) uitvoeren. We voeren regelmatige vulnerability scans uit op de cloud-infrastructuur.</p>
      </div>
    </div>
  </div>
</section>
"""
    },
    'docs.html': {
        'title': 'Documentatie',
        'active': 'docs',
        'content': """
<section class="section white" style="padding-top:12rem">
  <div class="container">
    <div class="docs-layout">
      <aside class="docs-sidebar">
        <div class="docs-nav-group">
          <div class="docs-nav-title">Handleiding</div>
          <ul class="docs-nav-links">
            <li><a href="#" class="active">Introductie</a></li>
            <li><a href="#">Overstappen naar Locra</a></li>
          </ul>
        </div>
        <div class="docs-nav-group">
          <div class="docs-nav-title">Basis gebruik</div>
          <ul class="docs-nav-links">
            <li><a href="#">Inloggen & Accounts</a></li>
            <li><a href="#">Layout & Menu</a></li>
          </ul>
        </div>
        <div class="docs-nav-group">
          <div class="docs-nav-title">Beheeromgeving</div>
          <ul class="docs-nav-links">
            <li><a href="#">School & Domeinen</a></li>
            <li><a href="#">AI-beleid</a></li>
          </ul>
        </div>
      </aside>
      
      <div class="docs-content">
        <div class="overline">KENNISBANK & DOCUMENTATIE</div>
        <h1>Welkom bij Locra EDU</h1>
        <p style="font-size:1.15rem; color:var(--text-main); margin-bottom:2rem">De complete, online handleiding voor docenten, leerlingen en ICT-beheerders. Kies een onderwerp in het menu aan de linkerkant om te beginnen.</p>
        
        <h2>Wat is dit platform?</h2>
        <p>Locra EDU positioneert zich als een complete SaaS-oplossing voor scholen: geen losstaande chatbot, maar een beheerde omgeving die AI-capaciteit, de onderwijspraktijk en strikte controle/veiligheid combineert. Wij noemen dit: <strong>AI goed geregeld.</strong></p>
        
        <div class="feature-card" style="margin-top:2rem; padding:2rem">
          <h3>Voor Leerlingen</h3>
          <p style="margin-bottom:0">Oefen met de Locra Academy (E-learning), gebruik veilige chat die de antwoorden niet weggeeft (socratisch), en bouw een fundament in AI-geletterdheid.</p>
        </div>
      </div>
    </div>
  </div>
</section>
"""
    },
    'workshop.html': {
        'title': 'Contact',
        'active': 'contact',
        'content': """
<section class="section" style="padding-top:12rem">
  <div class="container">
    <div class="section-intro center">
      <div class="overline">TRAINING & ADOPTIE</div>
      <h2>AI Workshop voor het docententeam</h2>
      <p>Een praktische, op maat gemaakte training van 2,5 uur op locatie.</p>
    </div>
    <div style="max-width:800px; margin:0 auto">
      <div class="plan">
        <h3 style="font-size:1.5rem; margin-bottom:0.5rem">Docentenworkshop AI in de Praktijk</h3>
        <div class="price" style="font-size:2rem; margin-bottom:2rem">€1.250 <small>excl. btw</small></div>
        <ul>
          <li>Kennismaking met Generatieve AI</li>
          <li>Prompts schrijven (CLEAR-methode)</li>
          <li>Documentgeneratie & lesvoorbereiding</li>
          <li>Veilig en didactisch verantwoord gebruik</li>
        </ul>
        <a href="aanmelden.html" class="btn btn-primary" style="margin-top:1rem">Aanvragen</a>
      </div>
    </div>
  </div>
</section>
"""
    }
}

for filename, data in pages.items():
    html = header.format(
        title=data['title'],
        home_act='class="active"' if data['active'] == 'home' else '',
        features_act='class="active"' if data['active'] == 'features' else '',
        prijzen_act='class="active"' if data['active'] == 'prijzen' else '',
        veiligheid_act='class="active"' if data['active'] == 'veiligheid' else '',
        docs_act='class="active"' if data['active'] == 'docs' else '',
        contact_act='class="active"' if data['active'] == 'contact' else ''
    )
    html += data['content']
    html += footer
    
    with open(filename, 'w') as f:
        f.write(html)
