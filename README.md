# playgauge_framework

> Enterprise-grade QA Automation Framework — **Playwright · Gauge · TypeScript · Allure · PostgreSQL · AI Failure Analysis**

Built using the **Component Model** design pattern for maximum reusability and minimum maintenance.  
Author: V N Chaitanya — Senior QA Automation Engineer

[![CI](https://github.com/chaitanyavn9/playgauge_framework/actions/workflows/ci.yml/badge.svg)](https://github.com/chaitanyavn9/playgauge_framework/actions)

---

## Table of Contents

1. [What Is This Framework?](#1-what-is-this-framework)
2. [Tech Stack](#2-tech-stack)
3. [Architecture at a Glance](#3-architecture-at-a-glance)
4. [Directory Structure](#4-directory-structure)
5. [Local Setup — No DB / Grafana Required](#5-local-setup--no-db--grafana-required)
6. [TestRunner / CI-CD Setup](#6-testrunner--ci-cd-setup)
7. [Running Tests — Tag-Based Execution](#7-running-tests--tag-based-execution)
8. [Standalone Playwright Tests](#8-standalone-playwright-tests)
9. [Where to Add New Tests](#9-where-to-add-new-tests)
10. [Test Data Management](#10-test-data-management)
11. [Reports — Local and CI/CD](#11-reports--local-and-cicd)
12. [AI Failure Analysis](#12-ai-failure-analysis)
13. [Grafana Dashboards](#13-grafana-dashboards)
14. [Environment Configuration Reference](#14-environment-configuration-reference)
15. [Dos and Donts](#15-dos-and-donts)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What Is This Framework?

`playgauge_framework` is a production-ready QA automation framework that:

- Writes human-readable BDD scenarios in **Gauge Markdown** (`.md` files) that non-technical stakeholders can read and review
- Executes those scenarios using **Playwright** for fast, reliable cross-browser automation
- Captures real-time **observability telemetry** — console errors, network failures, slow APIs, uncaught exceptions — automatically on every test run, with zero extra code in your steps
- Attaches rich **Allure reports** with observability data embedded into every scenario
- Optionally persists all telemetry to **PostgreSQL** for trend analysis and flaky test detection (CI only)
- Runs **AI-powered failure classification** via Claude (Anthropic) to categorise failures, suggest root causes, and generate human-readable analysis (CI only)
- Feeds metrics into **Grafana** dashboards for team-wide visibility (CI only)

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Test Runner | Gauge | BDD spec runner, Markdown-based |
| Browser Automation | Playwright | Cross-browser, fast, reliable |
| Language | TypeScript 5 | Type-safe test code |
| Design Pattern | Component Model | Reusable UI components, thin pages |
| Reporting | Allure | Rich HTML test reports |
| Observability | Custom (Playwright events) | Auto-captures telemetry per scenario |
| Database | PostgreSQL 15 | Telemetry storage — CI only |
| AI Analysis | Any AI provider (Claude, GPT-4o, Gemini, Groq, Ollama…) | Failure classification — CI only |
| Dashboards | Grafana | Team metrics — CI only |
| CI/CD | GitHub Actions | Nightly runs, Allure on GitHub Pages |

---

## 3. Architecture at a Glance

```
Gauge Spec (.md)
     |
     v
Step Implementation (.ts)        <- plain English step text -> TypeScript function
     | uses
     v
Page Object (thin orchestrator)  <- composes components, zero raw locators
     | composes
     v
Component (BaseComponent child)  <- InputComponent, ButtonComponent, DataTableComponent
     | wraps
     v
Playwright Locator               <- actual browser interaction
     | feeds
     v
ObservabilityCollector           <- auto-captures console/network/API events
     | reports to
     |-- Allure Report           <- always (local + CI)
     |-- PostgreSQL              <- CI only (DB_ENABLED=true)
     +-- AI Failure Analyser     <- CI only
```

---

## 4. Directory Structure

```
playgauge_framework/
|
|-- env/                                 # Gauge environment configs
|   |-- default/default.properties       # Base defaults (DB off, Grafana off)
|   |-- dev/default.properties           # Local dev (headless=false)
|   |-- staging/default.properties       # CI staging (headless=true, DB on)
|   |-- prod/default.properties          # CI prod (headless=true, DB on)
|   |-- saucedemo/default.properties     # SauceDemo demo (local)
|   +-- orangehrm/default.properties     # OrangeHRM demo (local)
|
|-- specs/                               # WRITE YOUR BDD SCENARIOS HERE
|   |-- saucedemo/
|   |   |-- login.md
|   |   +-- shopping.md
|   +-- orangehrm/
|       |-- login.md
|       +-- dashboard.md
|
|-- tests/
|   |-- components/                      # COMPONENT LIBRARY (reusable UI widgets)
|   |   |-- base/BaseComponent.ts        # Base class all components extend
|   |   |-- form/                        # Input, Button, Dropdown, Checkbox, Form
|   |   |-- data/                        # DataTable, Pagination, Search
|   |   |-- feedback/                    # Alert, Toast, Modal
|   |   |-- navigation/                  # NavBar, SideBar
|   |   +-- index.ts                     # Barrel export
|   |
|   |-- pages/                           # PAGE OBJECTS (thin orchestrators)
|   |   |-- BasePage.ts                  # navigate, assertUrl, takeScreenshot
|   |   |-- saucedemo/                   # SauceLoginPage, ProductsPage, CartPage
|   |   +-- orangehrm/                   # OrangeLoginPage, OrangeDashboardPage
|   |
|   |-- step-implementations/            # WIRE STEPS TO PAGES HERE
|   |   |-- hooks.ts                     # BeforeScenario/AfterScenario lifecycle
|   |   |-- saucedemo/saucedemo.steps.ts
|   |   +-- orangehrm/orangehrm.steps.ts
|   |
|   |-- observability/                   # Auto-telemetry (no editing needed)
|   |-- db/                              # DB layer — CI only
|   |-- ai-analyzer/                     # AI analysis — CI only
|   +-- utils/                           # EnvLoader, Logger
|
|-- playwright-tests/                    # STANDALONE PLAYWRIGHT SPECS (no Gauge)
|   |-- saucedemo/saucedemo.spec.ts
|   +-- orangehrm/orangehrm.spec.ts
|
|-- setup.sh                             # One-command setup (Linux/macOS)
|-- setup.bat                            # One-command setup (Windows)
|-- FRAMEWORK_WALKTHROUGH.html           # Visual framework guide (open in browser)
|-- playwright.config.ts
|-- tsconfig.json
|-- package.json
+-- gauge.config.js
```

---

## 5. Local Setup — No DB / Grafana Required

PostgreSQL and Grafana are **NOT required for local runs**.  
The framework automatically skips DB writes when `DB_ENABLED=false` (the default for all local environments).

### One-command setup

```bash
# macOS / Linux
chmod +x setup.sh
./setup.sh local

# Windows (run as Administrator)
setup.bat local
```

### Manual setup

Prerequisites: Node.js 18+, Git

```bash
# 1. Clone
git clone https://github.com/chaitanyavn9/playgauge_framework.git
cd playgauge_framework

# 2. Install npm dependencies
npm install

# 3. Install Playwright browsers
npx playwright install --with-deps chromium

# 4. Install Gauge CLI
npm install -g @getgauge/cli
gauge install js
gauge install html-report
gauge install allure
```

### Verify local setup

```bash
# SauceDemo smoke tests (browser opens visually)
npm run gauge:saucedemo

# Standalone Playwright (no Gauge required)
npx playwright test playwright-tests/saucedemo/
```

### What you get locally

- Browser opens and runs tests visually (headless=false for saucedemo/orangehrm envs)
- Gauge HTML report at `reports/html/index.html`
- Allure results in `allure-results/` — run `npm run allure:open` to view at localhost:5050
- Screenshots saved on failure in `dist/screenshots/`
- Winston log at `dist/logs/framework.log`
- No DB writes, no Grafana, no external service dependencies

---

## 6. TestRunner / CI-CD Setup

Enables the full stack: PostgreSQL, Allure history, AI Analyzer, Grafana.

### One-command setup

```bash
# Linux CI server
chmod +x setup.sh
./setup.sh testrunner

# Windows CI server (run as Administrator)
setup.bat testrunner
```

The script installs: Node.js, Playwright, Gauge, PostgreSQL, creates the `playgauge` database, runs migrations, installs Allure CLI, and configures Grafana.

### Required CI secrets (set in GitHub → Settings → Secrets)

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI Failure Analysis |
| `POSTGRES_HOST` | PostgreSQL host (localhost on self-hosted runner) |
| `POSTGRES_USER` | DB username |
| `POSTGRES_PASSWORD` | DB password |
| `GRAFANA_URL` | Grafana base URL |

### Activate DB for a custom environment

In `env/<envname>/default.properties`:

```properties
DB_ENABLED      = true
GRAFANA_ENABLED = true
DB_HOST         = ${POSTGRES_HOST}
DB_USER         = ${POSTGRES_USER}
DB_PASSWORD     = ${POSTGRES_PASSWORD}
```

---

## 7. Running Tests — Tag-Based Execution

Every spec file and scenario should be tagged. Tags enable selective execution.

### Tagging strategy

```markdown
# Login Tests
Tags: login, regression, saucedemo      <- spec-level tags (apply to all scenarios)

## Successful login
Tags: smoke                             <- scenario-level tag
```

### Available tags

| Tag | Scope | Description |
|---|---|---|
| `smoke` | Scenario | Critical path tests only |
| `regression` | Scenario | Full regression suite |
| `saucedemo` | Spec | All SauceDemo tests |
| `orangehrm` | Spec | All OrangeHRM tests |
| `login` | Spec | All login scenarios |
| `dashboard` | Spec | All dashboard scenarios |

### Execution commands

```bash
# Smoke only
gauge run --tags smoke specs/

# Full regression
gauge run --tags regression specs/

# Single application
gauge run --env saucedemo specs/saucedemo/
gauge run --env orangehrm specs/orangehrm/

# Smoke for one application
gauge run --env saucedemo --tags "smoke & saucedemo" specs/

# Specific spec file
gauge run specs/saucedemo/login.md

# Using npm scripts
npm run gauge:smoke
npm run gauge:regression
npm run gauge:saucedemo
npm run gauge:orangehrm
```

### Adding a new module tag

1. Add `Tags: mymodule, regression` at the top of your spec file
2. Run: `gauge run --tags mymodule specs/`

---

## 8. Standalone Playwright Tests

The `playwright-tests/` folder runs without Gauge. Useful for quick local debugging or environments where Gauge is not installed.

```bash
npx playwright test                                  # All tests
npx playwright test playwright-tests/saucedemo/     # SauceDemo only
npx playwright test playwright-tests/orangehrm/     # OrangeHRM only
npx playwright test --ui                             # Interactive UI mode
npx playwright test --debug                          # Debug mode
npx playwright test --grep "checkout flow"           # Filter by test name
```

---

## 9. Where to Add New Tests

### Step 1 — Write the scenario in a spec file

Add to or create `specs/<module>/myfeature.md`:

```markdown
# Password Reset
Tags: password-reset, regression

## User can reset password via email
Tags: smoke

* Open the login page
* Click "Forgot Password" link
* Enter email "test@example.com"
* Verify confirmation message is shown
```

### Step 2 — Implement the steps

Add to `tests/step-implementations/<module>/`:

```typescript
import { Step, DataStore } from 'gauge-ts';
import { MyPage } from '../../pages/mymodule/MyPage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';

function getPage() { return DataStore.ScenarioDataStore.get('page'); }
function getObs()  { return DataStore.ScenarioDataStore.get('obs') as ObservabilityCollector; }
function myPage()  { return new MyPage(getPage(), getObs()); }

@Step('Click "Forgot Password" link')
async function clickForgotPassword(): Promise<void> {
  await myPage().forgotPasswordLink.click();
}
```

### Step 3 — Create the Page Object

Add `tests/pages/<module>/MyPage.ts`:

```typescript
import { Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ObservabilityCollector } from '../../observability/ObservabilityCollector';
import { ButtonComponent, InputComponent } from '../../components';

export class MyPage extends BasePage {
  // Components declare all UI interactions — NO raw locators in the page itself
  readonly forgotPasswordLink = new ButtonComponent(
    this.page, this.obs,
    { css: 'a.forgot-password' },
    'Forgot Password Link',
  );

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
  }
}
```

### Step 4 — Run

```bash
gauge run --tags password-reset specs/mymodule/
```

---

## 10. Test Data Management

### Inline Gauge table parameters (small datasets)

```markdown
## Login fails for invalid users

* Login as "<username>" with password "<password>"
* Verify error message is shown

| username     | password   |
|--------------|------------|
| invalid_user | wrong_pass |
| ""           | secret     |
```

### CSV files (large datasets)

Store at `tests/data/<module>/mydata.csv`. Load via:

```typescript
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const rows = parse(
  fs.readFileSync('tests/data/saucedemo/customers.csv'),
  { columns: true }
);
```

### JSON fixtures (structured data)

Store at `tests/data/<module>/fixtures.json`. Preferred for API test payloads.

### Environment credentials

Always via `env/<envname>/default.properties`:
```properties
USERNAME = Admin
PASSWORD = admin123
```

Access in steps:
```typescript
const env = DataStore.ScenarioDataStore.get('env') as FrameworkEnv;
const username = env.username;
```

### What NOT to do with test data

- Never hardcode credentials in `.ts` files
- Never commit real production data or PII
- Never store secrets in JSON or CSV files checked into Git
- Never share test accounts that also exist in production

---

## 11. Reports — Local and CI/CD

### Local Gauge HTML report

Auto-generated after every Gauge run:
```
reports/html/index.html
```

### Local Allure report

```bash
npm run allure:generate   # generates allure-report/ folder
npm run allure:open       # serves at http://localhost:5050
```

### CI/CD Allure report

Published to GitHub Pages after every pipeline run.  
URL: `https://chaitanyavn9.github.io/playgauge_framework/`

### Sharing reports

| Scenario | Method |
|---|---|
| Latest CI run | Share GitHub Pages URL |
| Local run to team | `npm run allure:generate` then zip `allure-report/` |
| Live session | `npm run allure:open` then share via ngrok |
| Long-term trends | Grafana dashboard URL (CI environments) |

---

## 12. AI Failure Analysis

See `FRAMEWORK_WALKTHROUGH.html` Slide 13 for a full visual explanation.

### Running the AI Analyzer

```bash
# Triggered automatically in CI after the test run
# Can also run manually:
RUN_ID=run_1234567890 npm run ai:analyze
```

### What the AI sees for each failed test

The analyzer builds a 7-section prompt for every failure:

| # | Section | Content |
|---|---|---|
| 1 | Test Identity | Spec file, scenario name, module |
| 2 | **Error Details** | Real Playwright error message + first 10 lines of stack trace (from Gauge `ExecutionContext`) |
| 3 | Allure Execution Trace | Step-by-step pass/fail trace with durations |
| 4 | Failure Screenshot | Attached as a vision image (for GPT-4o / Claude 3 / Gemini 1.5+) |
| 5 | Observability Telemetry | Console errors, network failures, slow APIs, severity score |
| 6 | Historical Data | 30-day failure rate, flaky detection, past failure categories |
| 7 | Classification Task | 6-category rubric + required JSON response format |

> **Key improvement:** The error message and stack trace (Section 2) come directly from
> Gauge's `ExecutionContext.currentScenario.failedStep` in the `@AfterScenario` hook.
> This is the *exact* Playwright exception that caused the test to fail — not guessed
> from a DataStore field that was never populated. The AI sees the real root cause first.

### Failure categories

| Category | When used |
|---|---|
| `Automation Script Issue` | Selector broken, stale element, hardcoded wait, wrong locator |
| `Flaky Issue` | Passes sometimes, timing/race conditions, historically flaky |
| `Network / Infrastructure Issue` | API 4xx/5xx, connection timeout, DNS failure |
| `Product Issue` | App JS error, UI regression, assertion on correct selector fails |
| `Test Data Issue` | Missing/stale data, auth failure from data state |
| `Unclassified` | Insufficient data to determine category |

Each result includes a confidence score (0–1), a 2–4 sentence reasoning citing specific evidence, and three concrete actionable suggestions.

### Configuring the AI provider

Set these in your `.env` file or CI secrets:

```properties
# Choose your provider
AI_PROVIDER  = anthropic          # anthropic | openai | gemini | openai-compatible

# API key (or ANTHROPIC_API_KEY for backwards compatibility)
AI_API_KEY   = sk-ant-...

# Optional — uses provider default if omitted
AI_MODEL     = claude-3-5-sonnet-20241022

# Required only for openai-compatible (Groq, Ollama, Together, etc.)
AI_BASE_URL  = https://api.groq.com/openai/v1
```

**Vision support** (screenshot analysis) is automatic for Claude 3+, GPT-4o, and Gemini 1.5+. Non-vision providers receive a text note instead and a suggestion to upgrade.

---

## 13. Grafana Dashboards

Grafana is installed and configured only when running `./setup.sh testrunner`.

Access: `http://<testrunner-ip>:3001` (default: admin / playgauge_admin)

Available dashboards:
- Test Run Overview (pass/fail/flaky trends)
- Failure Categories (AI classification pie chart)
- Slow API Tracker (calls exceeding threshold)
- Console Error Frequency (top recurring JS errors)
- Observability Severity Heatmap

---

## 14. Environment Configuration Reference

| Property | Default | Description |
|---|---|---|
| `BASE_URL` | https://example.com | App URL |
| `HEADLESS` | true | Run headless |
| `BROWSER` | chromium | chromium / firefox / webkit |
| `OBSERVABILITY_ENABLED` | true | Auto-capture telemetry |
| `SLOW_API_THRESHOLD_MS` | 1500 | Flag APIs slower than this |
| `DB_ENABLED` | false | Enable PostgreSQL (CI only) |
| `GRAFANA_ENABLED` | false | Enable Grafana (CI only) |
| `ALLURE_RESULTS_DIR` | allure-results | Allure JSON output folder |
| `AI_PROVIDER` | anthropic | anthropic / openai / gemini / openai-compatible |
| `AI_API_KEY` | _(required in CI)_ | API key for chosen provider |
| `AI_MODEL` | _(provider default)_ | Model identifier — optional |
| `AI_BASE_URL` | _(required for openai-compatible)_ | Base URL for Groq / Ollama / Together etc. |

---

## 15. Dos and Donts

### DO

- Write scenario steps in plain English that non-technical stakeholders can read
- Keep pages as thin orchestrators — no raw CSS/XPath locators in page files
- Add all UI interactions inside a Component class extending `BaseComponent`
- Prefer `{ automationId }` locator strategy when the app supports it
- Tag every spec file AND every scenario
- Put credentials in `env/<envname>/default.properties`, never in code
- Run `npm run gauge:smoke` before raising a PR
- Keep `DB_ENABLED=false` for all local environments
- Use `ObservabilityCollector` data when diagnosing flaky tests

### DON'T

- Don't put `page.locator(...)` calls in step implementations
- Don't create page methods that duplicate component behaviour
- Don't commit `.env` files or credentials to Git
- Don't skip tagging — untagged scenarios can't be targeted for smoke/regression runs
- Don't use `page.waitForTimeout()` — use `waitForSelector`, `waitForURL`, or component assertions
- Don't install PostgreSQL or Grafana for local development
- Don't run `DB_ENABLED=true` without running `npm run db:migrate` first
- Don't hardcode test data inside step implementations

---

## 16. Troubleshooting

**gauge: command not found**
```bash
npm install -g @getgauge/cli
```

**Cannot find module '@pages/...'**
```bash
npm run build
```

**Playwright browser not found**
```bash
npx playwright install --with-deps chromium
```

**OrangeHRM tests timeout**  
Add to `env/orangehrm/default.properties`:
```properties
SLOW_API_THRESHOLD_MS = 5000
```

**DB schema not found (relation "test_runs" does not exist)**
```bash
npm run db:migrate
```

**AI Analyzer returns fallback category**  
Ensure the API key is exported:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run ai:analyze
```

---

## Quick Reference — npm Scripts

```bash
npm run gauge:saucedemo       # Run SauceDemo Gauge tests
npm run gauge:orangehrm       # Run OrangeHRM Gauge tests
npm run gauge:smoke           # Smoke-tagged tests only
npm run gauge:regression      # Full regression suite
npm run gauge:staging         # Staging environment run (CI)

npx playwright test                         # All standalone specs
npx playwright test playwright-tests/saucedemo/
npx playwright test --ui                    # Playwright UI mode

npm run allure:generate       # Generate Allure HTML report
npm run allure:open           # Serve at localhost:5050

npm run db:migrate            # Apply PostgreSQL schema (CI only)
npm run ai:analyze            # Run AI failure analysis (CI only)

npm run typecheck             # TypeScript check
npm run lint                  # ESLint check
npm run build                 # Full compile
```

---

*For a visual walkthrough, open `FRAMEWORK_WALKTHROUGH.html` in your browser.*
