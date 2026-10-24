#!/usr/bin/env bash
set -e

echo "===================================="
echo "    Start Locra System Update...    "
echo "===================================="

git remote set-url origin https://github.com/LocrabyPjotters/EDU-Locra.git || true
echo "[1/5] Laatste updates ophalen van GitHub..."
git fetch origin main
git reset --hard origin/main

echo "[2/5] Dependencies installeren..."
npm install --no-audit --no-fund
if [ -d "server" ]; then
  (cd server && npm install --no-audit --no-fund)
fi
if [ -d "client" ]; then
  (cd client && npm install --no-audit --no-fund)
fi

echo "[3/5] Database schema synchroniseren..."
if [ -d "server" ]; then
  (cd server && npx prisma generate && npx prisma db push --accept-data-loss)
fi

echo "[4/5] Client en server compileren..."
if [ -d "server" ]; then
  (cd server && npm run build)
fi
if [ -d "client" ]; then
  (cd client && npm run build)
fi

echo "[5/5] Herstarten van applicatie..."
if command -v pm2 &> /dev/null; then
  pm2 restart all || true
  echo "[Info] PM2 processen herstart."
else
  echo "[Info] PM2 niet gedetecteerd."
fi

echo "===================================="
echo "    Locra Update Succesvol Voltooid! "
echo "===================================="
