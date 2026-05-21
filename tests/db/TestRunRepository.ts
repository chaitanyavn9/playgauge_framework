/**
 * TestRunRepository — typed data access for all test run telemetry.
 * Persists FailureFeaturesV1 + raw API calls + console signals to Postgres.
 */

import { query, withTransaction } from './DatabaseClient';
import { FailureFeaturesV1, ApiCall, ConsoleSignal } from '../observability/types';
import { logger } from '../utils/Logger';

export interface SaveTestRunOptions {
  features:        FailureFeaturesV1;
  apiCalls:        ApiCall[];
  consoleSignals:  ConsoleSignal[];
  environment:     string;
  runId:           string;
}

export interface HistoricalStats {
  totalRuns:     number;
  failureCount:  number;
  failureRate:   number;
  isFlaky:       boolean;
  recentBuckets: string[];
}

export class TestRunRepository {

  async save(opts: SaveTestRunOptions): Promise<string> {
    const { features: f, apiCalls, consoleSignals, environment, runId } = opts;

    return withTransaction(async (client) => {
      // 1. Insert test_runs row
      const runResult = await client.query<{ id: string }>(
        `INSERT INTO test_runs (
          run_id, spec, test, module, integration_folder, component_key, page_key, environment,
          test_status, is_failure, retry_attempt, max_retries, passed_on_retry,
          failure_message, failure_stack_trace, failure_signature, failure_bucket_hint, schema_version,
          console_error_count, console_warn_count, uncaught_exception_count,
          network_failure_count, api_call_count, api_dependency_edge_count,
          duplicate_api_call_count, slow_api_call_count, slow_api_threshold_ms,
          http_4xx_count, http_5xx_count, p95_api_duration, max_api_duration, top_failing_endpoint,
          observability_severity, observability_score, observability_reasons,
          suspected_category_rule, suspected_category_score,
          screenshot_base64, failure_features_json, timestamp
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,
          $22,$23,$24,
          $25,$26,$27,
          $28,$29,$30,$31,$32,
          $33,$34,$35,
          $36,$37,
          $38,$39,$40
        ) RETURNING id`,
        [
          runId, f.spec, f.test, f.module, f.integrationFolder, f.componentKey, f.pageKey, environment,
          f.testStatus, f.isFailure, f.retryAttempt, f.maxRetries, f.passedOnRetry,
          f.failureMessage, f.failureStackTrace ?? null, f.failureSignature, f.failureBucketHint, f.schemaVersion,
          f.consoleErrorCount, f.consoleWarnCount, f.uncaughtExceptionCount,
          f.networkFailureCount, f.apiCallCount, f.apiDependencyEdgeCount,
          f.duplicateApiCallCount, f.slowApiCallCount, f.slowApiThresholdMs,
          f.http4xxCount, f.http5xxCount, f.p95ApiDuration, f.maxApiDuration, f.topFailingEndpoint,
          f.observabilitySeverity, f.observabilityScore, f.observabilityReasons,
          f.suspectedCategoryRule, f.suspectedCategoryScore,
          f.screenshotBase64 ?? null, JSON.stringify(f), f.timestamp,
        ],
      );

      const testRunId = runResult.rows[0].id;

      // 2. Bulk insert api_calls
      if (apiCalls.length > 0) {
        const apiValues = apiCalls.map((c, i) => {
          const base = i * 8;
          return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
        }).join(',');

        const apiParams = apiCalls.flatMap(c => [
          testRunId, c.page, c.endpoint, c.method, c.status, c.duration, c.timestamp,
          c.duration >= f.slowApiThresholdMs,
        ]);

        await client.query(
          `INSERT INTO api_calls (run_id, page, endpoint, method, status, duration_ms, timestamp, is_slow)
           VALUES ${apiValues}`,
          apiParams,
        );
      }

      // 3. Bulk insert console_signals
      if (consoleSignals.length > 0) {
        const csValues = consoleSignals.map((_, i) => {
          const base = i * 6;
          return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6})`;
        }).join(',');

        const csParams = consoleSignals.flatMap(s => [
          testRunId, s.message, s.type, s.level, s.page, s.timestamp,
        ]);

        await client.query(
          `INSERT INTO console_signals (run_id, message, signal_type, level, page, timestamp)
           VALUES ${csValues}`,
          csParams,
        );
      }

      logger.info(`TestRun saved: ${testRunId} (${f.testStatus}) — ${f.test}`);
      return testRunId;
    });
  }

  /** Get historical failure stats for a given test — used by AI Analyzer for flaky detection */
  async getHistoricalStats(spec: string, test: string, lookbackDays = 30): Promise<HistoricalStats> {
    const result = await query<{
      total_runs: string;
      failure_count: string;
      passed_on_retry_count: string;
      buckets: string[];
    }>(
      `SELECT
         COUNT(*)                                      AS total_runs,
         COUNT(*) FILTER (WHERE is_failure)            AS failure_count,
         COUNT(*) FILTER (WHERE passed_on_retry)       AS passed_on_retry_count,
         ARRAY_AGG(DISTINCT failure_bucket_hint)
           FILTER (WHERE failure_bucket_hint IS NOT NULL) AS buckets
       FROM test_runs
       WHERE spec = $1 AND test = $2
         AND created_at >= NOW() - ($3 || ' days')::INTERVAL`,
      [spec, test, lookbackDays],
    );

    const row          = result.rows[0];
    const totalRuns    = parseInt(row.total_runs,    10) || 0;
    const failureCount = parseInt(row.failure_count, 10) || 0;
    const passedOnRetryCount = parseInt(row.passed_on_retry_count, 10) || 0;
    const failureRate  = totalRuns > 0 ? failureCount / totalRuns : 0;

    return {
      totalRuns,
      failureCount,
      failureRate,
      isFlaky: passedOnRetryCount > 0 || (failureRate > 0.1 && failureRate < 0.9),
      recentBuckets: row.buckets ?? [],
    };
  }

  /** Update test run with AI analysis results */
  async updateWithAIAnalysis(
    testRunId: string,
    category: string,
    confidence: number,
    reasoning: string,
    suggestions: string[],
  ): Promise<void> {
    await query(
      `UPDATE test_runs
       SET ai_failure_category = $1,
           ai_confidence       = $2,
           ai_reasoning        = $3,
           ai_suggestions      = $4,
           ai_analyzed_at      = NOW()
       WHERE id = $5`,
      [category, confidence, reasoning, suggestions, testRunId],
    );
  }

  /**
   * Fetch all failed runs for a given batch — used by AI Analyzer.
   *
   * Returns FailureFeaturesV1[] with screenshotBase64 always populated from
   * the dedicated screenshot_base64 column (more reliable than reading it
   * from the JSONB blob, which may omit large fields in future optimisations).
   */
  async getFailedRunsForBatch(runId: string): Promise<FailureFeaturesV1[]> {
    const result = await query<{
      failure_features_json: FailureFeaturesV1;
      screenshot_base64:     string | null;
    }>(
      `SELECT failure_features_json, screenshot_base64
       FROM test_runs
       WHERE run_id = $1 AND is_failure = TRUE
       ORDER BY created_at`,
      [runId],
    );

    return result.rows.map(r => ({
      ...r.failure_features_json,
      // Always pull screenshot from its own column — takes precedence over JSON
      screenshotBase64: r.screenshot_base64 ?? undefined,
    }));
  }
}
