@echo off
echo ====================================
echo     Start Locra System Update...
echo ====================================

if exist "apps\locra-core" cd apps\locra-core

call npm run update

echo ====================================
echo     Locra Update Voltooid!
echo ====================================
