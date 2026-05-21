/**
 * EnvLoader — reads Gauge environment property files and merges them
 * with process.env. Resolution order (highest wins):
 *   process.env  >  env/<GAUGE_ENV>/default.properties  >  env/default/default.properties
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
  aiProvider: string;   // 'anthropic' | 'openai' | 'gemini' | 'openai-compatible'
  aiModel: string;      // model identifier, empty = use provider default
  aiBaseURL: string;    // required for openai-compatible providers

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
    // Resolve ${ENV_VAR} references
    result[key] = value.replace(/\$\{(\w+)\}/g, (_, v) => process.env[v] ?? '');
  }
  return result;
}

function get(props: Record<string, string>, key: string, fallback = ''): string {
  return process.env[key] ?? props[key] ?? fallback;
}

export class EnvLoader {
  private static cache: FrameworkEnv | null = null;

  static load(): FrameworkEnv {
    if (this.cache) return this.cache;

    const gaugeEnv = process.env.GAUGE_ENV ?? 'dev';
    const root     = path.resolve(__dirname, '../../env');

    const defaultProps = parseProperties(path.join(root, 'default', 'default.properties'));
    const envProps     = parseProperties(path.join(root, gaugeEnv,   'default.properties'));
    const merged       = { ...defaultProps, ...envProps };

    const baseURL    = get(merged, 'BASE_URL', 'http://localhost:3000');
    const apiBaseURL = get(merged, 'API_BASE_URL', baseURL);

    const rawRegex = get(merged, 'OBS_API_PATH_REGEX', '(/api/|/rest/|/v1/|/v2/)');
    let obsApiPathRegex: RegExp;
    try {
      obsApiPathRegex = new RegExp(rawRegex.replace(/^\/|\/$/g, ''), 'i');
    } catch {
      obsApiPathRegex = /\/api\//i;
    }

    this.cache = {
      envName:      get(merged, 'ENV_NAME', gaugeEnv),
      baseURL,
      port:         get(merged, 'PORT', ''),
      apiBaseURL,

      username:     get(merged, 'USERNAME', ''),
      password:     get(merged, 'PASSWORD', ''),

      pageLogin:     get(merged, 'PAGE_LOGIN',     '/login'),
      pageDashboard: get(merged, 'PAGE_DASHBOARD', '/dashboard'),
      pageUsers:     get(merged, 'PAGE_USERS',     '/admin/users'),
      pageReports:   get(merged, 'PAGE_REPORTS',   '/reports'),
      pageSettings:  get(merged, 'PAGE_SETTINGS',  '/settings'),

      loginApi:       get(merged, 'LOGIN_API',        '/api/v1/auth/login'),
      userListApi:    get(merged, 'USER_LIST_API',     '/api/v1/users'),
      userDetailApi:  get(merged, 'USER_DETAIL_API',   '/api/v1/users/{id}'),
      logoutApi:      get(merged, 'LOGOUT_API',        '/api/v1/auth/logout'),
      healthCheckApi: get(merged, 'HEALTH_CHECK_API',  '/api/v1/health'),

      headless: get(merged, 'HEADLESS', 'true') !== 'false',
      browser:  get(merged, 'BROWSER', 'chromium'),

      observabilityEnabled:      get(merged, 'OBSERVABILITY_ENABLED',       'true') !== 'false',
      observabilityAttachAllure: get(merged, 'OBSERVABILITY_ATTACH_ALLURE', 'true') !== 'false',
      slowApiThresholdMs:        parseInt(get(merged, 'SLOW_API_THRESHOLD_MS', '1500'), 10),
      obsDetailLimit:            parseInt(get(merged, 'OBS_DETAIL_LIMIT',      '20'),   10),
      obsApiPathRegex,

      allureResultsDir: get(merged, 'ALLURE_RESULTS_DIR', 'allure-results'),
      screenshotDir:    get(merged, 'SCREENSHOT_DIR',      'dist/screenshots'),

      // AI Provider
      aiProvider: get(merged, 'AI_PROVIDER', 'anthropic').toLowerCase(),
      aiModel:    get(merged, 'AI_MODEL',    ''),
      aiBaseURL:  get(merged, 'AI_BASE_URL', ''),

      // Database
      dbEnabled:  get(merged, 'DB_ENABLED', 'false') === 'true',
      dbHost:     get(merged, 'DB_HOST',     'localhost'),
      dbPort:     parseInt(get(merged, 'DB_PORT', '5432'), 10),
      dbName:     get(merged, 'DB_NAME',     'playgauge'),
      dbUser:     get(merged, 'DB_USER',     'playgauge_user'),
      dbPassword: get(merged, 'DB_PASSWORD', ''),
      dbPoolMax:  parseInt(get(merged, 'DB_POOL_MAX', '5'), 10),

      // Grafana
      grafanaEnabled: get(merged, 'GRAFANA_ENABLED', 'false') === 'true',
      grafanaUrl:     get(merged, 'GRAFANA_URL', 'http://localhost:3001'),
    };

    return this.cache;
  }

  /** Force reload — useful when switching environments in tests */
  static reset(): void { this.cache = null; }
}
