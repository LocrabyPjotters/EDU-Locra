# 🔒 Locra PrivAI™ — Sovereign Dutch Zero-Access AI-API

[![Sovereign NL](https://img.shields.io/badge/Datacenter-Amsterdam%20(NL)-0ea5e9.svg)](https://locra.nl)
[![Confidential Computing](https://img.shields.io/badge/Security-OpenPCC%20%2F%20AMD%20SEV--SNP-10b981.svg)](https://locra.nl/privai)
[![Zero Access](https://img.shields.io/badge/Zero%20Access-Cryptographically%20Guaranteed-8b5cf6.svg)](https://locra.nl/privai)
[![GDPR / AVG](https://img.shields.io/badge/AVG%20%2F%20GDPR-Art%2028%20%26%2032%20Compliant-emerald.svg)](https://locra.nl/privacy)

**Locra PrivAI™** is een soevereine, zelfstandige Nederlandse AI-API service. Het biedt een 1-op-1 drop-in vervanger voor commerciële API's zoals OpenAI (`/v1/chat/completions`) en Anthropic Claude (`/v1/messages`), maar draait volledig op eigen servers in Nederlandse datacenters (Amsterdam Science Park / Equinix AM4) met hardwarematige zero-access encryptie via OpenPCC / AMD SEV-SNP Confidential Computing.

---

## 🏛️ Waarom Locra PrivAI™?

1. **100% Nederlandse Bodem & Eigenaarschap**: Geen data-overdracht naar de VS of buitenlandse hyperscalers. Volledige Nederlandse en Europese rechtsmacht.
2. **Hardwarematige Zero-Access Encryptie (OpenPCC / TEE)**:
   - Het werkgeheugen (RAM) van de processor is hardwarematig versleuteld op de chip.
   - Zelfs met fysieke toegang tot de servers of met root/SSH rechten kan **niemand** (ook Locra als beheerder niet) prompts, antwoorden of persoonsgegevens inzien.
3. **Strikte Scheiding van Niet-Gevoelige Metadata**:
   - **Wat we wél registreren**: Tokenaantallen (voor facturatie/quota), latency (in ms) en het gekozen model.
   - **Wat we nóóit kunnen zien of opslaan**: 0 bytes van de prompt, completion, chatinhoud of persoonsgegevens.
4. **Zero-Retention Ephemeral Scrubber**:
   - Zodra de tokens zijn gestreamd, worden de geheugenbanken in het RAM cryptografisch overschreven en gewist.

---

## 🚀 Snelle Start

### 1. Gebruik met de officiële OpenAI Python SDK
Je hoeft alleen de `base_url` aan te passen:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.privai.locra.nl/v1",  # Of lokaal: http://localhost:4100/v1
    api_key="privai_live_8f3d91c7b5204ef8a961023d8c11e40a"
)

response = client.chat.completions.create(
    model="locra-privai-pro",
    messages=[
        {"role": "system", "content": "Je bent een didactische tutor volgens het RTTI-model."},
        {"role": "user", "content": "Help me de wet van behoud van energie te begrijpen."}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
```

### 2. Gebruik met de Anthropic Claude JavaScript / TypeScript SDK

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'https://api.privai.locra.nl',
  apiKey: 'privai_live_8f3d91c7b5204ef8a961023d8c11e40a'
});

const message = await anthropic.messages.create({
  model: 'locra-privai-pro',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Analyseer deze wiskundige stelling.' }]
});

console.log(message.content[0].text);
```

### 3. Gebruik via cURL

```bash
curl https://api.privai.locra.nl/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer privai_live_8f3d91c7b5204ef8a961023d8c11e40a" \
  -d '{
    "model": "locra-privai-pro",
    "messages": [
      {"role": "user", "content": "Wat is fotosynthese?"}
    ],
    "stream": false
  }'
```

---

## 🛡️ Remote Attestation (Verificatie van de Enclave)

Voordat je gevoelige verslagen of PTA-data verstuurt, kan jouw client de cryptografische hardware-handtekening controleren:

```bash
curl https://api.privai.locra.nl/v1/attestation
```

**Voorbeeld respons:**
```json
{
  "status": "verified",
  "attestation_report": {
    "enclaveId": "enclave-nl-amsterdam-79a8bc430291",
    "enclaveType": "AMD-SEV-SNP",
    "measurementHash": "LOCRA_PRIVAI_OPENPCC_ENCLAVE_V1.0_SOVEREIGN_NL_RUNTIME",
    "enclavePublicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "datacenter": {
      "country": "NL",
      "location": "Equinix AM4 (Science Park), Amsterdam",
      "jurisdiction": "Netherlands / EU GDPR Art 28/32"
    },
    "signature": "MEYCIQD..."
  }
}
```

---

## 📊 Niet-Gevoelige Metadata & Quota Dashboard

Inspecteer tokenverbruik en latency zonder dat er ooit chatinhoud wordt getoond:

```bash
curl https://api.privai.locra.nl/v1/usage \
  -H "Authorization: Bearer privai_live_..."
```

---

## 🇳🇱 Soevereine Modellen

| Model ID | Basismodel | Context | Hardware Versnelling | Toepassing |
| :--- | :--- | :--- | :--- | :--- |
| **`locra-privai-pro`** | Llama 3.3 70B (Dutch-Tuned) | 131.072 | AMD SEV-SNP / NVIDIA TEE | Hoogste denk- en redeneerniveau, RTTI-beoordeling |
| **`locra-privai-fast`** | Mistral Small 24B Sovereign | 32.768 | AMD SEV-SNP | Lage latency, Groene AI, interactieve lesvragen |
| **`locra-privai-coder`** | Qwen 2.5 Coder 32B | 65.536 | AMD SEV-SNP | CodeMatch IDE, Python, Web en informatica |

---

## 📦 Licentie & Veiligheid
© 2026 Locra Didactics B.V. Alle rechten voorbehouden.
Gecertificeerd conform AVG / GDPR, NEN 7510 / ISO 27001 en het Privacyconvenant Onderwijs v4.0.
