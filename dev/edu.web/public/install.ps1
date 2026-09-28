# Locra EDU Auto-Installer voor Windows (PowerShell)
# Voer uit als Administrator in PowerShell:
#   irm https://edu-locra.pieteroosterling.online/install-edu.ps1 | iex

$ErrorActionPreference = "Continue"
$DefaultZipUrl = "https://edu-locra.pieteroosterling.online/locra-release.zip"
$ZipUrl = if ($args[0]) { $args[0] } else { $DefaultZipUrl }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Locra EDU Auto-Installer (Windows) - Versie 1.2         " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Stap 1: Afhankelijkheden ---
Write-Host "[1/6] Controleer vereiste software..." -ForegroundColor Yellow

function Check-Command($cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "  ❌  '$cmd' niet gevonden." -ForegroundColor Red
        return $false
    }
    Write-Host "  ✅  $cmd gevonden" -ForegroundColor Green
    return $true
}

if (-not (Check-Command "node")) {
    Write-Host "     Installeer Node.js via https://nodejs.org (v18 of nieuwer)" -ForegroundColor Red
    exit 1
}
if (-not (Check-Command "npm")) { exit 1 }

$nodeVersion = [int](node -e "process.stdout.write(process.version.replace('v','').split('.')[0])")
if ($nodeVersion -lt 18) {
    Write-Host "  ❌  Node.js v$nodeVersion gevonden, minimaal v18 vereist." -ForegroundColor Red
    Write-Host "     Upgrade via https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅  Node.js v$nodeVersion (OK)" -ForegroundColor Green

# PM2
if (-not (Get-Command "pm2" -ErrorAction SilentlyContinue)) {
    Write-Host "  📦  PM2 installeren..." -ForegroundColor Yellow
    npm install -g pm2 --silent
    Write-Host "  ✅  PM2 geïnstalleerd" -ForegroundColor Green
}

# --- Stap 2: Download ---
Write-Host ""
Write-Host "[2/6] Locra EDU pakket downloaden..." -ForegroundColor Yellow

$WorkDir = "locra-edu-install-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $WorkDir | Out-Null
Set-Location $WorkDir

Write-Host "  🌐  Download: $ZipUrl" -ForegroundColor Cyan
Invoke-WebRequest -Uri $ZipUrl -OutFile "locra-release.zip" -UseBasicParsing

Write-Host "  📦  Uitpakken..."
Expand-Archive -Path "locra-release.zip" -DestinationPath "." -Force
Remove-Item "locra-release.zip"
Write-Host "  ✅  Klaar" -ForegroundColor Green

Set-Location locra-release

# --- Stap 3: Backend ---
Write-Host ""
Write-Host "[3/6] Backend installeren..." -ForegroundColor Yellow
Set-Location server
npm install

$JwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$JwtRefresh = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
New-Item -ItemType Directory -Path "data" -Force | Out-Null

@"
NODE_ENV=production
PORT=4000
JWT_SECRET=$JwtSecret
JWT_REFRESH_SECRET=$JwtRefresh
DATABASE_URL=file:./data/locra-edu.db
"@ | Set-Content .env

Write-Host "  ✅  .env aangemaakt" -ForegroundColor Green

# --- Stap 4: Database ---
Write-Host ""
Write-Host "[4/7] Database migreren..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss 2>$null
Write-Host "  ✅  Database klaar" -ForegroundColor Green

# --- Stap 5: Frontend bouwen ---
Write-Host ""
Write-Host "[5/7] Frontend bouwen..." -ForegroundColor Yellow
Set-Location ..\client
npm install
npm run build
Write-Host "  ✅  Frontend gebouwd" -ForegroundColor Green

# --- Stap 6: PM2 ---
Write-Host ""
Write-Host "[6/7] Services starten via PM2..." -ForegroundColor Yellow
Set-Location ..

pm2 delete locra-edu-api 2>$null
pm2 delete locra-edu-client 2>$null

pm2 start server/dist/index.js --name "locra-edu-api" --interpreter node
pm2 serve client/dist 8080 --name "locra-edu-client" --spa
pm2 save

# --- Stap 7: Autostart ---
Write-Host ""
Write-Host "[7/7] Autostart instellen..." -ForegroundColor Yellow
# PM2 autostart op Windows
npx pm2-startup install 2>$null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ✅  Locra EDU installatie geslaagd!" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐  Web Client  →  http://localhost:8080" -ForegroundColor Cyan
Write-Host "  🔌  API Server  →  http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Open http://localhost:8080 in je browser en voltooi" -ForegroundColor White
Write-Host "  de Setup Wizard met je Locra EDU-licentiesleutel." -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
