# playgauge_framework — Best Practices Guide

> A practical reference for writing maintainable, readable, and robust automation code
> using the Component Model pattern inside `playgauge_framework`.

---

## Table of Contents

1. [Gauge Spec Files (`.md`)](#1-gauge-spec-files-md)
2. [Step Implementation Files](#2-step-implementation-files)
3. [Thin Page Files](#3-thin-page-files)
4. [Component Scripts](#4-component-scripts)
5. [Hooks (`hooks.ts`)](#5-hooks-hooksts)
6. [Test Data Management](#6-test-data-management)
7. [Observability & Telemetry](#7-observability--telemetry)
8. [AI Analyzer Integration](#8-ai-analyzer-integration)
9. [General TypeScript Conventions](#9-general-typescript-conventions)
10. [What Goes Where — Quick Reference](#10-what-goes-where--quick-reference)

---

## 1. Gauge Spec Files (`.md`)

Spec files are the **single source of truth** for what is being tested. They must be readable by a non-technical business stakeholder without any explanation.

### Location

```
tests/specs/<module>/
  login.md
  dashboard.md
  admin.md
```

### Rules

**DO**
- Write steps in plain, business-facing English.
- Use concrete values inline, not vague placeholders: `"Login as Admin with password admin123"` not `"Login as a user"`.
- Tag every spec file AND every scenario. Use module-level tags (`@orangehrm`) and granularity tags (`@smoke`, `@regression`, `@login`).
- Keep one scenario per logical user journey. Avoid 30-step monsters.
- Use Gauge tables for data-driven scenarios. Keep the table inside the spec, not hidden in a JSON file.

**DON'T**
- Don't reference CSS selectors, XPaths, or technical IDs in spec steps.
- Don't write steps that only make sense to the automation engineer.
- Don't write `And I click the button` — be specific: `And I click the Login button`.
- Don't duplicate steps across scenarios. If setup is repeated, use a `Before` step or shared context steps.

### Good example

```markdown
# OrangeHRM Admin Login
tags: orangehrm, smoke

## Login with valid credentials
tags: login, smoke
* Open the OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "admin123"
* Verify the OrangeHRM dashboard is displayed
* The welcome message should contain "Admin"

## Login with wrong password
tags: login, regression, negative
* Open the OrangeHRM login page
* Login to OrangeHRM as "Admin" with password "wrongpass"
* Verify the login error message "Invalid credentials"
```

### Bad example

```markdown
## Test 1
* Open page
* Click login
* Check result          ← too vague, no value to stakeholders
```

---

## 2. Step Implementation Files

Step implementation files wire Gauge step text to TypeScript code via `@Step` decorators.

### Location

```
tests/step-implementations/<module>/
  orangehrm.steps.ts
  saucedemo.steps.ts
```

### Rules

**DO**
- One file per module. Keep it focused.
- Use lazy factory functions to get `page`, `obs`, and `env` from `DataStore.ScenarioDataStore`. Never store them as module-level variables — Gauge reuses the module between scenarios.
- Delegate ALL UI interactions to the page object or component — never call `page.locator()` or `page.click()` directly inside a step.
- Keep step functions short: 3–10 lines. If a step function is longer, the logic belongs in the page or component.
- Match the step text exactly (case-sensitive, including angle-bracket parameters).

**DON'T**
- Don't import raw Playwright locators into step files.
- Don't share state between steps via module-level variables — use `DataStore.ScenarioDataStore`.
- Don't `console.log()` in steps — use `logger.debug()` or `logger.info()`.
- Don't add `await page.waitForTimeout(2000)` — that's a flakiness time-bomb.
- Don't build multi-step assertions in one step implementation — split them.

### Good example

```typescript
import { Step, DataStore } from 'gauge-ts';
import { Page } from 'playwright';
import { ObservabilityCollector } from '../observability/ObservabilityCollector';
import { OrangeLoginPage } from '../pages/orangehrm/OrangeLoginPage';
import { logger } from '../utils/Logger';

// ── Lazy factory helpers ───────────────────────────────────────────────────────
// Always retrieve from DataStore — never cache at module level.
const getPage = (): Page => DataStore.ScenarioDataStore.get('page') as Page;
const getObs  = (): ObservabilityCollector =>
  DataStore.ScenarioDataStore.get('obs') as ObservabilityCollector;
const loginPage = () => new OrangeLoginPage(getPage(), getObs());

// ── Steps ─────────────────────────────────────────────────────────────────────

@Step('Open the OrangeHRM login page')
async function openLoginPage(): Promise<void> {
  await loginPage().open();
}

@Step('Login to OrangeHRM as <username> with password <password>')
async function loginAs(username: string, password: string): Promise<void> {
  await loginPage().loginAs(username, password);
}

@Step('Verify the OrangeHRM dashboard is displayed')
async function verifyDashboard(): Promise<void> {
  await loginPage().verifyDashboardVisible();
}
```

### Bad example

```typescript
@Step('Login to OrangeHRM as <username> with password <password>')
async function loginAs(username: string, password: string): Promise<void> {
  const page = DataStore.ScenarioDataStore.get('page') as Page;
  // ❌ Raw Playwright code in a step — should be in a component
  await page.locator('#txtUsername').fill(username);
  await page.locator('#txtPassword').fill(password);
  await page.locator('.oxd-button').click();
  await page.waitForTimeout(2000); // ❌ hard wait
}
```

---

## 3. Thin Page Files

Page files are thin orchestrators. They compose components and expose business-facing methods. They contain **zero raw locators**.

### Location

```
tests/pages/<module>/
  OrangeLoginPage.ts
  OrangeDashboardPage.ts
  SauceDemoProductsPage.ts
```

### Rules

**DO**
- Extend `BasePage`.
- Instantiate components in the constructor (or lazily in methods if the component is conditional).
- Expose one method per user action or assertion: `loginAs()`, `verifyDashboardVisible()`, `navigateToModule()`.
- Pass `obs` (ObservabilityCollector) to each component so telemetry is captured automatically.
- Set `obs.setCurrentPage('LoginPage')` at the start of the `open()` method so API calls are attributed to the right page in reports.

**DON'T**
- Don't call `page.locator()`, `page.click()`, `page.fill()` directly in a page file.
- Don't duplicate selector strings across page methods — they belong in the component.
- Don't put assertion logic in page files — use the component's `assertVisible()` / `assertText()` methods.
- Don't make page methods do more than one thing. `loginAndVerifyDashboard()` is two methods: `loginAs()` and `verifyDashboardVisible()`.

### Good example

```typescript
import { Page }                    from 'playwright';
import { BasePage }                from '../BasePage';
import { ObservabilityCollector }  from '../../observability/ObservabilityCollector';
import { LoginFormComponent }      from '../../components/orangehrm/LoginFormComponent';
import { AlertComponent }          from '../../components/common/AlertComponent';

export class OrangeLoginPage extends BasePage {
  private readonly loginForm:  LoginFormComponent;
  private readonly alertBox:   AlertComponent;

  constructor(page: Page, obs: ObservabilityCollector) {
    super(page, obs);
    this.loginForm = new LoginFormComponent(page, obs);
    this.alertBox  = new AlertComponent(page, obs);
  }

  async open(): Promise<void> {
    this.obs.setCurrentPage('OrangeHRM_Login');
    await this.page.goto('/web/index.php/auth/login');
    await this.loginForm.assertVisible();
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.loginForm.fillUsername(username);
    await this.loginForm.fillPassword(password);
    await this.loginForm.submit();
  }

  async verifyDashboardVisible(): Promise<void> {
    await this.page.waitForURL('**/dashboard/index');
  }

  async verifyErrorMessage(expected: string): Promise<void> {
    await this.alertBox.assertContainsText(expected);
  }
}
```

### Bad example

```typescript
export class OrangeLoginPage {
  constructor(private page: Page) {}

  async loginAs(username: string, password: string): Promise<void> {
    // ❌ Raw locators in a page file
    await this.page.locator('#txtUsername').fill(username);
    await this.page.locator('#txtPassword').fill(password);
    await this.page.locator('.oxd-button[type="submit"]').click();
    // ❌ Assertion logic + navigation in the same method
    await this.page.waitForURL('**/dashboard/index');
    await expect(this.page.locator('.oxd-topbar-header')).toBeVisible();
  }
}
```

---

## 4. Component Scripts

Components are the lowest-level UI interaction layer. Every button, input, table, modal, and sidebar is a component. They extend `BaseComponent` and encapsulate all raw Playwright locators.

### Location

```
tests/components/
  common/
    InputComponent.ts
    ButtonComponent.ts
    AlertComponent.ts
    ModalComponent.ts
  orangehrm/
    LoginFormComponent.ts
    AdminTableComponent.ts
  saucedemo/
    ProductCardComponent.ts
    CartComponent.ts
```

### Rules

**DO**
- Extend `BaseComponent`.
- Use `{ automationId }` locator strategy when the app supports `data-automation-id` / `data-testid` attributes. Fall back to `{ css }` only when automation IDs are unavailable.
- Accept `LocatorStrategy` in the constructor so the locator is configurable — this makes components reusable across multiple pages.
- Expose focused, named methods: `fill(value)`, `click()`, `assertVisible()`, `assertText(expected)`, `getText()`.
- Keep each method to one responsibility.
- Throw descriptive assertion errors — include the component name and the expected value.

**DON'T**
- Don't put any business logic in a component — it belongs in the page.
- Don't duplicate component logic. If two pages need a search box, write `SearchComponent` once and reuse it.
- Don't use `page.waitForTimeout()` — use `waitFor()` with a state: `{ state: 'visible' }`.
- Don't access `DataStore` inside a component — components receive everything they need via the constructor.
- Don't use raw `page.locator(...)` strings that contain fragile CSS class names like `.oxd-input-active`. Use stable attributes.

### LocatorStrategy preference order

| Priority | Strategy | When to use |
|---|---|---|
| 1 | `{ automationId: 'login-btn' }` | App has `data-automation-id` attributes |
| 2 | `{ testId: 'login-btn' }` | App has `data-testid` attributes |
| 3 | `{ locator: page.getByRole('button', { name: 'Login' }) }` | Semantic role available |
| 4 | `{ css: '.oxd-button--main' }` | No stable attribute, but class is stable |
| 5 | `{ xpath: '//button[text()="Login"]' }` | Last resort only |

### Good example

```typescript
import { Page }                    from 'playwright';
import { BaseComponent }           from '../BaseComponent';
import { ObservabilityCollector }  from '../../observability/ObservabilityCollector';

export class InputComponent extends BaseComponent {
  constructor(
    page: Page,
    obs:  ObservabilityCollector,
    locator: { automationId?: string; testId?: string; css?: string },
  ) {
    super(page, obs, locator);
  }

  async fill(value: string): Promise<void> {
    const el = await this.resolveLocator();
    await el.waitFor({ state: 'visible' });
    await el.clear();
    await el.fill(value);
  }

  async getValue(): Promise<string> {
    const el = await this.resolveLocator();
    return el.inputValue();
  }

  async assertValue(expected: string): Promise<void> {
    const actual = await this.getValue();
    if (actual !== expected) {
      throw new Error(
        `InputComponent: expected value "${expected}" but got "${actual}"`,
      );
    }
  }
}
```

### Bad example

```typescript
export class LoginFormComponent {
  // ❌ Raw page reference without obs — no telemetry
  constructor(private page: Page) {}

  async login(username: string, password: string): Promise<void> {
    // ❌ Hardcoded fragile CSS selectors
    await this.page.locator('input[name="username"]').fill(username);
    await this.page.locator('input[name="password"]').fill(password);
    // ❌ Business logic (where to go after login) doesn't belong in a component
    await this.page.locator('.submit-btn').click();
    await this.page.waitForURL('**/dashboard');
    await this.page.waitForTimeout(1500); // ❌ hard wait
  }
}
```

---

## 5. Hooks (`hooks.ts`)

The `@BeforeScenario` / `@AfterScenario` hooks are the framework's backbone. Treat them carefully.

### Rules

**DO**
- Always pass `executionContext: ExecutionContext` to `@AfterScenario`. This is how the real Playwright error message and stack trace are captured.
- Read `executionContext.currentScenario.isFailed` to determine pass/fail — do not rely on a DataStore key.
- Capture screenshots only on failure (`isFailed === true`), not on every run.
- Guard DB writes behind `env.dbEnabled` — local developers must not need a running Postgres instance.
- Call `obs.reset()` and `await context.close()` unconditionally at the end of `@AfterScenario` — even if an error occurred earlier.
- Use `logger.error()` with `try/catch` around DB and external calls so a failing persist doesn't abort the test run.

**DON'T**
- Don't read `failureMessage` from `DataStore` — it was never populated. Always use `ExecutionContext`.
- Don't open a new browser context inside hooks beyond what `@BeforeScenario` does.
- Don't import and use `DataStore` for pass/fail state. `ExecutionContext` is authoritative.
- Don't call `process.exit()` inside hooks — let Gauge handle lifecycle.

### AfterScenario pattern

```typescript
@AfterScenario()
async function afterScenario(executionContext: ExecutionContext): Promise<void> {
  const scenarioResult  = executionContext.currentScenario;
  const isFailed        = scenarioResult.isFailed;
  const failedStep      = isFailed ? scenarioResult.failedStep : null;
  const failureMessage  = failedStep?.errorMessage   ?? '';
  const failureStackTrace = failedStep?.stackTrace   ?? '';

  // ... screenshot, TestMeta, features, allure, DB ...
}
```

---

## 6. Test Data Management

### Rules

**DO**
- Store environment-specific credentials in `env/<envname>/default.properties`.
- Use Gauge table parameters for small data-driven sets (2–10 rows) — keep data in the spec.
- Use CSV files at `tests/data/<module>/` for large data sets (11+ rows).
- Use JSON fixtures at `tests/data/<module>/` for structured API payloads or complex objects.
- Access `env` via `DataStore.ScenarioDataStore.get('env') as FrameworkEnv` in step implementations.

**DON'T**
- Never hardcode passwords, tokens, or usernames in `.ts` files.
- Never commit `.env` files to Git. Use `.env.example` as a template.
- Never commit real PII or production data, even in test fixtures.
- Never share test accounts that also exist in production.
- Never put test data inside component or page files.

### Data access pattern

```typescript
// In a step implementation file:
const env = DataStore.ScenarioDataStore.get('env') as FrameworkEnv;
await loginPage().loginAs(env.username, env.password);
```

```properties
# env/default/default.properties
USERNAME = Admin
PASSWORD = admin123
BASE_URL = https://opensource-demo.orangehrmlive.com
```

---

## 7. Observability & Telemetry

`ObservabilityCollector` is attached in `@BeforeScenario` and captures browser signals automatically. You do not need to write any extra code in steps or pages to enable it.

### Rules

**DO**
- Call `obs.setCurrentPage('PageName')` at the start of each page's `open()` method so that API calls, console errors, and network failures are correctly attributed to the right page in the Allure report.
- Read `obs.getApiCalls()`, `obs.getConsoleSignals()`, `obs.getNetworkFailures()` only in hooks — not in steps or components.
- Use observability data during failure triage — the Allure report embeds all telemetry automatically.
- Set `OBSERVABILITY_ENABLED=false` in your `.env` if you need to debug a locator issue without noise in the log.

**DON'T**
- Don't call `obs.reset()` inside a step — it is called once per scenario in `@AfterScenario`.
- Don't add manual `console.log` for request/response data — the collector captures it automatically.
- Don't rely on `obs` state between scenarios — it resets on every run.

### Setting the current page

```typescript
// In a Page class open() method:
async open(): Promise<void> {
  this.obs.setCurrentPage('OrangeHRM_Admin');
  await this.page.goto('/web/index.php/admin/viewAdminModule');
}
```

---

## 8. AI Analyzer Integration

### Rules

**DO**
- Configure `AI_PROVIDER`, `AI_API_KEY`, and `AI_MODEL` in your CI secrets — never in committed files.
- Use `AI_PROVIDER=anthropic` with `claude-3-5-sonnet-20241022` for the most accurate analysis (vision + strong reasoning).
- Use `AI_PROVIDER=openai-compatible` with `AI_BASE_URL=http://localhost:11434/v1` and a local Ollama model for cost-free local testing of the analyzer itself.
- Let `failureStackTrace` flow through automatically — it is captured in `@AfterScenario` from `ExecutionContext` and requires no manual code.
- Review AI suggestions as a starting point — validate against the actual code before acting.

**DON'T**
- Don't hardcode API keys in `.env` files committed to Git.
- Don't run `npm run ai:analyze` without a valid `RUN_ID` — it will process the wrong failures.
- Don't disable screenshot capture for failed tests — it is a critical vision signal for the AI.
- Don't ignore the AI confidence score — if it is below `0.6`, the reasoning should be treated as a hint rather than a conclusion.
- Don't install `openai` or `@google/generative-ai` globally — they are `optionalDependencies` installed on-demand.

---

## 9. General TypeScript Conventions

### Naming

| Artifact | Convention | Example |
|---|---|---|
| Component class | `PascalCase` + `Component` suffix | `LoginFormComponent` |
| Page class | `PascalCase` + `Page` suffix | `OrangeLoginPage` |
| Step file | `camelCase.steps.ts` | `orangehrm.steps.ts` |
| Spec file | `camelCase.md` | `orangeHrmLogin.md` |
| Env property file | `default.properties` | `env/orangehrm/default.properties` |
| Test data folder | `<module>/` | `tests/data/orangehrm/` |

### File structure within a step implementation

```typescript
// 1. Imports (gauge-ts, playwright, local)
// 2. Lazy factory helpers (getPage, getObs, loginPage, etc.)
// 3. Step definitions — grouped by feature area with comments
```

### Error messages

Always include the component name, the expected value, and the actual value in assertion errors:

```typescript
// Good
throw new Error(`AdminTableComponent: expected row count >= 1 but got 0`);

// Bad
throw new Error('Table is empty');
```

### Avoid magic strings

Extract repeated strings (selectors, URLs, role names) into named constants at the top of the component or page file:

```typescript
const DASHBOARD_URL_PATTERN = '**/dashboard/index';
const LOGIN_BUTTON_SELECTOR  = { automationId: 'btn-login' };
```

---

## 10. What Goes Where — Quick Reference

| You want to... | Put it in... |
|---|---|
| Describe a user journey in plain English | Gauge spec file `.md` |
| Wire a step phrase to code | Step implementation file `.steps.ts` |
| Orchestrate UI actions for a page | Thin Page file `Page.ts` |
| Interact with a UI element (fill, click, assert) | Component class `Component.ts` |
| Share state between steps in one scenario | `DataStore.ScenarioDataStore` |
| Configure URLs, credentials, thresholds | `env/<env>/default.properties` |
| Store data for data-driven tests (small) | Gauge table in the spec file |
| Store data for data-driven tests (large) | CSV/JSON in `tests/data/<module>/` |
| Capture browser events automatically | `ObservabilityCollector` (already wired) |
| Set the page name for telemetry attribution | `obs.setCurrentPage('...')` in `open()` |
| Access error message when a test fails | `ExecutionContext.currentScenario.failedStep.errorMessage` in hooks |
| Classify a test failure using AI | `AIAnalyzer.analyzeRunBatch(runId)` — runs automatically in CI |

---

## Summary: The One-Sentence Rule per Layer

- **Spec** — *What* the user does, in plain English.
- **Step implementation** — *Bridges* the phrase to a page method. No Playwright code.
- **Page file** — *Composes* components. No raw locators.
- **Component** — *Wraps* a single UI element or widget. The only place raw Playwright locators are allowed.
- **Hook** — *Manages* the browser lifecycle and captures telemetry/failures.
- **ObservabilityCollector** — *Listens* to browser events silently. No test code calls it directly.
- **AI Analyzer** — *Reads* the failure data and tells you why it failed.
