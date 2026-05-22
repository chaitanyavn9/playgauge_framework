/**
 * Gauge lifecycle hooks — wires Playwright browser + ObservabilityCollector
 * for every scenario. Persists results to DB and Allure after each test.
 */

import { BeforeSuite, AfterSuite, BeforeScenario, AfterScenario, DataStoreFactory, ExecutionContext } from 'gauge-ts';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { EnvLoader } from '../utils/EnvLoader';
import { ObservabilityCollector, TestMeta } from '../observability/ObservabilityCollector';
import { AllureObservabilityReporter } from '../observability/AllureObservabilityReporter';
import { TestRunRepository } from '../db/TestRunRepository';
import { logger } from '../utils/Logger';
import * as dotenv from 'dotenv';

dotenv.config();

const env    = EnvLoader.load();
const repo   = new TestRunRepository();
const RUN_ID = process.env.RUN_ID ?? `run_${Date.now()}`;

let browser: Browser;
let context: BrowserContext;
let page:    Page;
let obs:     ObservabilityCollector;

export default class Hooks {

  // ─── Suite hooks ─────────────────────────────────────────────────────────────

  @BeforeSuite()
  async beforeSuite(): Promise<void> {
    logger.info(`playgauge_framework starting — env=${env.envName}, runId=${RUN_ID}`);
    browser = await chromium.launch({ headless: env.headless });
  }

  @AfterSuite()
  async afterSuite(): Promise<void> {
    await browser?.close();
    logger.info('playgauge_framework suite complete');
  }

  // ─── Scenario hooks ───────────────────────────────────────────────────────────

  @BeforeScenario()
  async beforeScenario(): Promise<void> {
    context = await browser.newContext({
      baseURL:           env.baseURL,
      viewport:          { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    obs = new ObservabilityCollector(page, env);
    obs.attach();

    // Make page + obs available to step implementations via Gauge DataStore
    const store = DataStoreFactory.getScenarioDataStore();
    store.put('page', page);
    store.put('obs',  obs);
    store.put('env',  env);
  }

  @AfterScenario()
  async afterScenario(executionContext: ExecutionContext): Promise<void> {
    // Entire hook is wrapped — nothing here must ever crash the gauge runner.
    try {
      // ── Determine pass / fail from Gauge's own ExecutionContext ───────────────
      const scenarioResult = executionContext.getCurrentScenario();
      const isFailed       = scenarioResult?.getIsFailing() ?? false;
      const testStatus: 'passed' | 'failed' = isFailed ? 'failed' : 'passed';

      // ── Extract real error message + stack trace from the failing step ────────
      const failedStep        = isFailed ? executionContext.getCurrentStep() : null;
      const failureMessage    = failedStep?.getErrorMessage()  ?? '';
      const failureStackTrace = failedStep?.getStacktrace()    ?? executionContext.getStacktrace() ?? '';

      if (isFailed) {
        logger.debug(`[hooks] Failure captured — message: "${failureMessage.slice(0, 120)}"`);
      }

      // ── Capture full-page screenshot on failure ───────────────────────────────
      let screenshotBase64: string | undefined;
      if (isFailed && page) {
        try {
          const buf = await page.screenshot({ fullPage: true });
          screenshotBase64 = buf.toString('base64');
        } catch { /* ignore screenshot errors */ }
      }

      // ── Read spec + scenario names from ExecutionContext ─────────────────────
      const specInfo     = executionContext.getCurrentSpec();
      const rawSpecFile  = specInfo?.getFileName() ?? '';
      // Convert absolute path → relative (e.g. specs/saucedemo/login.md)
      const specFile     = rawSpecFile
        ? path.relative(process.cwd(), rawSpecFile)
        : 'unknown.md';
      const specName     = specInfo?.getName()  ?? specFile;
      const scenarioName = scenarioResult?.getName() ?? 'unknown';

      const meta: TestMeta = {
        spec:              specFile,
        test:              scenarioName,
        module:            specName,
        integrationFolder: specFile,
        testStatus,
        failureMessage,
        failureStackTrace,
        retryAttempt: 0,
        maxRetries:   0,
        screenshotBase64,
      };

      if (obs) {
        const features = obs.buildFailureFeatures(meta);

        // Attach to Allure (non-fatal)
        try {
          const allureReporter = new AllureObservabilityReporter(obs, env);
          await allureReporter.attachAll(features);
        } catch (err) {
          logger.warn('Allure attachment failed (non-fatal)', { error: (err as Error).message });
        }

        // Persist to DB — only when DB_ENABLED=true (CI/CD testrunner)
        if (env.dbEnabled) {
          try {
            await repo.save({
              features,
              apiCalls:       obs.getApiCalls(),
              consoleSignals: obs.getConsoleSignals(),
              environment:    env.envName,
              runId:          RUN_ID,
            });
          } catch (err) {
            logger.error('DB persist failed (non-fatal)', { error: (err as Error).message });
          }
        } else {
          logger.debug('DB_ENABLED=false — skipping database persistence (local run)');
        }
      }

    } catch (err) {
      // Safety net — log and continue so the gauge runner stays alive
      logger.error('[afterScenario] Unexpected error (non-fatal)', { error: (err as Error).message });
    } finally {
      // Cleanup always runs, even if the body above threw
      try { obs?.reset(); } catch { /* ignore */ }
      try { await context?.close(); } catch { /* ignore */ }
    }
  }
}
