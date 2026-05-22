/**
 * AllureSetup — writes one-time Allure metadata files before the suite runs:
 *
 *  • environment.properties  → Environment panel (browser, URL, env name…)
 *  • categories.json         → Categories panel (failure type classification)
 *  • executor.json           → Executors panel (local / GitHub Actions)
 *  • history/                → Trend panel (copied from previous report)
 *
 * Call writeAll() once in the BeforeSuite hook.
 */

import * as fs   from 'fs';
import * as path from 'path';
import { AllureRuntime, Status } from 'allure-js-commons';
import { FrameworkEnv } from '../utils/EnvLoader';
import { logger } from '../utils/Logger';

export class AllureSetup {
  private readonly resultsDir: string;
  private readonly runtime:    AllureRuntime;

  constructor(private readonly env: FrameworkEnv) {
    this.resultsDir = path.resolve(process.cwd(), env.allureResultsDir);
    this.runtime    = new AllureRuntime({ resultsDir: this.resultsDir });
  }

  /** Call once in BeforeSuite */
  writeAll(): void {
    try {
      fs.mkdirSync(this.resultsDir, { recursive: true });
      this.writeEnvironment();
      this.writeCategories();
      this.writeExecutor();
      this.restoreHistory();
      logger.debug('[AllureSetup] Allure metadata written');
    } catch (err) {
      logger.warn('[AllureSetup] Failed to write Allure metadata (non-fatal)', {
        error: (err as Error).message,
      });
    }
  }

  // ─── Environment ─────────────────────────────────────────────────────────────

  private writeEnvironment(): void {
    const info: Record<string, string> = {
      'Browser':        this.env.browser,
      'Headless':       String(this.env.headless),
      'Environment':    this.env.envName,
      'BASE_URL':       this.env.baseURL,
      'AI_Provider':    this.env.aiProvider,
      'DB_Enabled':     String(this.env.dbEnabled),
    };
    this.runtime.writeEnvironmentInfo(info);
  }

  // ─── Categories ──────────────────────────────────────────────────────────────
  // Each entry matches failed tests and groups them into meaningful buckets.
  // Priority failures (Critical / High / Medium / Low) are detected via the
  // test name containing the severity tag.

  private writeCategories(): void {
    const categories = [
      // ── Failure type ────────────────────────────────────────────────────────
      {
        name:            '🐛 Product Defects',
        matchedStatuses: [Status.FAILED] as Status[],
        messageRegex:    '.*(AssertionError|expect\\(|toHave|toBeVisible|toEqual|toContain|toBe\\().*',
      },
      {
        name:            '🔧 Test Issues',
        matchedStatuses: [Status.FAILED, Status.BROKEN] as Status[],
        messageRegex:    '.*(TimeoutError|locator\\..*|selector|Cannot read prop|is not a function|undefined is not).*',
      },
      {
        name:            '🌐 Infrastructure Issues',
        matchedStatuses: [Status.FAILED, Status.BROKEN] as Status[],
        messageRegex:    '.*(ECONNREFUSED|ENOTFOUND|ERR_CONNECTION|net::ERR|connect ETIMEDOUT|Network request failed).*',
      },
    ];
    this.runtime.writeCategoriesDefinitions(categories);
  }

  // ─── Executor ─────────────────────────────────────────────────────────────────

  private writeExecutor(): void {
    const isCI          = !!process.env.CI;
    const runNumber     = process.env.GITHUB_RUN_NUMBER ?? '';
    const repo          = process.env.GITHUB_REPOSITORY ?? '';
    const runId         = process.env.GITHUB_RUN_ID     ?? '';
    const serverUrl     = process.env.GITHUB_SERVER_URL ?? 'https://github.com';

    const executor = isCI
      ? {
          name:        'GitHub Actions',
          type:        'github',
          url:         `${serverUrl}/${repo}`,
          buildOrder:  parseInt(runNumber, 10) || 1,
          buildName:   `Run #${runNumber}`,
          buildUrl:    `${serverUrl}/${repo}/actions/runs/${runId}`,
          reportName:  'Allure Report',
        }
      : {
          name:       'Local',
          type:       'local',
          buildName:  `Local run — ${new Date().toLocaleString()}`,
          reportName: 'Allure Report',
        };

    const executorPath = path.join(this.resultsDir, 'executor.json');
    fs.writeFileSync(executorPath, JSON.stringify(executor, null, 2));
  }

  // ─── History (for Trend) ──────────────────────────────────────────────────────
  // Copies allure-report/history → allure-results/history so the next
  // generated report inherits the previous run's history data.

  private restoreHistory(): void {
    const reportDir  = path.resolve(process.cwd(), 'allure-report');
    const histSrc    = path.join(reportDir,        'history');
    const histDest   = path.join(this.resultsDir,  'history');

    if (!fs.existsSync(histSrc)) return;   // first-ever run — no history yet

    try {
      copyDirRecursive(histSrc, histDest);
      logger.debug('[AllureSetup] History restored for trend tracking');
    } catch (err) {
      logger.warn('[AllureSetup] Could not restore history (non-fatal)', {
        error: (err as Error).message,
      });
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
