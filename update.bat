@echo off
echo ====================================
echo     Start Locra System Update...
echo ====================================

if not exist ".git" (
    echo [Info] Git repository koppelen...
    git init
    git remote add origin https://github.com/LocrabyPjotters/EDU-Locra.git
)

echo [1/4] Laatste updates ophalen van GitHub...
git fetch origin main
git reset --hard origin/main

echo [2/4] Dependencies installeren...
call npm install
call npm install --prefix server
call npm install --prefix client

echo [3/4] Database bijwerken...
cd server
call npx prisma generate
call npx prisma db push --accept-data-loss
cd ..

echo [4/4] Applicatie bouwen en herstarten...
call npm run build --prefix server
call npm run build --prefix client
call pm2 restart all

echo ====================================
echo     Locra Update Succesvol Voltooid!
echo ====================================

