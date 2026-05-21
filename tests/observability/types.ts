/** All observability types for playgauge_framework */

export type ObservabilitySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type FailureBucket =
  | 'NONE'
  | 'TIMEOUT'
  | 'ASSERTION'
  | 'SELECTOR_OR_STALE_ELEMENT'
  | 'NETWORK'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'RUNTIME_EXCEPTION'
  | 'UNKNOWN';

export type ConsoleLevel = 'error' | 'warn' | 'uncaught_exception';

export type ConsoleErrorType =
  | 'JS_RUNTIME_ERROR'
  | 'API_FAILURE'
  | 'RESOURCE_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'FRAMEWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | 'UNCAUGHT_EXCEPTION';

export type ConsoleWarnType =
  | 'DEPRECATION_WARNING'
  | 'PERFORMANCE_WARNING'
  | 'NETWORK_WARNING'
  | 'WARNING';

export type NetworkFailureType =
  | 'SERVER_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'AUTH_FAILURE'
  | 'CLIENT_ERROR'
  | 'UNKNOWN_NETWORK_ERROR';

// ─── Raw captured signals ────────────────────────────────────────────────────

export interface ConsoleSignal {
  message: string;
  type: ConsoleErrorType | ConsoleWarnType;
  level: ConsoleLevel;
  timestamp: number;
  page: string;
}

export interface NetworkFailure {
  url: string;
  method: string;
  status: number;
  duration: number;
  type: NetworkFailureType;
  timestamp: number;
  page: string;
}

export interface ApiCall {
  page: string;
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  requestSize?: number;
  responseSize?: number;
}

// ─── Aggregated structures ────────────────────────────────────────────────────

export interface ApiDependencyEdge {
  page: string;
  endpoint: string;
  method: string;
  calls: number;
  failures: number;
  avgDuration: number;
  maxDuration: number;
  slowCalls: number;
  /** Duplicate calls = same endpoint+method+page called more than once */
  isDuplicate: boolean;
}

export interface ObservabilitySeverityResult {
  severity: ObservabilitySeverity;
  score: number;
  reasons: string[];
}

// ─── Failure features vector (persisted to DB + Allure) ──────────────────────

export interface FailureFeaturesV1 {
  schemaVersion: 'failure_features_v1';
  spec: string;
  test: string;
  module: string;
  integrationFolder: string;
  testStatus: string;
  isFailure: boolean;
  retryAttempt: number;
  maxRetries: number;
  passedOnRetry: boolean;
  componentKey: string;
  pageKey: string;
  failureMessage: string;
  /** Full Playwright error message — captured from Gauge ExecutionContext in AfterScenario */
  failureStackTrace: string;
  failureSignature: string;
  failureBucketHint: FailureBucket;
  consoleErrorCount: number;
  consoleWarnCount: number;
  uncaughtExceptionCount: number;
  networkFailureCount: number;
  apiCallCount: number;
  apiDependencyEdgeCount: number;
  duplicateApiCallCount: number;
  slowApiCallCount: number;
  slowApiThresholdMs: number;
  http4xxCount: number;
  http5xxCount: number;
  p95ApiDuration: number;
  maxApiDuration: number;
  topFailingEndpoint: string;
  observabilitySeverity: ObservabilitySeverity;
  observabilityScore: number;
  observabilityReasons: string[];
  suspectedCategoryRule: string;
  suspectedCategoryScore: number;
  timestamp: number;
  /** Base64-encoded PNG screenshot on failure, stored in DB */
  screenshotBase64?: string;
}

// ─── Observability payload wrapper ───────────────────────────────────────────

export interface ObservabilityPayload<T> {
  spec: string;
  test: string;
  module: string;
  integrationFolder: string;
  timestamp: number;
  data: T[];
}

// ─── AI Analyzer types ────────────────────────────────────────────────────────

export type FailureCategory =
  | 'Automation Script Issue'
  | 'Flaky Issue'
  | 'Network / Infrastructure Issue'
  | 'Product Issue'
  | 'Test Data Issue'
  | 'Unclassified';

export interface AIAnalysisResult {
  testName: string;
  spec: string;
  failureCategory: FailureCategory;
  confidence: number;
  reasoning: string;
  suggestions: string[];
  isFlaky: boolean;
  historicalFailureCount?: number;
}
