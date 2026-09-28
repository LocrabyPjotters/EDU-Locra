# CodeMatch & GitHub OAuth Configuratie Handleiding

Deze handleiding legt stap voor stap uit hoe je als beheerder de **GitHub OAuth Integratie** voor CodeMatch instelt, inclusief veelvoorkomende foutmeldingen (zoals `redirect_uri is not associated with this application`) en hoe je deze voorkomt.

---

## 1. Wat is CodeMatch?

CodeMatch is de ingebouwde online programmeeromgeving (IDE) binnen Locra. Hiermee kunnen leerlingen en docenten:
- Rechtstreeks inloggen met hun eigen GitHub account.
- Repositories inzien, bestanden bewerken via Monaco Editor (de motor van VS Code).
- Nieuwe repositories aanmaken en code committen naar GitHub.
- AI-ondersteuning gebruiken via de ingebouwde CodeMatch AI Assistent om code uit te leggen, bugs op te sporen en functies te genereren.

---

## 2. GitHub OAuth App Aanmaken

Om gebruikers te laten autoriseren via GitHub, moet er eenmalig een GitHub OAuth App aangemaakt worden:

1. Ga naar [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers).
2. Klik op de knop **"New OAuth App"** (of "Register a new application").
3. Vul de velden als volgt in:
   - **Application name:** Bijvoorbeeld `Locra CodeMatch`
   - **Homepage URL:** De URL waarop je Locra draait (bijv. `http://localhost:5173` of je school-domein `https://locra.jouwschool.nl`).
   - **Application description:** (Optioneel) `CodeMatch IDE integratie voor Locra`.
   - **Authorization callback URL:** **Let goed op!** Dit moet exact zijn:  
     `{JOUW_DOMEIN}/api/codematch/github/callback`  
     *Voorbeeld lokaal:* `http://localhost:5173/api/codematch/github/callback`  
     *Voorbeeld productie:* `https://locra.jouwschool.nl/api/codematch/github/callback`
4. Klik op **"Register application"**.
5. Je ziet nu de **Client ID**.
6. Klik onder *Client secrets* op **"Generate a new client secret"** en kopieer deze geheime sleutel direct.

---

## 3. Instellen in het Locra Beheerderspaneel

1. Log in op Locra als beheerder.
2. Ga naar **Beheerder Dashboard** → **CodeMatch Instellingen** (`/admin/codematch`).
3. Schakel CodeMatch in (indien nog niet ingeschakeld).
4. Plak de **Client ID** en **Client Secret** in de respectievelijke velden.
5. *(Optioneel)* **Vereiste GitHub Organisatie**: Vul een GitHub organisatienaam in (bijv. `jouw-school-org`) als je wilt dat alleen leden van die organisatie toegang hebben tot CodeMatch.
6. *(Optioneel)* **Toegang & Rechten**: Bepaal of alle gebruikers toegang hebben, of selecteer specifieke klassen of groepen.
7. Klik op **"Wijzigingen Opslaan"**.

---

## 4. Oplossen van de fout: `The redirect_uri is not associated with this application`

Als een gebruiker bij het klikken op "Koppel met GitHub" deze melding van GitHub te zien krijgt:

> **"Be careful! The redirect_uri is not associated with this application."**

Betekent dit dat de callback URL die de browser meestuurt **niet letterlijk overeenkomt** met wat in de GitHub OAuth App staat ingesteld.

### Checklist:
1. **Host & Port:**  
   Als je Locra bezoekt via `http://localhost:5173`, moet in GitHub staan:  
   `http://localhost:5173/api/codematch/github/callback`  
   *(Niet `http://127.0.0.1:5173/...` en niet poort `6000` of `3000`).*
2. **Protocol:**  
   Gebruik je `http://` of `https://`? Dit moet exact overeenkomen.
3. **Productie / Cloudflare Tunnel:**  
   Als je via een tunnel of publiek domein werkt (bijv. `https://mijnlocra.trycloudflare.com`), moet ook in GitHub `https://mijnlocra.trycloudflare.com/api/codematch/github/callback` ingevuld staan.

---

## 5. Veiligheid & Tokens

- De client secret en GitHub user tokens worden versleuteld opgeslagen in de database.
- Bij het uitloggen of ontkoppelen kan de gebruiker op elk moment met één klik de GitHub koppeling verbreken via de knop "Ontkoppel GitHub" in de CodeMatch IDE.
