import os
import re

header = """<header>
  <div class="hdr">
    <a href="index.html" class="brand">locra<b>EDU</b></a>
    <nav class="nav-pill">
      <a href="index.html">Home</a>
      <a href="features.html">Features</a>
      <a href="prijzen.html">Prijzen</a>
      <a href="veiligheid.html">Veiligheid</a>
      <a href="docs.html">Handleiding</a>
      <a href="workshop.html">Contact</a>
    </nav>
    <div class="nav-actions">
      <div class="lang-btn">NL</div>
      <a href="aanmelden.html" class="btn btn-primary">Inloggen</a>
    </div>
  </div>
</header>"""

footer = """<footer>
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
    <a href="#" class="btn btn-primary" style="padding:0.5rem 1rem">Vragen over Locra?</a>
  </div>
</footer>"""

for filename in os.listdir('.'):
    if filename.endswith('.html') and filename not in ['index.html', 'features.html']:
        with open(filename, 'r') as f:
            content = f.read()
        
        # Replace header
        content = re.sub(r'<header>.*?</header>', header, content, flags=re.DOTALL)
        # Replace footer
        content = re.sub(r'<footer>.*?</footer>', footer, content, flags=re.DOTALL)
        
        with open(filename, 'w') as f:
            f.write(content)
