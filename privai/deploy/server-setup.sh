#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# 🔒 LOCRA PRIVAI™ — GPU SERVER INSTALLATIE & CLUSTER BOOTSTRAP SCRIPT
# Voor Ubuntu 22.04 / 24.04 LTS met NVIDIA GPU's (RTX 5090 / RTX 6000 Ada)
# ══════════════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   🔒 Locra PrivAI™ — Sovereign Dutch GPU Cluster Setup          ║"
echo "║   Equinix AM4, Science Park, Amsterdam (NL)                      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Controleer Root / Sudo
if [ "$EUID" -ne 0 ]; then
  echo "❌ Voer dit script uit als root of met sudo: sudo bash server-setup.sh"
  exit 1
fi

# 2. Controleer NVIDIA GPU
echo "🔍 [1/6] Controleren van NVIDIA GPU's..."
if ! command -v nvidia-smi &> /dev/null; then
  echo "⚠️ 'nvidia-smi' niet gevonden! Installeer eerst de officiële NVIDIA drivers:"
  echo "   sudo apt update && sudo apt install -y nvidia-driver-550 nvidia-utils-550"
  exit 1
fi

nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
echo "   ✓ NVIDIA Driver en GPU's gedetecteerd!"

# 3. Controleer Docker & Docker Compose
echo ""
echo "🐳 [2/6] Controleren van Docker..."
if ! command -v docker &> /dev/null; then
  echo "   ▸ Docker wordt geïnstalleerd..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
fi

# 4. Controleer NVIDIA Container Toolkit
echo ""
echo "⚙️ [3/6] Controleren van NVIDIA Container Toolkit..."
if ! dpkg -l | grep -q nvidia-container-toolkit; then
  echo "   ▸ NVIDIA Container Toolkit toevoegen..."
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
fi
echo "   ✓ NVIDIA Container Toolkit gereed voor vLLM!"

# 5. Configuratiebestand (.env) genereren
echo ""
echo "🔐 [4/6] PrivAI Interconnect & Model Licenties instellen..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "   Geef je Hugging Face User Access Token op (nodig voor Llama 3.3 gewichten):"
  read -p "   HF Token (hf_...): " HF_TOKEN_INPUT

  GEN_SECRET=$(openssl rand -hex 24)

  cat <<EOF > "$ENV_FILE"
# Locra PrivAI GPU Cluster Environment
NODE_ENV=production
PRIVAI_PORT=4100
LOCRA_BACKEND_URL=https://api.rowmatch.nl/api
PRIVAI_INTERCONNECT_SECRET=$GEN_SECRET
HUGGING_FACE_HUB_TOKEN=$HF_TOKEN_INPUT
EOF
  echo "   ✓ Nieuw .env bestand aangemaakt in $ENV_FILE"
else
  echo "   ✓ Bestaand .env bestand gevonden."
fi

# 6. Start Docker Compose Stack
echo ""
echo "🚀 [5/6] PrivAI Cluster containers opbouwen en starten..."
cd "$SCRIPT_DIR"
docker compose build privai-gateway
docker compose up -d

echo ""
echo "⏳ [6/6] Wachten op gezondheidsstatus..."
sleep 5

if curl -s http://127.0.0.1:4100/ > /dev/null; then
  echo "   ✅ PrivAI Gateway draait succesvol op http://localhost:4100!"
else
  echo "   ⚠️ Gateway start nog op. Controleer logs via: docker compose logs -f"
fi

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "🎉 LOCRA PRIVAI™ CLUSTER SUCCESVOL GESTART!"
echo "══════════════════════════════════════════════════════════════════"
echo "▸ Public Endpoint:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'jouw-server-ip')/v1"
echo "▸ Status & Health:  http://localhost:4100/"
echo "▸ Logs inzien:      docker compose logs -f privai-gateway"
echo "══════════════════════════════════════════════════════════════════"
