# 📱 Locra Mobile (iOS & Android)

Officiële mobiele applicatie voor **Locra** (voor Scholen & Educatie), gebouwd met **React Native + Expo SDK 52** in TypeScript.

---

## 🌟 Belangrijkste Functies

1. **🔗 Locra Connect (1-Klik Koppel QR)**:
   - Scan met de camera de QR-code vanaf het computerscherm (`Instellingen` ➔ `📱 Koppel App`).
   - Direct ingelogd binnen 1 seconde zonder server-URL of wachtwoord in te vullen.
2. **🏫 School Discovery**:
   - Zoek je school op naam of vul de unieke schoolcode in (bijv. `LOCRA-BERLAGE`).
   - De app haalt automatisch de juiste server-URL en schoolbranding op.
3. **🎨 Dynamische Schoolbranding**:
   - De app past automatisch de primaire en secundaire themakleuren en schoollogo aan op basis van de gekoppelde school.
4. **🧠 AI Chat & Nadenkmodus (Thinking)**:
   - Directe chat met de AI-assistent van de school.
   - Nadenk-knop (`🧠`) naast het invoervak voor diepgaande redenering bij moeilijke vragen.
   - Quizkaarten en interactieve oefenprompts.
5. **🔒 Biometrische Beveiliging**:
   - Optionele ontgrendeling met Face ID, Touch ID of Android vingerafdruk via `expo-local-authentication`.
6. **💾 Offline Caching**:
   - Eerder geladen gesprekken en lesstof blijven lokaal opgeslagen via `AsyncStorage` als de school-WiFi hapert.

---

## 🚀 Aan de slag (Ontwikkeling)

### 1. Vereisten
- Node.js 18+
- [Expo Go app](https://expo.dev/go) op je fysieke iPhone of Android-telefoon (gratis in de App Store / Play Store).

### 2. Afhankelijkheden installeren
Navigeer naar deze map en voer uit:

```bash
cd apps/locra-mobile
npm install
```

### 3. App starten
Start de Expo development server:

```bash
npm start
```

Er verschijnt een QR-code in de terminal.
- **iPhone**: Open de standaard Camera-app en richt op de QR-code om te openen in **Expo Go**.
- **Android**: Open de **Expo Go** app en kies *"Scan QR code"*.

---

## 📦 Productie Builds maken (EAS Build)

Met **Expo Application Services (EAS)** kun je direct kant-en-klare apps compileren in de cloud:

### EAS CLI installeren
```bash
npm install -g eas-cli
eas login
```

### Android APK bouwen (direct te installeren op telefoons)
```bash
eas build -p android --profile preview
```

### iOS TestFlight build maken
```bash
eas build -p ios --profile production
```

---

## 🛠️ API & Locra Connect Specificatie

De mobiele app communiceert met de volgende backend endpoints van Locra Core:

- `GET /api/connect/info`: Publieke schoolinformatie (naam, logo, huiskleuren, connectCode).
- `POST /api/connect/pair/create`: Gegenereerd door de webapp; maakt een beveiligd 5-minuten pairing token aan.
- `POST /api/connect/pair/claim`: Aangeroepen door de mobiele camera-scanner; wisselt de koppelcode in voor een permanent JWT auth-token.
- `GET /api/chat/conversations`: Haalt recente gesprekken op.
- `POST /api/chat/send`: Verstuurt vragen en levert AI-antwoorden met optionele `useThinkMode`.
