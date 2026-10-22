@echo off
title Sistema Web Beneficio ZA - Control Operacional
color 0A
cd /d "%~dp0"

echo ======================================================================
echo           PLANTA BENEFICIO ZA - CONTROL OPERACIONAL Y MANTTO
echo ======================================================================
echo.
echo Iniciando servidor en http://localhost:3000 ...
echo El archivo Excel se sincronizara continuamente en:
echo   %~dp0exports\DATOS_CONSOLIDADOS_PLANTA.xlsx
echo.

start "" "http://localhost:3000"
node server.js
pause
