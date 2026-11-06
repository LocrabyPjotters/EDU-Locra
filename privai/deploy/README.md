# 🖥️ Locra PrivAI™ — Eigen GPU Server Handleiding & Cluster Setup

Deze handleiding legt exact uit hoe jij jouw eigen GPU-servers inricht, opstart en verbindt met het Locra PrivAI™ platform.

---

## 🏗️ 1. Hardware-Architectuur

Voor de 3 officiële Nederlandse PrivAI™ modellen bevelen we de volgende serverindeling aan:

| Model ID | Model & Parameters | Rol / Doel | Aanbevolen Hardware | vLLM Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `locra-privai-fast` | **Mistral Small 24B Instruct** | Groene AI / Lage latency / Algemeen | 1× RTX 5090 (32GB) | `--gpu-memory-utilization 0.90 --max-model-len 16384` |
| `locra-privai-coder` | **Qwen 2.5 Coder 32B** | CodeMatch IDE & Programmeren | 1× RTX 5090 (32GB) | `--gpu-memory-utilization 0.90 --max-model-len 16384` |
| `locra-privai-pro` | **Llama 3.3 70B Dutch-Tuned** | Vlaggenschip / Essay Coach / RTTI | 2× RTX 5090 (64GB) | `--tensor-parallel-size 2 --gpu-memory-utilization 0.92` |

> [!TIP]
> **Startconfiguratie (1 fysieke server):**
> Je kunt beginnen met één server voorzien van 2× RTX 5090 (of 1× RTX 6000 Ada 96GB). Daarop kun je `locra-privai-fast` en `locra-privai-coder` gelijktijdig draaien, of `locra-privai-pro` met Tensor Parallel = 2.

---

## 🚀 2. Server Installatie (Binnen 5 Minuten)

### Stap 1: Kopieer de `privai/` map naar je server
```bash
scp -r privai/ user@jouw-server-ip:/opt/privai
```

### Stap 2: Voer het installatiescript uit op de server
```bash
cd /opt/privai/deploy
sudo bash server-setup.sh
```
Het script controleert automatisch:
- De NVIDIA Drivers via `nvidia-smi`
- Docker en Docker Compose
- De NVIDIA Container Toolkit (zodat Docker toegang heeft tot de GPU's)
- Het genereert een beveiligd `.env` bestand en start de containers.

---

## 🌐 3. Hoe communiceert alles met elkaars servers?

1. **Jouw GPU Server (`http://jouw-server-ip:4100` of `https://api.privai.locra.nl`)**:
   - Draait de **PrivAI Gateway** en **vLLM containers** in een afgeschermd intern Docker-netwerk (`privai-internal`).
   - vLLM poorten (8000, 8001, 8002) zijn **niet** openbaar bereikbaar van buitenaf, alleen via de Gateway.

2. **Centrale Interconnectie met Locra Backend (`api.rowmatch.nl`)**:
   - Wanneer een school of leerling een prompt stuurt met `Authorization: Bearer privai_live_...`:
     1. De PrivAI Gateway berekent de SHA-256 hash van de sleutel.
     2. De Gateway vraagt via `POST /api/privai/interconnect/verify-key` aan de centrale backend of het saldo toereikend is.
     3. Als het saldo positief is, streamt vLLM de tokens realtime via SSE terug naar de leerling.
     4. Na afloop meldt de Gateway via `POST /api/privai/interconnect/report-usage` de exacte tokenaantallen en kosten in Euro's.
     5. De centrale database schrijft het bedrag direct af van het schooltegoed.

3. **0 Bytes Prompt Logging**:
   - Noch de Nginx proxy, noch de PrivAI Gateway, noch vLLM slaat prompttekst op schijf op.
   - Na de streaming call wordt het werkgeheugen (RAM) cryptografisch gewist (RAM-scrub).

---

## 🧪 4. Testen & Verificatie

### Test 1: Healthcheck van de Gateway
```bash
curl http://localhost:4100/
```
Geeft terug: `status: operational`, `enclave: AMD-SEV-SNP`, `country: NL`.

### Test 2: Live Chat Prompt via de Gateway
```bash
curl -X POST http://localhost:4100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer privai_live_8f3d91c7b5204ef8a961023d8c11e40a" \
  -d '{
    "model": "locra-privai-fast",
    "messages": [{"role": "user", "content": "Hallo vanuit Amsterdam!"}],
    "stream": false
  }'
```

### Test 3: Status & Docker logs bekijken
```bash
# Bekijk de actieve containers
docker compose ps

# Volg realtime logs van de gateway
docker compose logs -f privai-gateway

# Volg vLLM GPU inference logs
docker compose logs -f vllm-fast
```
