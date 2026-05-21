#!/usr/bin/env bash
# =============================================================================
# setup.sh — playgauge_framework one-command setup
#
# Usage:
#   ./setup.sh local        # Local dev — npm + Playwright + Gauge only
#   ./setup.sh testrunner   # CI server — also installs PostgreSQL + Grafana
#
# Requirements:
#   local:       bash, curl, Node.js 18+ (or nvm)
#   testrunner:  bash, curl, Node.js 18+, sudo access (for apt/brew)
# =============================================================================

set -euo pipefail

# ─── colour output ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
section() { echo -e "\n${GREEN}══════════════════════════════════════${NC}"; echo -e "${GREEN}  $*${NC}"; echo -e "${GREEN}══════════════════════════════════════${NC}"; }

# ─── parse argument ───────────────────────────────────────────────────────────
MODE="${1:-}"
if [[ "$MODE" != "local" && "$MODE" != "testrunner" ]]; then
  echo ""
  echo "  Usage: ./setup.sh [local|testrunner]"
  echo ""
  echo "  local       — installs npm, Playwright, Gauge only (no DB, no Grafana)"
  echo "  testrunner  — full stack (npm + Playwright + Gauge + PostgreSQL + Grafana)"
  echo ""
  exit 1
fi

section "playgauge_framework setup — MODE: $MODE"

# ─── OS detection ─────────────────────────────────────────────────────────────
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
else
  error "Unsupported OS: $OSTYPE. Use setup.bat on Windows."
fi
info "Detected OS: $OS"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — Node.js
# ─────────────────────────────────────────────────────────────────────────────
section "Node.js"

if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | tr -d 'v' | cut -d. -f1)
  if [[ "$NODE_VERSION" -lt 18 ]]; then
    warn "Node.js $NODE_VERSION found — version 18+ required. Installing via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
  else
    info "Node.js $(node --version) ✓"
  fi
else
  info "Installing Node.js 20 via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — npm dependencies
# ─────────────────────────────────────────────────────────────────────────────
section "npm install"
info "Installing npm dependencies..."
npm install
info "npm install complete ✓"

# ─── Install optional AI provider SDKs based on .env / environment ───────────
section "AI Provider SDK"
AI_PROVIDER="${AI_PROVIDER:-${AI_PROVIDER_ENV:-anthropic}}"
# Try reading from .env if it exists
if [[ -f ".env" ]]; then
  ENV_PROVIDER=$(grep -E '^AI_PROVIDER=' .env | cut -d= -f2 | tr -d ' "' || echo "")
  [[ -n "$ENV_PROVIDER" ]] && AI_PROVIDER="$ENV_PROVIDER"
fi

info "AI_PROVIDER = $AI_PROVIDER"

case "$AI_PROVIDER" in
  openai|openai-compatible)
    info "Installing openai npm package..."
    npm install openai
    ;;
  gemini)
    info "Installing @google/generative-ai npm package..."
    npm install @google/generative-ai
    ;;
  anthropic|"")
    info "Anthropic SDK already installed (@anthropic-ai/sdk is a core dependency)"
    ;;
  *)
    warn "Unknown AI_PROVIDER='$AI_PROVIDER'. If it is OpenAI-compatible run: npm install openai"
    ;;
esac
info "AI provider SDK ready ✓"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — Playwright
# ─────────────────────────────────────────────────────────────────────────────
section "Playwright"
info "Installing Playwright browsers..."
npx playwright install --with-deps chromium
info "Playwright ✓"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — Gauge CLI
# ─────────────────────────────────────────────────────────────────────────────
section "Gauge CLI"
if ! command -v gauge &>/dev/null; then
  info "Installing Gauge CLI..."
  if [[ "$OS" == "linux" ]]; then
    curl -SsL https://downloads.gauge.org/stable | sh
    export PATH="$HOME/.gauge/bin:$PATH"
  elif [[ "$OS" == "macos" ]]; then
    if command -v brew &>/dev/null; then
      brew install gauge
    else
      curl -SsL https://downloads.gauge.org/stable | sh
      export PATH="$HOME/.gauge/bin:$PATH"
    fi
  fi
else
  info "Gauge $(gauge --version | head -1) ✓"
fi

info "Installing Gauge plugins..."
gauge install js          2>/dev/null || warn "gauge-js plugin install failed — try manually: gauge install js"
gauge install html-report 2>/dev/null || warn "gauge html-report plugin install failed"
gauge install allure      2>/dev/null || warn "gauge allure plugin install failed"
info "Gauge plugins ✓"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — Allure CLI (local: optional, testrunner: required)
# ─────────────────────────────────────────────────────────────────────────────
section "Allure CLI"
if ! command -v allure &>/dev/null; then
  info "Installing Allure CLI..."
  if [[ "$OS" == "macos" ]] && command -v brew &>/dev/null; then
    brew install allure
  else
    # Use npm global install as fallback
    npm install -g allure-commandline
  fi
fi
info "Allure ✓"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — .env file
# ─────────────────────────────────────────────────────────────────────────────
section ".env file"
if [[ ! -f ".env" ]]; then
  cp .env.example .env
  info "Created .env from .env.example"
  if [[ "$MODE" == "local" ]]; then
    info "For local runs, no edits needed (DB_ENABLED=false by default)"
  else
    warn "IMPORTANT: Edit .env and set ANTHROPIC_API_KEY before running AI analysis"
  fi
else
  info ".env already exists — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TESTRUNNER-ONLY SECTIONS
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$MODE" == "testrunner" ]]; then

  # ─── PostgreSQL ─────────────────────────────────────────────────────────────
  section "PostgreSQL 15"

  PG_USER="${POSTGRES_USER:-playgauge_user}"
  PG_PASS="${POSTGRES_PASSWORD:-playgauge_pass}"
  PG_DB="${POSTGRES_DB:-playgauge}"

  if ! command -v psql &>/dev/null; then
    info "Installing PostgreSQL 15..."
    if [[ "$OS" == "linux" ]]; then
      sudo apt-get update -qq
      sudo apt-get install -y postgresql-15 postgresql-client-15
      sudo systemctl enable postgresql
      sudo systemctl start postgresql
    elif [[ "$OS" == "macos" ]]; then
      brew install postgresql@15
      brew services start postgresql@15
      export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
    fi
  else
    info "PostgreSQL already installed ✓"
  fi

  info "Creating database user and database..."
  if [[ "$OS" == "linux" ]]; then
    sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';" 2>/dev/null || warn "User $PG_USER may already exist"
    sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null || warn "Database $PG_DB may already exist"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;" 2>/dev/null
  elif [[ "$OS" == "macos" ]]; then
    psql postgres -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';" 2>/dev/null || warn "User may already exist"
    psql postgres -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null || warn "DB may already exist"
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;" 2>/dev/null
  fi
  info "PostgreSQL database '$PG_DB' ready ✓"

  info "Running database migrations..."
  PGHOST="${POSTGRES_HOST:-localhost}" \
  PGUSER="$PG_USER" \
  PGPASSWORD="$PG_PASS" \
  PGDATABASE="$PG_DB" \
  npm run db:migrate
  info "Database schema applied ✓"

  # ─── Grafana ─────────────────────────────────────────────────────────────
  section "Grafana"

  if ! command -v grafana-server &>/dev/null; then
    info "Installing Grafana..."
    if [[ "$OS" == "linux" ]]; then
      sudo apt-get install -y apt-transport-https software-properties-common wget 2>/dev/null
      sudo mkdir -p /etc/apt/keyrings/
      wget -q -O - https://apt.grafana.com/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
      echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
        | sudo tee /etc/apt/sources.list.d/grafana.list
      sudo apt-get update -qq
      sudo apt-get install -y grafana
      sudo systemctl enable grafana-server
      sudo systemctl start grafana-server
    elif [[ "$OS" == "macos" ]]; then
      brew install grafana
      brew services start grafana
    fi
  else
    info "Grafana already installed ✓"
  fi

  # Set default Grafana credentials (optional)
  info "Grafana installed ✓"
  info "Access: http://localhost:3001 (default: admin / admin — change on first login)"
  warn "IMPORTANT: After first login, add a PostgreSQL datasource pointing at host=localhost db=$PG_DB user=$PG_USER"

  # ─── Update env flags ────────────────────────────────────────────────────
  section "Activating DB and Grafana in staging env"
  STAGING_ENV="env/staging/default.properties"
  if [[ -f "$STAGING_ENV" ]]; then
    sed -i.bak 's/^DB_ENABLED.*$/DB_ENABLED = true/' "$STAGING_ENV" 2>/dev/null || true
    sed -i.bak 's/^GRAFANA_ENABLED.*$/GRAFANA_ENABLED = true/' "$STAGING_ENV" 2>/dev/null || true
    info "Staging env updated: DB_ENABLED=true, GRAFANA_ENABLED=true"
  fi

fi  # end testrunner block

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
section "Setup complete!"

if [[ "$MODE" == "local" ]]; then
  echo ""
  echo -e "  ${GREEN}Next steps (local):${NC}"
  echo "  1. Run SauceDemo smoke tests:"
  echo "     npm run gauge:saucedemo"
  echo ""
  echo "  2. Run OrangeHRM tests:"
  echo "     npm run gauge:orangehrm"
  echo ""
  echo "  3. Run standalone Playwright tests:"
  echo "     npx playwright test playwright-tests/saucedemo/"
  echo ""
  echo "  4. Open Allure report:"
  echo "     npm run allure:generate && npm run allure:open"
  echo ""
  echo "  NO database or Grafana installation was performed."
  echo "  DB_ENABLED=false in all local environments."
else
  echo ""
  echo -e "  ${GREEN}Next steps (testrunner):${NC}"
  echo "  1. Edit .env and set ANTHROPIC_API_KEY"
  echo "  2. Set CI secrets: POSTGRES_USER, POSTGRES_PASSWORD, GRAFANA_URL"
  echo "  3. Configure Grafana datasource: http://localhost:3001"
  echo "  4. Run a full test suite:"
  echo "     GAUGE_ENV=staging npm run gauge:regression"
  echo "  5. Run AI analysis after tests:"
  echo "     npm run ai:analyze"
  echo ""
fi

echo -e "  See ${GREEN}README.md${NC} for full documentation."
echo -e "  See ${GREEN}FRAMEWORK_WALKTHROUGH.html${NC} for visual guide."
echo ""
