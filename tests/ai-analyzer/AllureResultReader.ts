/**
 * AllureResultReader
 *
 * Reads Allure result JSON files from the allure-results/ directory
 * and extracts structured step-by-step execution data for use in AI
 * failure analysis prompts.
 *
 * Allure generates one *-result.json file per test execution. Each file
 * contains the test name, status, step tree, error details, and attachments.
 *
 * Usage:
 *   const reader = new AllureResultReader();
 *   const trace  = reader.getTraceForTest('Login fails with invalid credentials');
 *   if (trace) {
 *     prompt += trace.formattedTrace;
 *   }
 */

import * as fs   from 'fs';
import * as path from 'path';
import { logger } from '../utils/Logger';

// ─── Allure JSON schema (subset we care about) ────────────────────────────────

interface AllureStep {
  name:          string;
  status:        'passed' | 'failed' | 'broken' | 'skipped' | string;
  statusDetails?: { message?: string; trace?: string };
  start?:        number;
  stop?:         number;
  steps?:        AllureStep[];
  parameters?:   Array<{ name: string; value: string }>;
  attachments?:  Array<{ name: string; source: string; type: string }>;
}

interface AllureResult {
  uuid:          string;
  name:          string;
  status:        'passed' | 'failed' | 'broken' | 'skipped' | string;
  statusDetails?: { message?: string; trace?: string };
  start?:        number;
  stop?:         number;
  steps?:        AllureStep[];
  attachments?:  Array<{ name: string; source: string; type: string }>;
  labels?:       Array<{ name: string; value: string }>;
  parameters?:   Array<{ name: string; value: string }>;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface StepEntry {
  index:      number;
  name:       string;
  status:     string;
  durationMs: number;
  error?:     string;
  /** Nested step entries (one level flattened for readability) */
  children?:  StepEntry[];
}

export interface AllureTestTrace {
  testName:      string;
  status:        string;
  totalSteps:    number;
  passedSteps:   number;
  failedSteps:   number;
  durationMs:    number;
  errorMessage:  string;
  errorTrace:    string;
  steps:         StepEntry[];
  /** Pre-formatted text block ready to insert into an AI prompt */
  formattedTrace: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class AllureResultReader {
  private readonly resultsDir: string;

  constructor(resultsDir?: string) {
    this.resultsDir = resultsDir
      ?? process.env.ALLURE_RESULTS_DIR
      ?? 'allure-results';
  }

  /**
   * Find and parse the most recent Allure result for a given test name.
   * Returns null if no matching result file is found.
   *
   * Matching is case-insensitive and uses partial string containment
   * to handle minor differences in test name formatting.
   */
  getTraceForTest(testName: string): AllureTestTrace | null {
    const resultFiles = this.findResultFiles();
    if (!resultFiles.length) {
      logger.debug(`[AllureResultReader] No result files found in ${this.resultsDir}`);
      return null;
    }

    // Find the best matching result (most recent file with matching name)
    const candidates = resultFiles
      .map(f => this.parseResultFile(f))
      .filter((r): r is AllureResult => r !== null)
      .filter(r => this.nameMatches(r.name, testName));

    if (!candidates.length) {
      logger.debug(`[AllureResultReader] No Allure result matched test name: "${testName}"`);
      return null;
    }

    // Pick the most recent result if multiple match (e.g. re-runs)
    const best = candidates.sort((a, b) => (b.stop ?? 0) - (a.stop ?? 0))[0];
    return this.buildTrace(best);
  }

  // ─── File scanning ──────────────────────────────────────────────────────────

  private findResultFiles(): string[] {
    if (!fs.existsSync(this.resultsDir)) {
      logger.debug(`[AllureResultReader] Results dir does not exist: ${this.resultsDir}`);
      return [];
    }
    try {
      return fs.readdirSync(this.resultsDir)
        .filter(f => f.endsWith('-result.json'))
        .map(f => path.join(this.resultsDir, f));
    } catch (err) {
      logger.warn(`[AllureResultReader] Could not read results dir: ${(err as Error).message}`);
      return [];
    }
  }

  private parseResultFile(filePath: string): AllureResult | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as AllureResult;
    } catch {
      return null;
    }
  }

  private nameMatches(resultName: string, searchName: string): boolean {
    const a = resultName.toLowerCase().trim();
    const b = searchName.toLowerCase().trim();
    return a.includes(b) || b.includes(a);
  }

  // ─── Trace building ─────────────────────────────────────────────────────────

  private buildTrace(result: AllureResult): AllureTestTrace {
    const steps        = this.flattenSteps(result.steps ?? [], 0);
    const totalSteps   = steps.length;
    const passedSteps  = steps.filter(s => s.status === 'passed').length;
    const failedSteps  = steps.filter(s => ['failed', 'broken'].includes(s.status)).length;
    const durationMs   = (result.stop ?? 0) - (result.start ?? 0);

    // Error info — prefer deepest failed step's message, then top-level
    const firstFailedStep = steps.find(s => ['failed', 'broken'].includes(s.status));
    const errorMessage =
      firstFailedStep?.error
      ?? result.statusDetails?.message
      ?? '';

    const errorTrace = result.statusDetails?.trace ?? '';
    // Trim to first 5 lines to keep prompt size manageable
    const traceLines = errorTrace.split('\n').slice(0, 5).join('\n');

    const formattedTrace = this.formatTrace({
      testName:     result.name,
      status:       result.status,
      totalSteps,
      passedSteps,
      failedSteps,
      durationMs,
      errorMessage,
      errorTrace:   traceLines,
      steps,
    });

    return {
      testName:     result.name,
      status:       result.status,
      totalSteps,
      passedSteps,
      failedSteps,
      durationMs,
      errorMessage,
      errorTrace:   traceLines,
      steps,
      formattedTrace,
    };
  }

  /**
   * Recursively flatten the Allure step tree into a numbered list.
   * Nests up to 2 levels deep (sub-steps shown as children).
   */
  private flattenSteps(steps: AllureStep[], _depth: number, startIndex = 1): StepEntry[] {
    const entries: StepEntry[] = [];
    let index = startIndex;
    for (const step of steps) {
      const durationMs = (step.stop ?? 0) - (step.start ?? 0);
      const error      = step.statusDetails?.message ?? undefined;
      const children   = step.steps?.length
        ? this.flattenSteps(step.steps, _depth + 1, 1)
        : undefined;

      entries.push({ index: index++, name: step.name, status: step.status, durationMs, error, children });
    }
    return entries;
  }

  /**
   * Format the trace as a human-readable text block for the AI prompt.
   */
  private formatTrace(t: Omit<AllureTestTrace, 'formattedTrace'>): string {
    const statusIcon = (s: string) =>
      s === 'passed' ? '✓' : ['failed', 'broken'].includes(s) ? '✗' : '○';

    const durationStr = (ms: number) =>
      ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

    const lines: string[] = [
      '## Test Execution Trace (Allure)',
      `Total steps: ${t.totalSteps} | Passed: ${t.passedSteps} | Failed: ${t.failedSteps} | Duration: ${durationStr(t.durationMs)}`,
      '',
    ];

    for (const step of t.steps) {
      const icon   = statusIcon(step.status);
      const dur    = durationStr(step.durationMs);
      const failed = ['failed', 'broken'].includes(step.status);
      lines.push(`Step ${step.index} ${icon}  ${step.name}  (${dur})`);

      if (failed && step.error) {
        lines.push(`          ↳ ERROR: ${step.error}`);
      }

      // Show sub-steps of the failed step for extra context
      if (failed && step.children?.length) {
        for (const child of step.children) {
          const cIcon = statusIcon(child.status);
          lines.push(`          ${cIcon}  ${child.name}  (${durationStr(child.durationMs)})`);
          if (['failed', 'broken'].includes(child.status) && child.error) {
            lines.push(`              ↳ ERROR: ${child.error}`);
          }
        }
      }
    }

    if (t.errorMessage) {
      lines.push('');
      lines.push(`Failure message: ${t.errorMessage}`);
    }

    if (t.errorTrace) {
      lines.push('');
      lines.push('Stack trace (first 5 lines):');
      t.errorTrace.split('\n').forEach(l => lines.push(`  ${l}`));
    }

    return lines.join('\n');
  }
}
