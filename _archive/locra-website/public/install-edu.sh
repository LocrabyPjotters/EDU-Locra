#!/bin/bash
set -e

# === Locra EDU Auto-Installer ===
# Gebruik: bash install-edu.sh [OPTIONELE_ZIP_URL]
DEFAULT_ZIP_URL="https://edu-locra.pieteroosterling.online/locra-release.zip"
ZIP_URL="${1:-$DEFAULT_ZIP_URL}"

echo "============================================================"
echo "   Locra EDU Auto-Installer (Server & Client) — Versie 1.2  "
echo "============================================================"
echo ""

# --- Stap 1: Afhankelijkheden ---
echo "[1/7] Controleer vereiste software..."

fail() { echo "❌  $1"; exit 1; }

command -v node &> /dev/null || fail "Node.js niet gevonden. Installeer v18+ via https://nodejs.org"
command -v npm  &> /dev/null || fail "npm niet gevonden."
command -v unzip &> /dev/null || { command -v 7z &> /dev/null || fail "unzip niet gevonden: sudo apt install unzip"; }

NODE_MAJOR=$(node -e "process.stdout.write(process.version.replace('v','').split('.')[0])")
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js v$NODE_MAJOR gevonden, minimaal v18 vereist."
echo "  ✅  Node.js v${NODE_MAJOR}, npm $(npm --version)"

if ! command -v pm2 &> /dev/null; then
  echo "  📦  PM2 installeren..."
  npm install -g pm2 --silent && echo "  ✅  PM2 geïnstalleerd"
fi

# --- Stap 2: Download ---
echo ""
echo "[2/7] Locra EDU pakket downloaden..."

WORK_DIR="locra-edu-install-$(date +%s)"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo "  🌐  Download: $ZIP_URL"
if command -v curl &> /dev/null; then
  curl -fSL --progress-bar -o locra-release.zip "$ZIP_URL" || fail "Download mislukt. Controleer de URL en internetverbinding."
elif command -v wget &> /dev/null; then
  wget -q --show-progress -O locra-release.zip "$ZIP_URL" || fail "Download mislukt."
else
  fail "Geen curl of wget gevonden."
fi

echo "  📦  Uitpakken..."
if command -v unzip &> /dev/null; then
  unzip -q locra-release.zip
else
  7z x locra-release.zip -o. -y > /dev/null
fi
rm locra-release.zip
echo "  ✅  Klaar in $(pwd)"

# Ga de uitgepakte map in
cd locra-release

# --- Stap 3: Backend ---
echo ""
echo "[3/7] Backend installeren..."
cd server
npm install --silent

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
mkdir -p data

cat > .env << EOF
NODE_ENV=production
PORT=4000
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
DATABASE_URL=file:./data/locra-edu.db
EOF
echo "  ✅  .env aangemaakt"

# --- Stap 4: Database ---
echo ""
echo "[4/7] Database migreren..."
npx prisma generate --silent 2>/dev/null || true
npx prisma db push --accept-data-loss --skip-generate 2>/dev/null || npx prisma db push --accept-data-loss
echo "  ✅  Database klaar"

# --- Stap 5: Frontend bouwen ---
echo ""
echo "[5/8] Frontend bouwen..."
cd ../client
npm install --silent
npm run build
echo "  ✅  Frontend gebouwd"

# --- Stap 6: PM2 ---
echo ""
echo "[6/8] Services starten via PM2..."
cd ..

pm2 delete locra-edu-api 2>/dev/null || true

pm2 start server/dist/index.js --name "locra-edu-api" --interpreter node
pm2 save

# --- Stap 7: Autostart ---
echo ""
echo "[7/8] Autostart instellen..."
pm2 startup 2>/dev/null | tail -1 || echo "  ℹ️   Voer 'pm2 startup' uit als root voor autostart."

echo ""
echo "============================================================"
echo "  ✅  Locra EDU installatie geslaagd!"
echo ""
echo "  🌐  Locra EDU  →  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):4000"
echo ""
echo "  Open het adres in je browser en voltooi de Setup Wizard"
echo "  met je Locra EDU-licentiesleutel."
echo "============================================================"
