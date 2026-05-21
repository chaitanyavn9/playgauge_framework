@echo off
:: =============================================================================
:: setup.bat — playgauge_framework one-command setup (Windows)
::
:: Usage:
::   setup.bat local        :: Local dev — npm + Playwright + Gauge only
::   setup.bat testrunner   :: CI server — also installs PostgreSQL + Grafana
::
:: Run as Administrator when using testrunner mode.
:: =============================================================================

setlocal EnableDelayedExpansion

:: ─── Colour helpers (Windows 10+) ──────────────────────────────────────────
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

:: ─── Parse argument ─────────────────────────────────────────────────────────
set "MODE=%~1"
if "%MODE%"=="" goto usage
if /I "%MODE%"=="local" goto valid_mode
if /I "%MODE%"=="testrunner" goto valid_mode
goto usage

:usage
echo.
echo   Usage: setup.bat [local^|testrunner]
echo.
echo   local       -- npm + Playwright + Gauge only  (no DB, no Grafana)
echo   testrunner  -- full stack (npm + Playwright + Gauge + PostgreSQL + Grafana)
echo.
exit /b 1

:valid_mode

echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  playgauge_framework setup -- MODE: %MODE%%NC%
echo %GREEN%===========================================================%NC%

:: ─── Check for Chocolatey (package manager for Windows) ────────────────────
where choco >nul 2>&1
if %errorlevel% neq 0 (
  echo %YELLOW%[WARN]%NC%  Chocolatey not found. Installing Chocolatey...
  echo        (This requires Administrator privileges)
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
  if !errorlevel! neq 0 (
    echo %RED%[ERROR]%NC% Failed to install Chocolatey. Install manually from https://chocolatey.org
    exit /b 1
  )
  :: Reload path
  call refreshenv
)
echo %GREEN%[INFO]%NC%  Chocolatey found ✓

:: ─────────────────────────────────────────────────────────────────────────────
:: Node.js
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Node.js%NC%
echo %GREEN%===========================================================%NC%

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo %GREEN%[INFO]%NC%  Installing Node.js 20 via Chocolatey...
  choco install nodejs-lts -y
  call refreshenv
) else (
  for /f "delims=" %%v in ('node --version') do set NODE_VER=%%v
  echo %GREEN%[INFO]%NC%  Node.js !NODE_VER! found ✓
)

:: ─────────────────────────────────────────────────────────────────────────────
:: npm install
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  npm install%NC%
echo %GREEN%===========================================================%NC%

echo %GREEN%[INFO]%NC%  Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
  echo %RED%[ERROR]%NC% npm install failed. Check Node.js installation and try again.
  exit /b 1
)
echo %GREEN%[INFO]%NC%  npm install complete ✓

:: ─────────────────────────────────────────────────────────────────────────────
:: Playwright
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Playwright%NC%
echo %GREEN%===========================================================%NC%

echo %GREEN%[INFO]%NC%  Installing Playwright Chromium browser...
call npx playwright install --with-deps chromium
echo %GREEN%[INFO]%NC%  Playwright ✓

:: ─────────────────────────────────────────────────────────────────────────────
:: Gauge CLI
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Gauge CLI%NC%
echo %GREEN%===========================================================%NC%

where gauge >nul 2>&1
if %errorlevel% neq 0 (
  echo %GREEN%[INFO]%NC%  Installing Gauge CLI via Chocolatey...
  choco install gauge -y
  call refreshenv
) else (
  echo %GREEN%[INFO]%NC%  Gauge already installed ✓
)

echo %GREEN%[INFO]%NC%  Installing Gauge plugins...
gauge install js
gauge install html-report
gauge install allure
echo %GREEN%[INFO]%NC%  Gauge plugins ✓

:: ─────────────────────────────────────────────────────────────────────────────
:: Allure CLI
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Allure CLI%NC%
echo %GREEN%===========================================================%NC%

where allure >nul 2>&1
if %errorlevel% neq 0 (
  echo %GREEN%[INFO]%NC%  Installing Allure CLI...
  choco install allure -y 2>nul || call npm install -g allure-commandline
  call refreshenv
)
echo %GREEN%[INFO]%NC%  Allure ✓

:: ─────────────────────────────────────────────────────────────────────────────
:: .env file
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  .env file%NC%
echo %GREEN%===========================================================%NC%

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo %GREEN%[INFO]%NC%  Created .env from .env.example
  if /I "%MODE%"=="local" (
    echo %GREEN%[INFO]%NC%  Local run: no edits needed (DB_ENABLED=false by default)
  ) else (
    echo %YELLOW%[WARN]%NC%  IMPORTANT: Edit .env and set ANTHROPIC_API_KEY before AI analysis
  )
) else (
  echo %GREEN%[INFO]%NC%  .env already exists -- skipping
)

:: ─────────────────────────────────────────────────────────────────────────────
:: TESTRUNNER-ONLY: PostgreSQL + Grafana
:: ─────────────────────────────────────────────────────────────────────────────
if /I "%MODE%"=="local" goto done

echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  PostgreSQL 15 (testrunner only)%NC%
echo %GREEN%===========================================================%NC%

:: Set DB credentials (use environment variables or defaults)
if "%POSTGRES_USER%"=="" set "POSTGRES_USER=playgauge_user"
if "%POSTGRES_PASSWORD%"=="" set "POSTGRES_PASSWORD=playgauge_pass"
if "%POSTGRES_DB%"=="" set "POSTGRES_DB=playgauge"

where psql >nul 2>&1
if %errorlevel% neq 0 (
  echo %GREEN%[INFO]%NC%  Installing PostgreSQL 15 via Chocolatey...
  choco install postgresql15 --params "/Password:%POSTGRES_PASSWORD%" -y
  call refreshenv
  :: Add pg bin to path
  set "PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin"
) else (
  echo %GREEN%[INFO]%NC%  PostgreSQL already installed ✓
)

echo %GREEN%[INFO]%NC%  Creating database user and database...
:: Wait for PG to start
timeout /t 5 /nobreak >nul

psql -U postgres -c "CREATE USER %POSTGRES_USER% WITH PASSWORD '%POSTGRES_PASSWORD%';" 2>nul
psql -U postgres -c "CREATE DATABASE %POSTGRES_DB% OWNER %POSTGRES_USER%;" 2>nul
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE %POSTGRES_DB% TO %POSTGRES_USER%;" 2>nul
echo %GREEN%[INFO]%NC%  PostgreSQL database '%POSTGRES_DB%' ready ✓

echo %GREEN%[INFO]%NC%  Running database migrations...
set "PGHOST=localhost"
set "PGUSER=%POSTGRES_USER%"
set "PGPASSWORD=%POSTGRES_PASSWORD%"
set "PGDATABASE=%POSTGRES_DB%"
call npm run db:migrate
echo %GREEN%[INFO]%NC%  Database schema applied ✓

echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Grafana (testrunner only)%NC%
echo %GREEN%===========================================================%NC%

where grafana-server >nul 2>&1
if %errorlevel% neq 0 (
  echo %GREEN%[INFO]%NC%  Installing Grafana via Chocolatey...
  choco install grafana -y
  call refreshenv
  :: Start Grafana service
  net start Grafana 2>nul || echo %YELLOW%[WARN]%NC%  Could not auto-start Grafana service -- start manually
) else (
  echo %GREEN%[INFO]%NC%  Grafana already installed ✓
)
echo %GREEN%[INFO]%NC%  Grafana ✓
echo %GREEN%[INFO]%NC%  Access: http://localhost:3001 (default: admin / admin)
echo %YELLOW%[WARN]%NC%  IMPORTANT: After first login, add PostgreSQL datasource pointing at %POSTGRES_DB%

:: Update staging env to enable DB
echo %GREEN%[INFO]%NC%  Activating DB_ENABLED in staging env...
powershell -Command "(gc 'env\staging\default.properties') -replace 'DB_ENABLED.*=.*', 'DB_ENABLED = true' | sc 'env\staging\default.properties'"
powershell -Command "(gc 'env\staging\default.properties') -replace 'GRAFANA_ENABLED.*=.*', 'GRAFANA_ENABLED = true' | sc 'env\staging\default.properties'"
echo %GREEN%[INFO]%NC%  Staging env updated ✓

:done
:: ─────────────────────────────────────────────────────────────────────────────
:: Done
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo %GREEN%===========================================================%NC%
echo %GREEN%  Setup complete!%NC%
echo %GREEN%===========================================================%NC%
echo.

if /I "%MODE%"=="local" (
  echo   Next steps (local^):
  echo   1. Run SauceDemo smoke tests:
  echo      npm run gauge:saucedemo
  echo.
  echo   2. Run OrangeHRM tests:
  echo      npm run gauge:orangehrm
  echo.
  echo   3. Standalone Playwright tests:
  echo      npx playwright test playwright-tests\saucedemo\
  echo.
  echo   4. Open Allure report:
  echo      npm run allure:generate ^&^& npm run allure:open
  echo.
  echo   NO database or Grafana installation was performed.
) else (
  echo   Next steps (testrunner^):
  echo   1. Edit .env and set ANTHROPIC_API_KEY
  echo   2. Set CI secrets: POSTGRES_USER, POSTGRES_PASSWORD, GRAFANA_URL
  echo   3. Configure Grafana datasource at http://localhost:3001
  echo   4. Run regression suite:
  echo      set GAUGE_ENV=staging ^&^& npm run gauge:regression
  echo   5. Run AI analysis:
  echo      npm run ai:analyze
)

echo.
echo   See README.md for full documentation.
echo   Open FRAMEWORK_WALKTHROUGH.html for a visual guide.
echo.

endlocal
exit /b 0
