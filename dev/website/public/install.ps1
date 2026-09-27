# Locra Auto-Installer voor Windows (PowerShell)
# Voer uit als Administrator in PowerShell:
#   irm https://locra.pjotters.nl/install.ps1 | iex

$ErrorActionPreference = "Continue"
$DefaultZipUrl = "https://edu-locra.pieteroosterling.online/locra-release.zip"
$ZipUrl = if ($args[0]) { $args[0] } else { $DefaultZipUrl }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Locra Auto-Installer (Windows) - Versie 1.1             " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] Controleer vereiste software..." -ForegroundColor Yellow

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌  Node.js niet gevonden. Installeer via https://nodejs.org" -ForegroundColor Red; exit 1
}
$nodeVersion = [int](node -e "process.stdout.write(process.version.replace('v','').split('.')[0])")
if ($nodeVersion -lt 18) { Write-Host "  ❌  Node.js v$nodeVersion, minimaal v18 vereist." -ForegroundColor Red; exit 1 }
Write-Host "  ✅  Node.js v$nodeVersion" -ForegroundColor Green

if (-not (Get-Command "pm2" -ErrorAction SilentlyContinue)) {
    npm install -g pm2 --silent
    Write-Host "  ✅  PM2 geïnstalleerd" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/6] Locra pakket downloaden..." -ForegroundColor Yellow
$WorkDir = "locra-install-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $WorkDir | Out-Null
Set-Location $WorkDir
Invoke-WebRequest -Uri $ZipUrl -OutFile "locra-release.zip" -UseBasicParsing
Expand-Archive -Path "locra-release.zip" -DestinationPath "." -Force
Remove-Item "locra-release.zip"
Write-Host "  ✅  Klaar" -ForegroundColor Green

Set-Location locra-release

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
DATABASE_URL=file:./data/locra.db
"@ | Set-Content .env
Write-Host "  ✅  .env aangemaakt" -ForegroundColor Green

Write-Host ""
Write-Host "[4/6] Database migreren..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss 2>$null
Write-Host "  ✅  Database klaar" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Services starten via PM2..." -ForegroundColor Yellow
Set-Location ..
pm2 delete locra-api 2>$null; pm2 delete locra-client 2>$null
pm2 start server/dist/index.js --name "locra-api" --interpreter node
pm2 save
npx pm2-startup install 2>$null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ✅  Locra installatie geslaagd!" -ForegroundColor Green
Write-Host "  🌐  http://localhost:8080  —  open in je browser" -ForegroundColor Cyan
Write-Host "  Voltooi de Setup Wizard met je licentiesleutel." -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
