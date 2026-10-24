@echo off
echo ====================================
echo     Start Locra System Update...
echo ====================================

if not exist ".git" (
    echo [Info] Git repository koppelen...
    git init
    git remote add origin https://github.com/LocrabyPjotters/EDU-Locra.git
)

echo [1/5] Laatste updates ophalen van GitHub...
git remote set-url origin https://github.com/LocrabyPjotters/EDU-Locra.git
git fetch origin main
git reset --hard origin/main

echo [2/5] Dependencies installeren...
call npm install --no-audit --no-fund
if exist "server" (
    cd server
    call npm install --no-audit --no-fund
    cd ..
)
if exist "client" (
    cd client
    call npm install --no-audit --no-fund
    cd ..
)

echo [3/5] Database schema bijwerken (Prisma)...
if exist "server" (
    cd server
    call npx prisma generate
    call npx prisma db push --accept-data-loss
    cd ..
)

echo [4/5] Client en server compileren...
if exist "server" (
    cd server
    call npm run build
    cd ..
)
if exist "client" (
    cd client
    call npm run build
    cd ..
)

echo [5/5] Applicatie herstarten...
where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    call pm2 restart all
    echo [Info] PM2 processen herstart.
) else (
    echo [Info] PM2 is niet actief. Start de applicatie opnieuw via start.bat of npm run dev.
)

echo ====================================
echo     Locra Update Succesvol Voltooid!
echo ====================================
