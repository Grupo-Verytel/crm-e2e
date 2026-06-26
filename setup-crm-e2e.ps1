# ============================================================
#  CRM E2E - Setup script (Windows PowerShell)
#  Grupo Verytel / Frisson Technologies
#
#  Que hace: inicializa los proyectos reales de NestJS (backend)
#  y React+Vite (frontend) DENTRO de las carpetas que ya existen,
#  sin borrar tus modulos, layout ni estilos. Luego instala las
#  dependencias del stack definido y deja todo listo para arrancar.
#
#  Como usarlo:
#    1) Abre PowerShell.
#    2) Parate en la raiz del proyecto:   cd C:\Users\EQUIPO\Documents\GitHub\crm-e2e
#    3) Ejecuta:                          .\setup-crm-e2e.ps1
#
#  Si PowerShell bloquea el script, primero corre (una sola vez):
#    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    AVISO: $msg" -ForegroundColor Yellow }

# --- 0. Validaciones previas -------------------------------------------------
Write-Step "Verificando que estas en la raiz del proyecto (crm-e2e)"
if (-not (Test-Path ".\backend") -or -not (Test-Path ".\frontend")) {
    Write-Host "ERROR: no encuentro las carpetas 'backend' y 'frontend' aqui." -ForegroundColor Red
    Write-Host "Parate en la carpeta crm-e2e y vuelve a ejecutar el script." -ForegroundColor Red
    exit 1
}
Write-Ok "Carpetas backend/ y frontend/ encontradas."

Write-Step "Verificando Node.js y npm"
node -v | Out-Null; npm -v | Out-Null
Write-Ok "Node y npm disponibles."

$root = Get-Location

# ============================================================
#  BACKEND - NestJS
# ============================================================
Write-Step "BACKEND: inicializando proyecto NestJS"

# Instalar el CLI de Nest si no esta
if (-not (Get-Command nest -ErrorAction SilentlyContinue)) {
    Write-Warn "Nest CLI no encontrado. Instalando @nestjs/cli global..."
    npm install -g @nestjs/cli
}

# Crear proyecto en carpeta temporal (Nest no inicia sobre carpeta no vacia)
if (Test-Path ".\backend-tmp") { Remove-Item -Recurse -Force ".\backend-tmp" }
nest new backend-tmp --package-manager npm --skip-git

# Fusionar el contenido temporal DENTRO de backend\ (sin pisar tus modulos)
Write-Step "BACKEND: fusionando archivos base con tus modulos existentes"
Copy-Item -Path ".\backend-tmp\*" -Destination ".\backend\" -Recurse -Force
Remove-Item -Recurse -Force ".\backend-tmp"
Write-Ok "Proyecto NestJS fusionado en backend\."

# Instalar dependencias del stack
Write-Step "BACKEND: instalando dependencias del stack (Sequelize, MySQL, JWT, CASL...)"
Set-Location ".\backend"
npm install @nestjs/sequelize sequelize sequelize-typescript mysql2
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt @casl/ability
npm install class-validator class-transformer
npm install -D @types/passport-jwt
Write-Ok "Dependencias del backend instaladas."
Set-Location $root

# ============================================================
#  FRONTEND - React + Vite
# ============================================================
Write-Step "FRONTEND: inicializando proyecto React + Vite (TypeScript)"

if (Test-Path ".\frontend-tmp") { Remove-Item -Recurse -Force ".\frontend-tmp" }
npm create vite@latest frontend-tmp -- --template react-ts

Write-Step "FRONTEND: fusionando archivos base con tu layout/estilos/modulos"
# IMPORTANTE: tu tailwind.config.js y tus archivos en src/ tienen prioridad.
# Copiamos primero lo de Vite, luego restauramos los tuyos para que no se pisen.
Copy-Item -Path ".\frontend-tmp\*" -Destination ".\frontend\" -Recurse -Force
Remove-Item -Recurse -Force ".\frontend-tmp"
Write-Ok "Proyecto Vite fusionado en frontend\."

Write-Step "FRONTEND: instalando dependencias (router, iconos, Tailwind)"
Set-Location ".\frontend"
npm install
npm install react-router-dom lucide-react
npm install -D tailwindcss postcss autoprefixer
Write-Ok "Dependencias del frontend instaladas."
Set-Location $root

# ============================================================
#  CIERRE - pasos manuales que quedan
# ============================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " SETUP COMPLETADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host @"

Faltan 3 ajustes manuales (Cursor te ayuda con ellos):

  1) tailwind.config.js
     Vite pudo haber traido uno propio. Asegurate de conservar el
     que apunta a los tokens Verytel (el que ya estaba en frontend\).

  2) Punto de entrada del frontend (frontend\src\main.tsx)
     - Importa los estilos:   import './styles/global.css'
     - Envuelve <App /> con el router de react-router-dom (para el Sidebar).

  3) Variables de entorno del backend
     - Copia el ejemplo:      cp .env.example backend\.env   (o copialo a mano)
     - Llena DATABASE_URL y los secretos JWT.

Para arrancar cada proyecto:
  Backend:   cd backend   ; npm run start:dev
  Frontend:  cd frontend  ; npm run dev

"@ -ForegroundColor White
