/**
 * EnvLoader — reads Gauge environment property files and merges them
 * with process.env using two resolution strategies:
 *
 *  cfg()    — config values (HEADLESS, BASE_URL, BROWSER …)
 *             File wins: env/<PLAYGAUGE_ENV>/default.properties
 *                        > env/default/default.properties
 *             WHY: gauge overrides GAUGE_ENV to 'default' inside its own
 *             subprocess, and may inject default-env values into process.env,
 *             which would silently override env-specific settings (e.g.
 *             HEADLESS=false in saucedemo would be clobbered by the gauge-
 *             injected HEADLESS=true from the default env).
 *             PLAYGAUGE_ENV is set in npm scripts and is never touched by gauge.
 *
 *  secret() — CI-injected credentials (DB_PASSWORD, AI_API_KEY, USERNAME …)
 *             process.env wins (non-empty), file is the fallback.
 *             WHY: CI pipelines inject these as secrets; they must always
 *             override whatever is in the properties file.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FrameworkEnv {
  // Application
  envName: string;
  baseURL: string;
  port: string;
  apiBaseURL: string;

  // Credentials
  username: string;
  password: string;

  // Page URLs
  pageLogin: string;
  pageDashboard: string;
  pageUsers: string;
  pageReports: string;
  pageSettings: string;

  // API Endpoints
  loginApi: string;
  userListApi: string;
  userDetailApi: string;
  logoutApi: string;
  healthCheckApi: string;

  // Browser
  headless: boolean;
  browser: string;

  // Observability
  observabilityEnabled: boolean;
  observabilityAttachAllure: boolean;
  slowApiThresholdMs: number;
  obsDetailLimit: number;
  obsApiPathRegex: RegExp;

  // Reporting
  allureResultsDir: string;
  screenshotDir: string;

  // AI Provider
  aiProvider: string;
  aiModel: string;
  aiBaseURL: string;

  // Database (PostgreSQL) — optional, off by default for local runs
  dbEnabled: boolean;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPoolMax: number;

  // Grafana — optional, off by default
  grafanaEnabled: boolean;
  grafanaUrl: string;
}

// ─── Property file parser ─────────────────────────────────────────────────────

function parseProperties(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Resolve ${ENV_VAR} references so staging/prod can write BASE_URL = ${STAGING_URL}
    result[key] = value.replace(/\$\{(\w+)\}/g, (_, v) => process.env[v] ?? '');
  }
  return result;
}

// ─── Resolution helpers ───────────────────────────────────────────────────────

/**
 * Config resolution — file wins over process.env.
 * Prevents gauge's default-env injection from overriding env-specific values.
 */
function cfg(merged: Record<string, string>, key: string, fallback = ''): string {
  return merged[key] ?? fallback;
}

/**
 * Secret resolution — non-empty process.env wins, file is the fallback.
 * Allows CI to inject DB passwords / API keys without touching property files.
 */
function secret(merged: Record<string, string>, key: string, fallback = ''): string {
  const envVal = process.env[key];
  if (envVal !== undefined && envVal !== '') return envVal;
  return merged[key] ?? fallback;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export class EnvLoader {
  private static cache: FrameworkEnv | null = null;

  static load(): FrameworkEnv {
    if (this.cache) return this.cache;

    // PLAYGAUGE_ENV is set explicitly in every npm gauge:* script.
    // It is the only reliable way to know which environment is active inside
    // the gauge-ts subprocess (gauge overrides GAUGE_ENV to 'default').
    const activeEnv = process.env.PLAYGAUGE_ENV ?? process.env.GAUGE_ENV ?? 'default';
    const root      = path.resolve(__dirname, '../../env');

    const defaultProps = parseProperties(path.join(root, 'default', 'default.properties'));
    const envProps     = parseProperties(path.join(root, activeEnv, 'default.properties'));
    const merged       = { ...defaultProps, ...envProps };   // env-specific overrides default

    const baseURL    = cfg(merged, 'BASE_URL', 'http://localhost:3000');
    const apiBaseURL = cfg(merged, 'API_BASE_URL', baseURL);

    const rawRegex = cfg(merged, 'OBS_API_PATH_REGEX', '(/api/|/rest/|/v1/|/v2/)');
    let obsApiPathRegex: RegExp;
    try {
      obsApiPathRegex = new RegExp(rawRegex.replace(/^\/|\/$/g, ''), 'i');
    } catch {
      obsApiPathRegex = /\/api\//i;
    }

    this.cache = {
      // ── Application ──────────────────────────────────────────────────────────
      envName:      cfg(merged, 'ENV_NAME',      activeEnv),
      baseURL,
      port:         cfg(merged, 'PORT',          ''),
      apiBaseURL,

      // ── Credentials (CI secrets override file) ────────────────────────────────
      username:     secret(merged, 'USERNAME',   ''),
      password:     secret(merged, 'PASSWORD',   ''),

      // ── Page URLs ─────────────────────────────────────────────────────────────
      pageLogin:     cfg(merged, 'PAGE_LOGIN',     '/login'),
      pageDashboard: cfg(merged, 'PAGE_DASHBOARD', '/dashboard'),
      pageUsers:     cfg(merged, 'PAGE_USERS',     '/admin/users'),
      pageReports:   cfg(merged, 'PAGE_REPORTS',   '/reports'),
      pageSettings:  cfg(merged, 'PAGE_SETTINGS',  '/settings'),

      // ── API Endpoints ─────────────────────────────────────────────────────────
      loginApi:       cfg(merged, 'LOGIN_API',        '/api/v1/auth/login'),
      userListApi:    cfg(merged, 'USER_LIST_API',     '/api/v1/users'),
      userDetailApi:  cfg(merged, 'USER_DETAIL_API',   '/api/v1/users/{id}'),
      logoutApi:      cfg(merged, 'LOGOUT_API',        '/api/v1/auth/logout'),
      healthCheckApi: cfg(merged, 'HEALTH_CHECK_API',  '/api/v1/health'),

      // ── Browser ───────────────────────────────────────────────────────────────
      headless: cfg(merged, 'HEADLESS', 'true') !== 'false',
      browser:  cfg(merged, 'BROWSER',  'chromium'),

      // ── Observability ─────────────────────────────────────────────────────────
      observabilityEnabled:      cfg(merged, 'OBSERVABILITY_ENABLED',       'true') !== 'false',
      observabilityAttachAllure: cfg(merged, 'OBSERVABILITY_ATTACH_ALLURE', 'true') !== 'false',
      slowApiThresholdMs:        parseInt(cfg(merged, 'SLOW_API_THRESHOLD_MS', '1500'), 10),
      obsDetailLimit:            parseInt(cfg(merged, 'OBS_DETAIL_LIMIT',      '20'),   10),
      obsApiPathRegex,

      // ── Reporting ─────────────────────────────────────────────────────────────
      allureResultsDir: cfg(merged, 'ALLURE_RESULTS_DIR', 'allure-results'),
      screenshotDir:    cfg(merged, 'SCREENSHOT_DIR',      'dist/screenshots'),

      // ── AI Provider (key is a secret, provider/model are config) ──────────────
      aiProvider: cfg(merged,    'AI_PROVIDER', 'openai').toLowerCase(),
      aiModel:    cfg(merged,    'AI_MODEL',    ''),
      aiBaseURL:  cfg(merged,    'AI_BASE_URL', ''),

      // ── Database (all CI-injected — use secret()) ─────────────────────────────
      dbEnabled:  secret(merged, 'DB_ENABLED',  'false') === 'true',
      dbHost:     secret(merged, 'DB_HOST',     'localhost'),
      dbPort:     parseInt(secret(merged, 'DB_PORT', '5432'), 10),
      dbName:     secret(merged, 'DB_NAME',     'playgauge'),
      dbUser:     secret(merged, 'DB_USER',     'playgauge_user'),
      dbPassword: secret(merged, 'DB_PASSWORD', ''),
      dbPoolMax:  parseInt(secret(merged, 'DB_POOL_MAX', '5'), 10),

      // ── Grafana ───────────────────────────────────────────────────────────────
      grafanaEnabled: cfg(merged, 'GRAFANA_ENABLED', 'false') === 'true',
      grafanaUrl:     cfg(merged, 'GRAFANA_URL', 'http://localhost:3001'),
    };

    return this.cache;
  }

  /** Force reload — useful when switching environments in tests */
  static reset(): void { this.cache = null; }
}
