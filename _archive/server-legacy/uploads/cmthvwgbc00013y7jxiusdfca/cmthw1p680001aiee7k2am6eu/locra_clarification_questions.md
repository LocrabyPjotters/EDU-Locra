# 🔍 Locra — Verhelderingsvragen

> Voordat we beginnen met bouwen, moeten we alle requirements helder krijgen. Hieronder 60+ vragen verdeeld over categorieën. Beantwoord ze zo specifiek mogelijk — je mag ook "weet ik nog niet" zeggen, dan kies ik een goede default.

---

## 1. 🎯 Doelgroep & Scope

1. **Welke type organisaties?** Alleen scholen/onderwijsinstellingen, of ook bedrijven, overheid, zorg, etc.?
2. **Welke schaalgrootte?** Een kleine school (50 gebruikers) of grote universiteiten (10.000+ gebruikers)?
3. **Welke eindgebruikers?** Alleen docenten, of ook leerlingen/studenten? En ICT-beheerders?
4. **Multi-tenant?** Kan één Locra-installatie meerdere "afdelingen" / scholen bedienen, of is het 1 installatie = 1 organisatie?
5. **Internationale ondersteuning?** Moet de interface meertalig zijn (NL/EN/DE etc.) of alleen Nederlands?

---

## 2. 🏗️ Architectuur & Deployment

6. **Server requirements?** Wat is de minimale server-setup? Linux only, of ook Windows Server?
7. **Docker/container-based?** Moet het pakket als Docker container geleverd worden, of als standalone installer?
8. **Kubernetes support?** Moeten we k8s Helm charts voorzien voor grote organisaties?
9. **Single server of microservices?** Alles op 1 machine, of gesplitst (backend, AI inference, database)?
10. **Reverse proxy?** Moeten we Nginx/Caddy configuratie meeleveren?
11. **HTTPS/SSL?** Automatische Let's Encrypt support, of verwachten we dat de organisatie dit zelf regelt?
12. **Air-gapped support?** Moet Locra volledig offline kunnen draaien (geen internet nodig na installatie)?
13. **Auto-updates?** Moet er een update-mechanisme inzitten, of downloaden organisaties handmatig nieuwe versies?
14. **Installatie-wizard?** Moet er een CLI-gebaseerde of web-gebaseerde setup wizard zijn?

---

## 3. 🤖 AI Models & Inference

15. **Ollama als primaire backend?** Moet Ollama de standaard zijn, of willen we ook vllm, llama.cpp, etc. ondersteunen?
16. **HuggingFace integratie** — bedoel je modellen downloaden vanuit de HF Hub? Of ook HF Inference API (cloud)?
17. **Model marketplace UI?** Een in-app interface waar de admin modellen kan browsen, downloaden en activeren?
18. **GPU vereist?** Moet het ook op CPU-only machines draaien (langzamer maar werkend)?
19. **Meerdere modellen tegelijk?** Kan een organisatie meerdere modellen actief hebben (bv. een klein voor snel, een groot voor complex)?
20. **Model-routing?** Automatisch het juiste model kiezen op basis van de vraag, of kiest de gebruiker zelf?
21. **Welke model-types?** Alleen text-to-text (chat), of ook:
    - Code generatie?
    - Image generatie (Stable Diffusion etc.)?
    - Document analyse (RAG)?
    - Speech-to-text / text-to-speech?
22. **Model versie-management?** Kunnen admins terugrollen naar een vorige modelversie?
23. **Embedding modellen?** Voor RAG/semantic search, moeten er ook embedding modellen ondersteund worden?
24. **Fine-tuning?** Moet de organisatie modellen kunnen fine-tunen op eigen data?
25. **Model grootte limieten?** Moeten we admins waarschuwen als hun hardware te zwak is voor een geselecteerd model?

---

## 4. 🔐 Beveiliging & Privacy (Core!)

26. **OpenPCC integratie** — hoe diep? Als proxy voor alle requests, of als optionele laag?
27. **End-to-end encryptie?** Moeten prompts/responses versleuteld zijn, zelfs in transit binnen het lokale netwerk?
28. **Content filtering?** Moet er een ingebouwde filter zijn voor ongepaste content (belangrijk voor scholen)?
29. **Prompt logging policy?** Wie bepaalt of prompts gelogd worden — de admin, de individuele gebruiker, of allebei?
30. **Data retention?** Hoe lang worden gesprekken bewaard als opslag aan staat? Configureerbaar?
31. **Anonimisering?** Moeten gesprekken geanonimiseerd worden voordat ze opgeslagen worden?
32. **Audit logging?** Moet er een audit trail zijn van wie wat wanneer heeft gevraagd (voor compliance)?
33. **GDPR/AVG compliance?** Moeten er specifieke AVG-tools in zitten (data export, recht op verwijdering)?
34. **Netwerk isolatie?** Moet de software actief controleren dat er geen data naar buiten gaat?
35. **Security headers?** CSP, HSTS, X-Frame-Options etc. automatisch configureren?
36. **Rate limiting?** Per gebruiker, per afdeling, of globaal?

---

## 5. 👤 Gebruikersbeheer & Authenticatie

37. **Login systeem?** Eigen accounts, of koppeling met bestaande systemen (LDAP, Active Directory, SAML, OAuth)?
38. **SSO (Single Sign-On)?** Via Microsoft 365, Google Workspace, of andere identity providers?
39. **Rollen?** Welke rollen moeten er zijn?
    - Superadmin (Pjotters/ons als leverancier)?
    - Organisatie-admin?
    - Docent/manager?
    - Leerling/medewerker?
    - Gast (zonder account)?
40. **Groepen/klassen?** Moeten gebruikers in groepen geplaatst kunnen worden?
41. **Gebruikerslimieten?** Max aantal prompts per dag/maand per gebruiker?
42. **Registratie?** Self-service aanmelden of alleen door admin aangemaakt?
43. **2FA/MFA?** Moet tweefactorauthenticatie ondersteund worden?

---

## 6. 💬 Chat Interface & UX

44. **Chat stijl?** Vergelijkbaar met ChatGPT, of een ander concept (bv. notebook-stijl)?
45. **Gesprekken organiseren?** Mappen, tags, zoekfunctie?
46. **Gedeelde gesprekken?** Kan een docent een gesprek delen met leerlingen?
47. **Templates/prompts?** Vooraf ingestelde prompt-templates die de admin configureert (bv. "Schrijf een samenvatting")?
48. **System prompts?** Kan de admin een organisatie-brede system prompt instellen (bv. "Antwoord altijd in het Nederlands")?
49. **Attachments/uploads?** Kunnen gebruikers bestanden uploaden (PDF, Word, afbeeldingen)?
50. **Markdown rendering?** Moeten antwoorden met code-highlighting, tabellen, LaTeX etc. weergegeven worden?
51. **Streaming responses?** Real-time token-voor-token weergave, of wachten tot het hele antwoord klaar is?
52. **Dark mode?** Standaard, optioneel, of door de organisatie te kiezen?
53. **Mobiel responsive?** Moet het ook op tablets/telefoons goed werken?
54. **PWA?** Als Progressive Web App installeerbaar op devices?
55. **Keyboard shortcuts?** Power-user features?

---

## 7. 🎨 Customization (Organisatie-branding)

56. **Logo upload?** Eigen logo in de header?
57. **Kleurenschema?** Volledig aanpasbare kleuren (primary, secondary, accent)?
58. **Custom CSS?** Mogen organisaties eigen CSS injecteren?
59. **Welkomstpagina?** Een aanpasbare landingspagina met bv. schoolnieuws?
60. **Custom domeinnaam?** `ai.mijnschool.nl` met eigen DNS?
61. **Footer/disclaimer?** Aanpasbare tekst onderaan (bv. "AI kan fouten maken")?
62. **Favicon?** Aanpasbaar icoontje in de browsertab?

---

## 8. 💾 Data & Opslag

63. **Database keuze?** SQLite (eenvoudig), PostgreSQL (robuust), of configureerbaar?
64. **localStorage optie** — bedoel je dat gesprekken ALLEEN in de browser opgeslagen worden en nooit de server bereiken?
65. **Hybrid opslag?** Sommige data server-side, sommige client-side?
66. **Export functie?** Kunnen gebruikers hun gesprekken exporteren als JSON/PDF/Markdown?
67. **Backup systeem?** Automatische backups van de database?
68. **Vector database?** Voor RAG — ChromaDB, Weaviate, Milvus, of ingebouwd?

---

## 9. 📦 Pakket & Distributie

69. **Wat zit er in `/public`?** Een downloadbare ZIP, een statische website, of een installer?
70. **Installatie-instructies?** Moet er een mooie documentatie-site bij?
71. **Versioning?** Semantic versioning met changelog?
72. **Licentiemodel?** Open source, proprietary, freemium?
73. **Activatie/licentiesleutel?** Moet de organisatie een licentiesleutel invoeren?
74. **CLI tool?** Een `locra` CLI commando voor installatie en beheer?

---

## 10. 📊 Admin Dashboard

75. **Statistieken?** Welke metrics wil je tonen?
    - Aantal actieve gebruikers?
    - Aantal prompts per dag/week/maand?
    - Gemiddelde responstijd?
    - Model usage breakdown?
    - Token verbruik?
76. **Gebruikersbeheer UI?** CRUD voor gebruikers in de admin?
77. **Model management UI?** Installeren, verwijderen, configureren van modellen?
78. **Systeemstatus?** CPU/GPU/RAM/disk monitoring dashboard?
79. **Logs viewer?** In-app log viewing voor troubleshooting?
80. **Configuratie UI?** Alle settings aanpasbaar via de webinterface, of via config files?

---

## 11. 🔌 Integraties

81. **API?** Moet Locra een REST/GraphQL API bieden zodat andere systemen ermee kunnen praten?
82. **LMS integratie?** Koppeling met leerlingvolgsystemen (Magister, Somtoday, Moodle, Canvas)?
83. **Webhook support?** Notificaties naar externe systemen?
84. **Plugin systeem?** Kunnen organisaties zelf plugins/extensies bouwen?
85. **SSO providers?** Specifiek welke: Microsoft Entra ID, Google, Kennisnet?

---

## 12. 📚 RAG & Kennisbank

86. **Document upload?** Kunnen organisaties eigen documenten uploaden als kennisbron?
87. **Welke formaten?** PDF, DOCX, PPTX, TXT, HTML, Markdown?
88. **Website scraping?** Kunnen organisaties een interne website indexeren?
89. **Kennisbank per groep?** Verschillende kennisbanken voor verschillende afdelingen?
90. **Automatische re-indexing?** Als documenten wijzigen, automatisch opnieuw indexeren?

---

## 13. ⚡ Performance & Schaalbaarheid

91. **Concurrent users?** Hoeveel gelijktijdige gebruikers moet het aankunnen?
92. **Queue systeem?** Als de GPU bezet is, wachtrij met positie-indicatie?
93. **Load balancing?** Meerdere GPU-servers achter een load balancer?
94. **Caching?** Veelgestelde vragen cachen voor snellere antwoorden?

---

## 14. 🧪 Overig

95. **Feedback systeem?** Kunnen gebruikers antwoorden beoordelen (👍/👎)?
96. **Rapportage functie?** Kan een docent ongepaste AI-antwoorden rapporteren?
97. **Onderhoudsmodus?** Een maintenance page tijdens updates?
98. **Health checks?** Endpoint voor monitoring tools (Nagios, Zabbix, Uptime Kuma)?
99. **Telemetry?** Stuurt Locra anonieme gebruiksstatistieken naar Pjotters? (opt-in/opt-out?)
100. **Naam "Locra"?** Staat dit vast, of is het een werknaam?
101. **Tijdlijn?** Is er een deadline of target release date?
102. **MVP eerst?** Wil je eerst een minimale versie en dan uitbreiden, of direct alles bouwen?

---

## 15. 🏫 Onderwijs-specifiek

103. **Plagiaat detectie?** Moet Locra kunnen detecteren of leerlingen AI-gegenereerde tekst inleveren?
104. **Toetsmodus?** Een modus waarin AI geblokkeerd is (tijdens toetsen)?
105. **Leerdoelen koppeling?** Kan de AI antwoorden afstemmen op specifieke leerdoelen?
106. **Ouder/verzorger portaal?** Inzicht voor ouders in AI-gebruik van hun kind?
107. **Leeftijdsrestricties?** Verschillende beperkingen per leeftijdsgroep?

---

> [!IMPORTANT]
> **Begin met de vragen die je het belangrijkst vindt.** Je hoeft ze niet allemaal in één keer te beantwoorden — we kunnen in rondes werken. Maar hoe meer je nu invult, hoe beter het eindproduct wordt.

