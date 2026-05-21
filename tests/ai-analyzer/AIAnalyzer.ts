/**
 * AIAnalyzer — provider-agnostic test failure classifier.
 *
 * Supports any AI provider via the AIProvider abstraction:
 *   Anthropic Claude, OpenAI GPT-4o, Google Gemini,
 *   Groq, Together AI, Ollama (local), Azure OpenAI, etc.
 *
 * What gets sent to the AI for each failure:
 *   1. Structured observability telemetry (FailureFeaturesV1)
 *   2. Step-by-step Allure execution trace (which step failed, error message, stack trace)
 *   3. Failure screenshot — as a vision image for supported models,
 *      or a text note for non-vision models
 *
 * Configure via environment variables:
 *   AI_PROVIDER   = anthropic | openai | gemini | openai-compatible
 *   AI_API_KEY    = <your key>
 *   AI_MODEL      = (optional — uses provider default if omitted)
 *   AI_BASE_URL   = (required for openai-compatible, e.g. Groq / Ollama)
 */

import { AIProvider, AIImageInput }                    from './providers/AIProvider';
import { ProviderFactory }                              from './providers/ProviderFactory';
import { AllureResultReader }                           from './AllureResultReader';
import { FailureFeaturesV1, AIAnalysisResult, FailureCategory } from '../observability/types';
import { TestRunRepository, HistoricalStats }           from '../db/TestRunRepository';
import { logger }                                       from '../utils/Logger';

const FAILURE_CATEGORIES: FailureCategory[] = [
  'Automation Script Issue',
  'Flaky Issue',
  'Network / Infrastructure Issue',
  'Product Issue',
  'Test Data Issue',
  'Unclassified',
];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior QA automation engineer specialising in test failure root-cause analysis.
You receive structured telemetry data, the exact error message and stack trace from the failing step,
a step-by-step execution trace from the Allure report, and (when available) a screenshot of the browser
at the moment of failure.

Use ALL available signals to classify the failure accurately:
- Error message & stack trace show EXACTLY what went wrong at the code level
- Telemetry data shows what was happening in the browser (network, console, APIs)
- The execution trace shows the full step sequence and which step failed
- The screenshot shows the visual state of the app at the point of failure

Respond with ONLY a valid JSON object — no markdown fences, no explanation outside the JSON.`;

// ─────────────────────────────────────────────────────────────────────────────

export class AIAnalyzer {
  private readonly provider:      AIProvider;
  private readonly repo:          TestRunRepository;
  private readonly allureReader:  AllureResultReader;

  constructor(provider?: AIProvider) {
    this.provider     = provider ?? ProviderFactory.fromEnv();
    this.repo         = new TestRunRepository();
    this.allureReader = new AllureResultReader();

    logger.info(
      `AIAnalyzer ready — provider: ${this.provider.providerName} | ` +
      `model: ${this.provider.modelName} | ` +
      `vision: ${this.provider.supportsVision}`,
    );
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async analyzeRunBatch(runId: string): Promise<AIAnalysisResult[]> {
    logger.info(`AI Analyzer: starting batch for runId=${runId}`);

    const failedFeatures = await this.repo.getFailedRunsForBatch(runId);
    if (!failedFeatures.length) {
      logger.info('No failures in this batch — nothing to analyze.');
      return [];
    }

    logger.info(
      `Analyzing ${failedFeatures.length} failure(s) via ` +
      `${this.provider.providerName}/${this.provider.modelName}...`,
    );

    const results: AIAnalysisResult[] = [];

    for (const features of failedFeatures) {
      const historicalStats = await this.repo.getHistoricalStats(features.spec, features.test);
      const result          = await this.analyzeSingleFailure(features, historicalStats);
      results.push(result);

      await this.repo.updateWithAIAnalysis(
        runId,
        result.failureCategory,
        result.confidence,
        result.reasoning,
        result.suggestions,
      );
    }

    logger.info(`AI Analyzer: done — ${results.length} failures classified`);
    return results;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async analyzeSingleFailure(
    features: FailureFeaturesV1,
    history:  HistoricalStats,
  ): Promise<AIAnalysisResult> {

    // 1. Try to read the Allure step trace for this test
    const allureTrace = this.allureReader.getTraceForTest(features.test);
    if (allureTrace) {
      logger.debug(
        `[AIAnalyzer] Allure trace found for "${features.test}" — ` +
        `${allureTrace.totalSteps} steps, failed at step ` +
        `${allureTrace.steps.findIndex(s => ['failed','broken'].includes(s.status)) + 1}`,
      );
    } else {
      logger.debug(`[AIAnalyzer] No Allure trace found for "${features.test}"`);
    }

    // 2. Prepare screenshot if available
    const images: AIImageInput[] = [];
    const hasScreenshot = !!features.screenshotBase64;

    if (hasScreenshot && this.provider.supportsVision) {
      images.push({
        base64:    features.screenshotBase64!,
        mediaType: 'image/png',
        label:     `Browser screenshot at point of failure — test: "${features.test}"`,
      });
      logger.debug(`[AIAnalyzer] Screenshot included in request for "${features.test}"`);
    } else if (hasScreenshot && !this.provider.supportsVision) {
      logger.debug(
        `[AIAnalyzer] Screenshot available for "${features.test}" but ` +
        `${this.provider.providerName}/${this.provider.modelName} does not support vision — skipping image`,
      );
    }

    try {
      const response = await this.provider.complete({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:   this.buildUserPrompt(features, history, allureTrace?.formattedTrace, hasScreenshot),
        maxTokens:    1500,
        temperature:  0.2,
        images:       images.length ? images : undefined,
      });

      logger.debug(
        `AI response for "${features.test}" — ` +
        `tokens in=${response.inputTokens ?? '?'} out=${response.outputTokens ?? '?'}`,
      );

      return this.parseAIResponse(features, response.content, history);

    } catch (err) {
      logger.error(
        `AI analysis failed for "${features.test}"`,
        { error: (err as Error).message },
      );
      return this.fallbackResult(features, history);
    }
  }

  // ─── Prompt building ────────────────────────────────────────────────────────

  private buildUserPrompt(
    f:                 FailureFeaturesV1,
    h:                 HistoricalStats,
    allureTrace?:      string,
    hasScreenshot?:    boolean,
  ): string {
    const sections: string[] = [];

    // ── Section 1: Identity ───────────────────────────────────────────────────
    sections.push(`## Test Identity
- Test:    ${f.test}
- Spec:    ${f.spec}
- Module:  ${f.module}`);

    // ── Section 2: Error details (message + stack trace) ─────────────────────
    // failureMessage and failureStackTrace are populated directly from Gauge's
    // ExecutionContext.currentScenario.failedStep in the AfterScenario hook.
    const hasErrorDetails = !!(f.failureMessage || f.failureStackTrace);
    if (hasErrorDetails) {
      const lines: string[] = ['## Failure Error Details (from Gauge ExecutionContext)'];
      if (f.failureMessage) {
        lines.push(`**Error message:** ${f.failureMessage}`);
      }
      if (f.failureStackTrace) {
        // Trim to first 10 lines — enough for AI context without overloading the prompt
        const stackLines = f.failureStackTrace.split('\n').slice(0, 10).join('\n');
        lines.push('');
        lines.push('**Stack trace (first 10 lines):**');
        lines.push('```');
        lines.push(stackLines);
        lines.push('```');
      }
      sections.push(lines.join('\n'));
    } else {
      sections.push(`## Failure Error Details\nNo error message or stack trace captured for this test.`);
    }

    // ── Section 3: Allure execution trace ─────────────────────────────────────
    if (allureTrace) {
      sections.push(allureTrace);
    } else {
      sections.push(`## Test Execution Trace
No Allure result file found for this test.
Failure message: ${f.failureMessage || 'None'}`);
    }

    // ── Section 4: Screenshot note ────────────────────────────────────────────
    if (hasScreenshot && this.provider.supportsVision) {
      sections.push(
        `## Failure Screenshot\nA screenshot of the browser at the moment of failure is attached above.\n` +
        `Please describe what you observe in the screenshot and reference it in your reasoning.`,
      );
    } else if (hasScreenshot && !this.provider.supportsVision) {
      sections.push(
        `## Failure Screenshot\nA screenshot was captured but cannot be analysed because ` +
        `${this.provider.providerName}/${this.provider.modelName} does not support vision input.\n` +
        `Consider using a vision-capable model (gpt-4o, claude-3-5-sonnet, gemini-1.5-pro) for richer analysis.`,
      );
    } else {
      sections.push(`## Failure Screenshot\nNo screenshot was captured for this test.`);
    }

    // ── Section 5: Observability telemetry ────────────────────────────────────
    sections.push(`## Browser Observability Telemetry (auto-captured by framework)
- Severity:             ${f.observabilitySeverity} (score: ${f.observabilityScore})
- Console errors:       ${f.consoleErrorCount} | Warnings: ${f.consoleWarnCount} | Uncaught exceptions: ${f.uncaughtExceptionCount}
- Network failures:     ${f.networkFailureCount} (4xx: ${f.http4xxCount} | 5xx: ${f.http5xxCount})
- API calls:            ${f.apiCallCount} total (slow: ${f.slowApiCallCount} | duplicates: ${f.duplicateApiCallCount})
- Slowest API:          ${f.maxApiDuration}ms | P95: ${f.p95ApiDuration}ms
- Top failing endpoint: ${f.topFailingEndpoint || 'None'}
- Reasons:              ${f.observabilityReasons.join('; ') || 'None'}
- Pre-classified hint:  ${f.failureBucketHint} (rule confidence: ${f.suspectedCategoryScore})`);

    // ── Section 6: Historical data ────────────────────────────────────────────
    sections.push(`## Historical Data (last 30 days)
- Runs: ${h.totalRuns} | Failures: ${h.failureCount} | Failure rate: ${(h.failureRate * 100).toFixed(1)}%
- Historically flaky: ${h.isFlaky ? 'YES — this test has passed AND failed in recent history' : 'NO — consistent result'}
- Recent failure patterns: ${h.recentBuckets.join(', ') || 'None'}`);

    // ── Section 7: Classification task ───────────────────────────────────────
    sections.push(`## Classification Task

Classify this failure into EXACTLY ONE of these categories:
${FAILURE_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Category definitions:
- Automation Script Issue        — Selector broken, stale element, hardcoded wait, wrong locator, test code bug
- Flaky Issue                    — Passes sometimes, fails inconsistently — timing/race conditions, historically flaky
- Network / Infrastructure Issue — API 4xx/5xx errors, connection timeout, DNS failure, slow responses
- Product Issue                  — Application JS error, UI regression, wrong data returned, assertion on correct selector fails
- Test Data Issue                — Missing or stale test data, auth failure from data state, DB fixture problems
- Unclassified                   — Insufficient data to determine category

Use ALL signals: error message + stack trace, execution trace, screenshot visual, telemetry, and history.

## Required response format (JSON only — no markdown, no extra text)
{
  "category":    "<one of the 6 categories above>",
  "confidence":  <0.0 to 1.0>,
  "reasoning":   "<2-4 sentences citing specific evidence from the trace, screenshot, and telemetry>",
  "suggestions": [
    "<concrete actionable fix #1>",
    "<concrete actionable fix #2>",
    "<concrete actionable fix #3>"
  ]
}`);

    return sections.join('\n\n');
  }

  // ─── Response parsing ────────────────────────────────────────────────────────

  private parseAIResponse(
    features: FailureFeaturesV1,
    text:     string,
    history:  HistoricalStats,
  ): AIAnalysisResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found in AI response');

      const parsed = JSON.parse(jsonMatch[0]) as {
        category:    string;
        confidence:  number;
        reasoning:   string;
        suggestions: string[];
      };

      const category = FAILURE_CATEGORIES.includes(parsed.category as FailureCategory)
        ? (parsed.category as FailureCategory)
        : 'Unclassified';

      return {
        testName:              features.test,
        spec:                  features.spec,
        failureCategory:       category,
        confidence:            Math.min(1, Math.max(0, parsed.confidence ?? 0)),
        reasoning:             parsed.reasoning ?? '',
        suggestions:           Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        isFlaky:               category === 'Flaky Issue' || history.isFlaky,
        historicalFailureCount: history.failureCount,
      };

    } catch (err) {
      logger.warn(`Failed to parse AI response — using fallback`, { error: (err as Error).message });
      return this.fallbackResult(features, history);
    }
  }

  private fallbackResult(features: FailureFeaturesV1, history: HistoricalStats): AIAnalysisResult {
    return {
      testName:              features.test,
      spec:                  features.spec,
      failureCategory:       (features.suspectedCategoryRule as FailureCategory) ?? 'Unclassified',
      confidence:            features.suspectedCategoryScore ?? 0,
      reasoning:             'AI analysis unavailable — rule-based pre-classification used as fallback.',
      suggestions:           [
        'Review the Allure execution trace to identify which step failed',
        'Examine the failure screenshot if available',
        'Check observability telemetry for network or console errors',
      ],
      isFlaky:               history.isFlaky,
      historicalFailureCount: history.failureCount,
    };
  }
}
