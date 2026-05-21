/**
 * ObservabilityCollector — attaches to a Playwright Page and collects
 * console signals, network failures, and API call profiles in real-time.
 *
 * Usage:
 *   const obs = new ObservabilityCollector(page, env);
 *   obs.attach();           // wire listeners
 *   // ... run test ...
 *   const features = obs.buildFailureFeatures(testMeta);
 *   obs.reset();            // clear between tests
 */

import { Page, Request, Response, ConsoleMessage } from '@playwright/test';
import { FrameworkEnv } from '../utils/EnvLoader';
import { logger } from '../utils/Logger';
import {
  ApiCall,
  ApiDependencyEdge,
  ConsoleLevel,
  ConsoleSignal,
  FailureBucket,
  FailureFeaturesV1,
  NetworkFailure,
  ObservabilitySeverityResult,
} from './types';

// Static assets that are never interesting from an API perspective
const STATIC_ASSET_RE = /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map|webp)(?:\?|$)/i;
const IGNORE_URL_FRAGMENTS = ['__playwright', 'sockjs-node', 'webpack-hmr', 'hot-update'];

export interface TestMeta {
  spec: string;
  test: string;
  module: string;
  integrationFolder: string;
  testStatus: 'passed' | 'failed' | 'skipped' | 'unknown';
  /** One-line error message from the failing step (from Gauge ExecutionContext) */
  failureMessage: string;
  /** Full stack trace from the failing step (from Gauge ExecutionContext) */
  failureStackTrace: string;
  retryAttempt: number;
  maxRetries: number;
  screenshotBase64?: string;
}

export class ObservabilityCollector {
  private consoleSignals: ConsoleSignal[]  = [];
  private networkFailures: NetworkFailure[] = [];
  private apiCalls: ApiCall[]              = [];
  private currentPage                      = 'unknown';
  private requestStartTimes                = new Map<string, number>();

  constructor(
    private readonly page: Page,
    private readonly env: FrameworkEnv,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  attach(): void {
    if (!this.env.observabilityEnabled) {
      logger.info('Observability disabled — skipping attach');
      return;
    }

    this.page.on('console',   (msg)  => this.onConsole(msg));
    this.page.on('pageerror', (err)  => this.onPageError(err));
    this.page.on('request',   (req)  => this.onRequest(req));
    this.page.on('response',  (resp) => this.onResponse(resp));

    logger.info('ObservabilityCollector attached');
  }

  detach(): void {
    this.page.removeAllListeners('console');
    this.page.removeAllListeners('pageerror');
    this.page.removeAllListeners('request');
    this.page.removeAllListeners('response');
  }

  reset(): void {
    this.consoleSignals   = [];
    this.networkFailures  = [];
    this.apiCalls         = [];
    this.currentPage      = 'unknown';
    this.requestStartTimes.clear();
  }

  setCurrentPage(label: string): void {
    this.currentPage = label;
    logger.debug(`ObservabilityCollector: current page set to "${label}"`);
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private onConsole(msg: ConsoleMessage): void {
    const level = msg.type() as string;
    const text  = msg.text();

    if (level === 'error') {
      this.consoleSignals.push({
        message: text,
        type:    this.categorizeConsoleError(text),
        level:   'error',
        timestamp: Date.now(),
        page:    this.currentPage,
      });
    } else if (level === 'warning' || level === 'warn') {
      this.consoleSignals.push({
        message: text,
        type:    this.categorizeConsoleWarning(text),
        level:   'warn',
        timestamp: Date.now(),
        page:    this.currentPage,
      });
    }
  }

  private onPageError(error: Error): void {
    this.consoleSignals.push({
      message: error.stack ?? error.message,
      type:    'UNCAUGHT_EXCEPTION',
      level:   'uncaught_exception',
      timestamp: Date.now(),
      page:    this.currentPage,
    });
  }

  private onRequest(request: Request): void {
    if (!this.shouldTrackUrl(request.url())) return;
    this.requestStartTimes.set(request.url() + request.method(), Date.now());
  }

  private onResponse(response: Response): void {
    const url    = response.url();
    const method = response.request().method();
    if (!this.shouldTrackUrl(url)) return;

    const key       = url + method;
    const startedAt = this.requestStartTimes.get(key) ?? Date.now();
    const duration  = Date.now() - startedAt;
    const status    = response.status();

    this.requestStartTimes.delete(key);

    const call: ApiCall = {
      page:      this.currentPage,
      endpoint:  url,
      method,
      status,
      duration,
      timestamp: Date.now(),
    };

    this.apiCalls.push(call);

    if (status >= 400) {
      this.networkFailures.push({
        url,
        method,
        status,
        duration,
        type:      this.categorizeNetworkFailure(status),
        timestamp: Date.now(),
        page:      this.currentPage,
      });
      logger.warn(`API failure: ${method} ${url} → ${status} (${duration}ms)`);
    }

    if (duration >= this.env.slowApiThresholdMs) {
      logger.warn(`Slow API: ${method} ${url} → ${duration}ms (threshold: ${this.env.slowApiThresholdMs}ms)`);
    }
  }

  // ─── Aggregation ─────────────────────────────────────────────────────────

  buildApiDependencyEdges(): ApiDependencyEdge[] {
    const edgeMap = new Map<string, ApiDependencyEdge & { totalDuration: number }>();

    for (const call of this.apiCalls) {
      const endpoint = this.normalizeEndpoint(call.endpoint);
      const key      = `${call.page}|${call.method}|${endpoint}`;

      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          page: call.page, endpoint, method: call.method,
          calls: 0, failures: 0, avgDuration: 0,
          maxDuration: 0, slowCalls: 0, isDuplicate: false,
          totalDuration: 0,
        });
      }

      const edge = edgeMap.get(key)!;
      edge.calls         += 1;
      edge.totalDuration += call.duration;
      edge.maxDuration    = Math.max(edge.maxDuration, call.duration);
      if (call.status >= 400)                      edge.failures  += 1;
      if (call.duration >= this.env.slowApiThresholdMs) edge.slowCalls += 1;
    }

    return Array.from(edgeMap.values()).map(e => ({
      page: e.page, endpoint: e.endpoint, method: e.method,
      calls: e.calls, failures: e.failures,
      avgDuration: e.calls > 0 ? Math.round(e.totalDuration / e.calls) : 0,
      maxDuration: e.maxDuration,
      slowCalls:   e.slowCalls,
      isDuplicate: e.calls > 1,
    })).sort((a, b) => b.failures - a.failures || b.slowCalls - a.slowCalls);
  }

  buildFailureFeatures(meta: TestMeta): FailureFeaturesV1 {
    const edges                  = this.buildApiDependencyEdges();
    const slowCalls              = this.apiCalls.filter(c => c.duration >= this.env.slowApiThresholdMs);
    const consoleErrorCount      = this.consoleSignals.filter(s => s.level === 'error').length;
    const consoleWarnCount       = this.consoleSignals.filter(s => s.level === 'warn').length;
    const uncaughtExceptionCount = this.consoleSignals.filter(s => s.level === 'uncaught_exception').length;
    const http4xxCount           = this.apiCalls.filter(c => c.status >= 400 && c.status < 500).length;
    const http5xxCount           = this.apiCalls.filter(c => c.status >= 500).length;
    const durations              = this.apiCalls.map(c => c.duration);
    const p95ApiDuration         = percentile(durations, 95);
    const maxApiDuration         = durations.length ? Math.max(...durations) : 0;
    const topFailingEndpoint     = this.getTopFailingEndpoint();
    const duplicateApiCallCount  = edges.filter(e => e.isDuplicate).length;

    // Use message first, then first line of stack trace, then spec::test as last resort
    const signatureSource   = meta.failureMessage
      || (meta.failureStackTrace?.split('\n')[0] ?? '')
      || `${meta.spec}::${meta.test}`;
    const failureSignature  = toStableSignature(signatureSource);
    const failureBucketHint = toFailureBucketHint(meta.failureMessage || meta.failureStackTrace);
    const severityResult    = calculateObservabilitySeverity(
      consoleErrorCount, consoleWarnCount, uncaughtExceptionCount,
      this.networkFailures.length, slowCalls.length,
    );
    const ruleCategory = computeRuleCategory(
      consoleErrorCount, uncaughtExceptionCount,
      this.networkFailures.length, slowCalls.length,
      failureBucketHint,
    );

    return {
      schemaVersion: 'failure_features_v1',
      spec:               meta.spec,
      test:               meta.test,
      module:             meta.module,
      integrationFolder:  meta.integrationFolder,
      testStatus:         meta.testStatus,
      isFailure:          meta.testStatus === 'failed',
      retryAttempt:       meta.retryAttempt,
      maxRetries:         meta.maxRetries,
      passedOnRetry:      meta.testStatus === 'passed' && meta.retryAttempt > 0,
      componentKey:       meta.module,
      pageKey:            this.currentPage,
      failureMessage:     meta.failureMessage,
      failureStackTrace:  meta.failureStackTrace,
      failureSignature,
      failureBucketHint,
      consoleErrorCount,
      consoleWarnCount,
      uncaughtExceptionCount,
      networkFailureCount:     this.networkFailures.length,
      apiCallCount:            this.apiCalls.length,
      apiDependencyEdgeCount:  edges.length,
      duplicateApiCallCount,
      slowApiCallCount:        slowCalls.length,
      slowApiThresholdMs:      this.env.slowApiThresholdMs,
      http4xxCount,
      http5xxCount,
      p95ApiDuration,
      maxApiDuration,
      topFailingEndpoint,
      observabilitySeverity:   severityResult.severity,
      observabilityScore:      severityResult.score,
      observabilityReasons:    severityResult.reasons,
      suspectedCategoryRule:   ruleCategory.category,
      suspectedCategoryScore:  Number(ruleCategory.score.toFixed(3)),
      timestamp:               Date.now(),
      screenshotBase64:        meta.screenshotBase64,
    };
  }

  // ─── Snapshot accessors ───────────────────────────────────────────────────

  getConsoleSignals()  { return [...this.consoleSignals]; }
  getNetworkFailures() { return [...this.networkFailures]; }
  getApiCalls()        { return [...this.apiCalls]; }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private shouldTrackUrl(url: string): boolean {
    if (STATIC_ASSET_RE.test(url)) return false;
    if (IGNORE_URL_FRAGMENTS.some(f => url.includes(f))) return false;
    return this.env.obsApiPathRegex.test(url);
  }

  private normalizeEndpoint(url: string): string {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return url.split('?')[0];
    }
  }

  private getTopFailingEndpoint(): string {
    const counts = new Map<string, number>();
    for (const c of this.apiCalls) {
      if (c.status < 400) continue;
      const ep = this.normalizeEndpoint(c.endpoint);
      counts.set(ep, (counts.get(ep) ?? 0) + 1);
    }
    let top = '', max = 0;
    for (const [ep, n] of counts) { if (n > max) { max = n; top = ep; } }
    return top;
  }

  private categorizeConsoleError(msg: string): ConsoleSignal['type'] {
    if (/TypeError|ReferenceError|SyntaxError/i.test(msg)) return 'JS_RUNTIME_ERROR';
    if (/Failed to fetch|fetch.*failed/i.test(msg))        return 'API_FAILURE';
    if (/404|not found/i.test(msg))                        return 'RESOURCE_NOT_FOUND';
    if (/NetworkError/i.test(msg))                         return 'NETWORK_ERROR';
    if (/React|Angular|Vue/i.test(msg))                    return 'FRAMEWORK_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private categorizeConsoleWarning(msg: string): ConsoleSignal['type'] {
    if (/deprecated|deprecation/i.test(msg))              return 'DEPRECATION_WARNING';
    if (/performance|slow/i.test(msg))                    return 'PERFORMANCE_WARNING';
    if (/Failed to fetch|NetworkError/i.test(msg))        return 'NETWORK_WARNING';
    return 'WARNING';
  }

  private categorizeNetworkFailure(status: number): NetworkFailure['type'] {
    if (status >= 500)                    return 'SERVER_ERROR';
    if (status === 404)                   return 'RESOURCE_NOT_FOUND';
    if (status === 401 || status === 403) return 'AUTH_FAILURE';
    if (status >= 400)                    return 'CLIENT_ERROR';
    return 'UNKNOWN_NETWORK_ERROR';
  }
}

// ─── Pure computation helpers (no class dependency) ──────────────────────────

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx    = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function toStableSignature(value: string): string {
  const norm = value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\d{2,}/g, '[n]')
    .replace(/[0-9a-f]{8,}/g, '[hex]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);

  let hash = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    hash ^= norm.charCodeAt(i);
    hash  = Math.imul(hash, 16777619);
  }
  return `sig_${(hash >>> 0).toString(16)}`;
}

function toFailureBucketHint(msg: string): FailureBucket {
  const m = msg.toLowerCase();
  if (!m)                                                                          return 'NONE';
  if (/timed out|timeout/.test(m))                                                 return 'TIMEOUT';
  if (/assert|expected/.test(m))                                                   return 'ASSERTION';
  if (/element/.test(m) && /(not found|detached|stale)/.test(m))                  return 'SELECTOR_OR_STALE_ELEMENT';
  if (/network|failed to fetch|connection/.test(m))                               return 'NETWORK';
  if (/5\d{2}|server error/.test(m))                                              return 'SERVER_ERROR';
  if (/4\d{2}|client error|unauthorized|forbidden|not found/.test(m))            return 'CLIENT_ERROR';
  if (/typeerror|referenceerror|syntaxerror/.test(m))                             return 'RUNTIME_EXCEPTION';
  return 'UNKNOWN';
}

function calculateObservabilitySeverity(
  consoleErrorCount: number,
  consoleWarnCount: number,
  uncaughtExceptionCount: number,
  networkFailureCount: number,
  slowApiCallCount: number,
): ObservabilitySeverityResult {
  let score = 0;
  const reasons: string[] = [];

  if (uncaughtExceptionCount > 0) { score += uncaughtExceptionCount * 5; reasons.push(`${uncaughtExceptionCount} uncaught exception(s)`); }
  if (networkFailureCount   > 0) { score += networkFailureCount    * 4; reasons.push(`${networkFailureCount} network failure(s)`); }
  if (consoleErrorCount     > 0) { score += consoleErrorCount      * 3; reasons.push(`${consoleErrorCount} console error(s)`); }
  if (slowApiCallCount      > 0) { score += slowApiCallCount       * 2; reasons.push(`${slowApiCallCount} slow API call(s)`); }
  if (consoleWarnCount      > 0) { score += consoleWarnCount       * 1; reasons.push(`${consoleWarnCount} console warning(s)`); }

  if (score === 0) return { severity: 'NONE',   score, reasons: ['No observability issues detected'] };
  if (score >= 8)  return { severity: 'HIGH',   score, reasons };
  if (score >= 4)  return { severity: 'MEDIUM', score, reasons };
  return               { severity: 'LOW',    score, reasons };
}

function computeRuleCategory(
  consoleErrorCount: number,
  uncaughtExceptionCount: number,
  networkFailureCount: number,
  slowApiCallCount: number,
  failureBucketHint: FailureBucket,
): { category: string; score: number } {
  const automationScore = failureBucketHint === 'SELECTOR_OR_STALE_ELEMENT' ? 0.9 : 0;
  const networkScore    = Math.min(1, (networkFailureCount + slowApiCallCount * 0.5) / 3);
  const productScore    = Math.min(1, (consoleErrorCount + uncaughtExceptionCount + (failureBucketHint === 'ASSERTION' ? 1 : 0)) / 3);

  const candidates = [
    { category: 'Automation Script Issue',    score: automationScore },
    { category: 'Network / Infrastructure Issue', score: networkScore },
    { category: 'Product Issue',              score: productScore },
  ].sort((a, b) => b.score - a.score);

  return candidates[0].score > 0 ? candidates[0] : { category: 'Unclassified', score: 0 };
}
