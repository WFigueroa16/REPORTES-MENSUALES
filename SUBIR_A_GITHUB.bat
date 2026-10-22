@echo off
title Subir Proyecto a GitHub - Beneficio ZA
color 0B
cd /d "%~dp0"

echo ======================================================================
echo             SUBIR SISTEMA BENEFICIO ZA A TU CUENTA DE GITHUB
echo ======================================================================
echo.
echo Pasos previos:
echo 1. Ve a https://github.com/new y crea un repositorio vacio.
echo 2. Copia el enlace HTTPS (ej: https://github.com/tu-usuario/nombre-repo.git)
echo.
echo ======================================================================
echo.

set /p REPO_URL="Pega aqui el enlace de tu repositorio de GitHub y presiona Enter: "

if "%REPO_URL%"=="" (
    echo.
    echo [ERROR] No ingresaste ningun enlace. Operacion cancelada.
    pause
    exit /b
)

echo.
echo [1/3] Configurando rama principal (main)...
git branch -M main

echo [2/3] Vinculando con tu repositorio remoto...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [3/3] Subiendo archivos y base de datos a GitHub...
echo (Si es la primera vez, se abrira una ventana de tu navegador para autorizar a GitHub)
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo   [EXITO] El proyecto se ha subido correctamente a tu GitHub!
    echo ======================================================================
    echo.
    echo Siguiente paso para ponerlo en linea 24/7 gratis:
    echo 1. Entra a https://dashboard.render.com
    echo 2. Clic en 'New +' -> 'Web Service'
    echo 3. Conecta tu repositorio y dale a 'Deploy'
    echo.
) else (
    echo.
    echo ======================================================================
    echo   [AVISO] Hubo un problema al subir a GitHub.
    echo   Verifica tu conexion o los permisos de tu cuenta de GitHub.
    echo ======================================================================
    echo.
)

pause
